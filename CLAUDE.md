# CLAUDE.md — NeoPixel Control Project

## Project Overview

This project controls a 90-pixel NeoPixel strip connected to an **Adafruit ESP32-S2 Qtpy** via an Adafruit Seesaw I2C NeoPixel driver (addr 0x60, pin 15). Patterns are selected remotely through Adafruit.IO (cloud dashboard). The Arduino/C++ code in `neostrip/` and `libraries/fallpattern/` is the reference implementation. The CircuitPython code in `libraries/` is the active target that runs on the device.

For full setup and wiring, see `libraries/ADAFRUIT_IO_SETUP.md`.

---

## Hardware Constraints — ESP32-S2 Qtpy

- **RAM:** ~320 KB total, ~180 KB available to user code in CircuitPython
- **Flash:** 4 MB
- **No heap compaction** — fragmentation builds up over long runtimes; avoid creating/destroying objects in tight loops
- **No native integer types** — Python ints are boxed; minimize temporary object creation inside animation loops
- **NeoPixel driver:** Adafruit Seesaw over I2C (`busio.I2C`, `adafruit_seesaw.neopixel`), NOT the direct `neopixel` module
- **WiFi polling blocks the main thread** — keep HTTP requests fast and infrequent (current 0.5 s interval is acceptable)
- **`time.sleep()` is blocking** — animations must be non-blocking (step-based) so the main loop can check for pattern changes at any time
- **No threading or async** — preemption does not exist; cooperative yielding via the main loop is the only mechanism

---

## Code Organization

```
libraries/
├── circuitpython_main.py     # Main program (deploy as code.py on CIRCUITPY)
├── config.py                 # WiFi / Adafruit.IO credentials and settings
├── patterns/
│   ├── base_pattern.py       # BasePattern class with all shared animation primitives
│   ├── fall_pattern.py       # Autumn colors (red, yellow, orange)
│   ├── july_pattern.py       # Patriotic colors (red, white, blue)
│   ├── xmas_pattern.py       # Holiday colors (red, green, white + extras)
│   ├── norm_pattern.py       # Standard rainbow / theater chase
│   ├── alert_pattern.py      # Warning yellow solid fill
│   ├── blue_pattern.py       # Blue solid fill
│   └── pink_pattern.py       # Pink/magenta solid fill
libraries/fallpattern/        # C++ reference implementations (do not modify)
neostrip/neostrip.ino         # C++ Arduino main (do not modify)

frontend/                     # Next.js 14 web UI (deployed to Azure Static Web Apps)
├── src/app/
│   ├── page.tsx              # Full UI — pattern buttons, header, modals
│   ├── globals.css           # CRT/phosphor terminal design system (CSS vars + custom classes)
│   ├── layout.tsx            # Root layout, loads VT323 + Share Tech Mono fonts
│   ├── components/
│   │   └── ScheduleModal.tsx # Scheduled alert management modal
│   └── api/
│       ├── pattern/route.ts  # POST — proxies pattern commands to Adafruit.IO
│       └── schedules/route.ts # GET/POST — reads/writes schedules.json via GitHub Contents API

schedules.json                # Persistent schedule store (committed to repo root, read/written via GitHub API)

.github/
├── scripts/
│   └── fire_schedules.js     # Node.js cron script: checks EST time, fires alert to AIO
└── workflows/
    ├── deploy.yml            # Deploys frontend to Azure SWA on push to main
    └── schedule_alert.yml    # Runs every 5 min, fires alert if a schedule matches

infra/
├── main.tf                   # Azure Static Web App resource + app settings
└── variables.tf              # Input variables (aio_username, aio_key, aio_feed, github_pat)
```

---

## Improvement Goals

The following improvements must be implemented. **Do not implement them all at once — implement, test, and commit incrementally.**

### 1. Simplify the Python Code Structure

**Problem:** All animation step logic is currently duplicated in `circuitpython_main.py` as a set of `run_*_pattern_step()` functions. The pattern classes (`fall_pattern.py`, etc.) are empty shells. This makes the code bloated, hard to maintain, and inconsistent.

**Fix:**
- Move each pattern's step logic into its own pattern class as a `update()` method (non-blocking, called once per main loop iteration)
- Each pattern class owns its own state (step counter, sub-step, timing) as instance variables — not in an external `pattern_state` dict
- `circuitpython_main.py` main loop becomes: check Adafruit.IO → if pattern changed, call `pattern.reset()` → call `current_pattern.update()` → repeat
- `BasePattern` provides shared primitives only; no animation logic lives in `base_pattern.py`
- Delete all `run_*_pattern_step()` functions from `circuitpython_main.py`

**Pattern class interface (all patterns must implement):**
```python
class SomePattern(BasePattern):
    def reset(self):
        """Reset all state — called when switching TO this pattern."""
        ...
    def update(self):
        """Run one non-blocking step. Returns True to continue, False when sequence is complete (will auto-reset)."""
        ...
```

### 2. Match C++ Animation Behavior Exactly

Each Python animation must produce the same visual output, color sequence, and approximate timing as its C++ counterpart. Reference files are in `libraries/fallpattern/`.

**Known discrepancies to fix:**

| Pattern | C++ behavior | Current Python behavior | Fix needed |
|---|---|---|---|
| `theaterChase` (all) | 10 outer cycles | 5 cycles in `base_pattern.py` | Change to 10 cycles |
| `normpattern` theaterChase | 10×10 = 100 total cycles | 5 cycles | Fix to match: `for j in 10: for a in 10: for b in 3:` |
| `fallPattern2` | 1000 iterations | 200 steps | Change to 1000 iterations (non-blocking, ~1 per update call) |
| `fallPattern1` | Runs over `num_pixels` iterations (90) | Runs for 100 "sub_steps" | Use `num_pixels` as the loop bound |
| Normal pattern `theaterChase` colors | white=`(127,127,127)`, red=`(127,0,0)`, blue=`(0,0,127)` | red=full, blue=full | Match half-brightness values |
| C++ `colorWipe` delay | 50ms | 20ms (Python uses faster values) | Use 50ms to match C++ |

**Timing rule:** The C++ `delay(N)` calls use milliseconds. Python equivalents must use `time.sleep(N / 1000.0)` with the same N values. Do not reduce delays to "speed things up" — visual parity with C++ is the goal.

**Color values are exact** — do not alter any RGB tuples from the C++ source unless correcting a confirmed bug.

### 3. Seamless Animation Switching

**Requirement:** When Adafruit.IO delivers a new pattern command, the switch must happen at the next main loop iteration — no waiting for the current animation sequence to finish.

**Implementation rules:**
- No `time.sleep()` anywhere inside pattern `update()` methods — all delays must be implemented as non-blocking time checks:
  ```python
  if time.monotonic() - self._last_update < self._delay:
      return  # Not yet time to advance
  self._last_update = time.monotonic()
  # ... do one step
  ```
- The main loop must check for pattern changes on every iteration, not only between animation phases
- `pixels.fill((0,0,0)); pixels.show()` before activating a new pattern provides a clean visual cut — keep the existing 0.2 s blank gap
- `pattern.reset()` must fully reinitialize all state so the new pattern starts cleanly from the beginning

### 4. Memory Efficiency

- Allocate all state as fixed instance variables in `__init__` — avoid creating new dicts, lists, or tuples inside `update()` or any loop that runs frequently
- Do not use string formatting (`f"..."`) inside tight animation loops — only use it for debug prints that are gated on a condition
- The `pattern_state` dict in `circuitpython_main.py` must be removed entirely (state belongs in each pattern instance)
- Reuse the single `pixels` object — never create new NeoPixel instances
- After a pattern switch, call `gc.collect()` once to reclaim memory before starting the new pattern

### 5. Import Cleanup

**Bug:** `circuitpython_main.py` currently imports both `neopixel` (standard) and `adafruit_seesaw.neopixel` — the standard `neopixel` import is unused and wastes memory. Remove it.

Only these imports are needed in the main file:
```python
import board, busio, time, wifi, socketpool, ssl, adafruit_requests, supervisor, gc
from adafruit_seesaw import seesaw, neopixel as seesaw_neopixel
from config import *
from patterns.fall_pattern import FallPattern
# ... other patterns
```

---

## Frontend UI

The frontend is a retro CRT terminal-themed Next.js 14 SPA (`CHROMACORE-90`). All components are in `frontend/src/app/page.tsx` except `ScheduleModal` which lives in `frontend/src/app/components/ScheduleModal.tsx`.

**Design system rules:**
- Fonts: VT323 (`var(--font-terminal)`) for display text, Share Tech Mono (`var(--font-data)`) for data readouts
- Two themes: green phosphor (default) and amber phosphor — toggled via `data-theme="light"` on `<html>`
- All custom CSS classes are in `globals.css`: `panel`, `notched`, `panel-glow`, `retro-input`, `section-label`, `toggle-track`/`toggle-thumb`, `modal-backdrop`, `animate-fadeIn`, `animate-blink`, etc.
- Tailwind utility classes for `border-terminal`, `border-terminal-bright`, `bg-card`, `text-primary`, `text-dim`, `text-faint` are defined in `globals.css` — do not redefine them as Tailwind theme colors
- Modal pattern: backdrop click to close, `notched panel panel-glow animate-fadeIn`, header with label + ✕ button, `[ ACTION ]` bracket-style buttons

**Communication path:**
Browser → `POST /api/pattern` → Adafruit.IO REST API → device polls every 0.5 s and switches pattern

**State persistence:**
- Active pattern: `localStorage` key `chromacore_active`
- Theme: `localStorage` key `chromacore_theme`
- AIO credentials override: `localStorage` key `chromacore_settings`

---

## Scheduled Alerts

The AlertPattern can be triggered automatically on a schedule configured via the frontend.

**How it works:**
1. Schedules are stored in `schedules.json` at the repo root (read/written via GitHub Contents API)
2. The GitHub Actions workflow `schedule_alert.yml` runs every 5 minutes (`*/5 * * * *`)
3. `fire_schedules.js` reads the schedule list, checks the current EST time, and POSTs `alert` to Adafruit.IO if a schedule matches
4. The device picks up the `alert` command within 0.5 s and runs `AlertPattern` until manually changed

**Schedule data model** (`schedules.json`):**
```json
{
  "version": 1,
  "schedules": [
    {
      "id": "unique-string",
      "label": "Morning Alert",
      "enabled": true,
      "time": "08:00",
      "month": null,
      "day": null,
      "year": null,
      "repeatable": true,
      "pattern": "alert",
      "created_at": "ISO-8601",
      "last_fired_at": null
    }
  ]
}
```

- `time`: `"HH:MM"` in 24h, **always Eastern Time (America/New_York)**. Must be a 5-minute increment (00, 05, 10, …, 55).
- `month`/`day`/`year`: `null` means "any" (wildcard); integers match specifically
- `repeatable: false` disables the schedule after it fires once
- `last_fired_at`: written back by the cron script after a successful fire; used to prevent double-firing

**Timing behavior:**
- Cron runs at :00, :05, :10, … of every hour
- The script rounds the current EST minute down to the nearest 5 to tolerate GitHub Actions runner latency
- Guard window: 290 seconds — prevents the same schedule firing on back-to-back cron runs
- Alert stays active until user manually selects a different pattern

**Secrets required:**
| Secret | Where | Purpose |
|---|---|---|
| `AIO_USERNAME` | Repo secret | Cron script fires alert to AIO |
| `AIO_KEY` | Repo secret | Cron script authentication |
| `AIO_FEED` | Repo secret | Feed name (`neopixel-pattern`) |
| `GITHUB_PAT` | Repo secret + Azure SWA app setting | Frontend API routes read/write `schedules.json` via GitHub Contents API |
| `GITHUB_REPO` | Azure SWA app setting | Hardcoded to `ByronTechCoder/neopixel_control` in `main.tf` |

`GITHUB_PAT` must be a fine-grained PAT with **Contents: read+write** on this repo only.

**Write-back safety:** The cron script re-fetches `schedules.json` from GitHub (not the local checkout) before writing back `last_fired_at`, so concurrent runs don't overwrite each other's changes.

**Skip CI:** Commits made by the cron script and frontend saves include `[skip ci]` in the message to prevent triggering the deploy workflow.

---

## Adafruit.IO Integration Rules

- Feed name: `neopixel-pattern`
- Polling interval: 0.5 s (do not decrease — it causes excessive API calls)
- Accepted values: `fall`, `july`, `xmas`, `normal`, `alert`, `blue`, `pink`, `off`, or `0`–`6`
- Both HTTP 200 and 201 are valid success codes for POST
- On connection failure, the current pattern continues uninterrupted — never crash or halt on network errors
- WiFi must be 2.4 GHz (ESP32-S2 does not support 5 GHz)

---

## Testing

There is no automated test runner. Testing is done by:
1. Deploying `code.py` + `patterns/` to the CIRCUITPY drive
2. Monitoring serial output via a serial console (115200 baud)
3. Triggering pattern changes from the Adafruit.IO dashboard
4. Visually confirming animation matches the C++ reference behavior

Use `test_adafruit_io.py` (renamed to `code.py` temporarily) to verify network connectivity before debugging animation issues.

---

## Do Not Change

- `neostrip/neostrip.ino` — C++ reference; read it, do not edit it
- `libraries/fallpattern/*.cpp` and `*.h` — C++ reference implementations
- `libraries/ADAFRUIT_IO_SETUP.md` — setup documentation
- `config.py` structure — credentials file; only the values inside it change per deployment
- Hardware pin assignments: Seesaw I2C on `board.SCL1`/`board.SDA1`, addr `0x60`, NeoPixel pin `15`, 90 pixels
