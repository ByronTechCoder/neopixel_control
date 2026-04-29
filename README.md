# CHROMACORE-90 — NeoPixel Control System

A cloud-connected NeoPixel controller running CircuitPython on an **Adafruit ESP32-S2 Qtpy**. Patterns are selected remotely through a retro CRT-themed web UI that communicates via **Adafruit.IO**. Scheduled alerts fire automatically through a **Cloudflare Worker** cron.

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        User / Browser                           │
│              https://neopixels.viralcoder.net                   │
└──────────────────────┬──────────────────────────────────────────┘
                       │ POST /api/pattern
                       ▼
┌─────────────────────────────────────────────────────────────────┐
│          Next.js 14 Frontend  (Azure Static Web App)            │
│    /api/pattern   →  Adafruit.IO REST API                       │
│    /api/schedules →  GitHub Contents API (schedules.json)       │
└──────────────────────┬──────────────────────────────────────────┘
                       │ POST to AIO feed
                       ▼
┌─────────────────────────────────────────────────────────────────┐
│              Adafruit.IO  (feed: neopixel-pattern)              │
└──────────────────────┬──────────────────────────────────────────┘
                       │ HTTP poll every 0.5 s
                       ▼
┌─────────────────────────────────────────────────────────────────┐
│        ESP32-S2 Qtpy  (CircuitPython)                           │
│        Adafruit Seesaw I2C NeoPixel Driver                      │
│        90-pixel NeoPixel strip                                  │
└─────────────────────────────────────────────────────────────────┘

Scheduled Alerts (parallel path):
┌───────────────────────────────┐
│  schedules.json  (repo root)  │◄──── Frontend writes via GitHub API
└──────────┬────────────────────┘
           │ fetch every 5 min
           ▼
┌───────────────────────────────┐
│  Cloudflare Worker  (cron)    │ → POST "alert" → AIO feed → device
│  worker/src/index.js          │
└───────────────────────────────┘
```

---

## Hardware

| Component | Detail |
|---|---|
| Microcontroller | Adafruit ESP32-S2 Qtpy |
| NeoPixel driver | Adafruit Seesaw I2C (addr `0x60`, pin `15`) |
| Strip | 90 pixels, GRB order |
| I2C bus | `board.SCL1` / `board.SDA1` at 400 kHz |
| WiFi | 2.4 GHz only (ESP32-S2 does not support 5 GHz) |
| RAM | ~180 KB available to CircuitPython user code |

---

## Patterns

| ID | Label | Description |
|---|---|---|
| `fall` | AUTUMN | Warm red/orange/yellow autumn colors |
| `july` | LIBERTY | Patriotic red, white, and blue |
| `xmas` | HOLIDAY | Holiday red, green, and white sequence |
| `normal` | SPECTRUM | Full-spectrum rainbow and theater chase |
| `alert` | CAUTION | Solid warning yellow — used for scheduled alerts |
| `blue` | COBALT | Solid blue fill |
| `pink` | MAGENTA | Solid pink/magenta fill |
| `off` | STANDBY | All pixels off |

Patterns can also be selected by number (`0`–`6`, mapping to the order above excluding `off`).

---

## Project Structure

```
neopixel_control/
├── libraries/
│   ├── circuitpython_main.py     # Main program — deploy as code.py on CIRCUITPY
│   ├── config.py                 # WiFi + Adafruit.IO credentials (never commit)
│   ├── test_adafruit_io.py       # Network connectivity test script
│   ├── patterns/
│   │   ├── base_pattern.py       # BasePattern — shared animation primitives
│   │   ├── fall_pattern.py       # Autumn pattern
│   │   ├── july_pattern.py       # Patriotic pattern
│   │   ├── xmas_pattern.py       # Holiday pattern
│   │   ├── norm_pattern.py       # Rainbow / theater chase
│   │   ├── alert_pattern.py      # Warning yellow solid
│   │   ├── blue_pattern.py       # Blue solid
│   │   └── pink_pattern.py       # Pink/magenta solid
│   └── fallpattern/              # C++ reference implementations (do not modify)
│
├── frontend/                     # Next.js 14 web UI
│   └── src/app/
│       ├── page.tsx              # Main UI — pattern buttons, modals, settings
│       ├── globals.css           # CRT/phosphor design system
│       ├── layout.tsx            # Root layout (VT323 + Share Tech Mono fonts)
│       ├── components/
│       │   └── ScheduleModal.tsx # Scheduled alert management modal
│       └── api/
│           ├── pattern/route.ts  # POST — proxies commands to Adafruit.IO
│           └── schedules/route.ts # GET/POST — reads/writes schedules.json via GitHub API
│
├── .github/
│   ├── scripts/
│   │   └── fire_schedules.js     # Cron script: checks EST time, fires alert to AIO (manual use)
│   └── workflows/
│       ├── deploy.yml            # Deploys frontend to Azure SWA on push to main
│       └── schedule_alert.yml    # Manual dispatch only — cron replaced by Cloudflare Worker
│
├── worker/                       # Cloudflare Worker — scheduled alert cron
│   ├── wrangler.toml             # Worker config and cron trigger
│   └── src/
│       └── index.js              # Scheduled handler logic
│
├── infra/
│   ├── main.tf                   # Azure Static Web App + app settings
│   └── variables.tf              # Terraform input variables
│
├── neostrip/
│   └── neostrip.ino              # C++ Arduino reference (do not modify)
│
└── schedules.json                # Persistent schedule store (read/written via GitHub API)
```

---

## Setup

### 1. Adafruit.IO

1. Create a free account at [io.adafruit.com](https://io.adafruit.com)
2. Create a feed named exactly `neopixel-pattern`
3. Note your **username** and **AIO Key** (Profile → My Key)

See `libraries/ADAFRUIT_IO_SETUP.md` for a full walkthrough including dashboard configuration.

### 2. Device (CircuitPython)

**Required libraries** — copy to `/lib/` on the CIRCUITPY drive:
- `adafruit_requests`
- `adafruit_seesaw`

**Deploy files** — copy these to the CIRCUITPY drive root:

```
/CIRCUITPY/
├── code.py                 ← rename circuitpython_main.py to this
├── config.py               ← fill in your credentials
└── patterns/               ← entire patterns/ directory
    ├── __init__.py
    ├── base_pattern.py
    ├── fall_pattern.py
    ├── july_pattern.py
    ├── xmas_pattern.py
    ├── norm_pattern.py
    ├── alert_pattern.py
    ├── blue_pattern.py
    └── pink_pattern.py
```

**Configure `config.py`:**

```python
WIFI_SSID     = "your_wifi_ssid"       # 2.4 GHz only
WIFI_PASSWORD = "your_wifi_password"
AIO_USERNAME  = "your_aio_username"
AIO_KEY       = "your_aio_key"
AIO_FEED      = "neopixel-pattern"
NUM_PIXELS    = 90
```

**Test connectivity** before running the main program:

```bash
# Temporarily rename test_adafruit_io.py → code.py on the device
# Open a serial console at 115200 baud and check output
```

### 3. Frontend

**Prerequisites:** Node.js 18+, an Azure account, Terraform 1.3+

**Local development:**

```bash
cd frontend
npm install
npm run dev        # http://localhost:3000
```

**Infrastructure deployment (Azure Static Web App):**

```bash
cd infra
cp terraform.tfvars.example terraform.tfvars   # fill in secrets
terraform init
terraform apply -target=azurerm_static_web_app.main
# Note the output hostname, set your CNAME, then:
terraform apply
```

**GitHub Actions deployment** triggers automatically on every push to `main` via `.github/workflows/deploy.yml`.

**Required GitHub repository secrets:**

| Secret | Purpose |
|---|---|
| `GITHUB_PAT` | Fine-grained PAT — Contents read+write on this repo only |

**Required Azure SWA app settings** (set via Terraform or the portal):

| Setting | Purpose |
|---|---|
| `AIO_USERNAME` | Used by the `/api/pattern` server route |
| `AIO_KEY` | Used by the `/api/pattern` server route |
| `AIO_FEED` | Feed name |
| `GITHUB_PAT` | Used by `/api/schedules` to read/write `schedules.json` |
| `GITHUB_REPO` | Hard-coded to `ByronTechCoder/neopixel_control` in Terraform |

---

## Scheduled Alerts

The `alert` pattern can be triggered automatically on a time-based schedule configured from the frontend UI.

### How it works

1. **Frontend** — open the schedule modal (clock icon), add a schedule with a time in Eastern Time (5-minute increments only)
2. **`schedules.json`** — stored at the repo root; the frontend reads/writes it via the GitHub Contents API so no separate database is needed
3. **Cloudflare Worker** — `worker/src/index.js` runs on a `*/5 * * * *` cron with near-zero startup latency; fetches `schedules.json` from GitHub, checks the current EST time, and POSTs `alert` to Adafruit.IO for any matching enabled schedule
4. **Device** — picks up the `alert` command within 0.5 s and runs `AlertPattern` until manually changed

The GitHub Actions workflow `schedule_alert.yml` has `workflow_dispatch` only and can be used to manually test the `fire_schedules.js` script independently.

### Schedule data model

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
      "created_at": "2025-01-01T00:00:00.000Z",
      "last_fired_at": null
    }
  ]
}
```

- `time` — 24-hour `"HH:MM"` in **Eastern Time**, must be a 5-minute increment
- `month` / `day` / `year` — `null` means wildcard (matches any); integers match specifically
- `repeatable: false` — schedule disables itself after firing once
- `last_fired_at` — written back by the cron script; a 290-second guard window prevents double-firing across consecutive cron runs

### Cloudflare Worker setup

```bash
cd worker
npx wrangler login
npx wrangler deploy

# Set secrets (prompted for each value)
npx wrangler secret put AIO_USERNAME
npx wrangler secret put AIO_KEY
npx wrangler secret put GITHUB_TOKEN   # fine-grained PAT, Contents read+write
```

`AIO_FEED` and `GITHUB_REPO` are plain vars already set in `wrangler.toml`.

Confirm the cron registered in the Cloudflare dashboard: **Workers & Pages → neopixel-alert-scheduler → Triggers → Cron Triggers**.

### Local testing

```bash
cd worker
# Create worker/.dev.vars with AIO_USERNAME, AIO_KEY, GITHUB_TOKEN (gitignored)
npx wrangler dev --test-scheduled
# In a second terminal:
curl "http://localhost:8787/__scheduled?cron=*%2F5+*+*+*+*"
```

### Write-back safety

The worker re-fetches `schedules.json` from GitHub immediately before writing `last_fired_at`, so concurrent cron runs cannot overwrite each other's changes. Worker-generated commits include `[skip ci]` to prevent triggering the deploy workflow.

---

## Frontend UI

The web interface (`CHROMACORE-90`) uses a retro CRT phosphor terminal aesthetic.

- **Fonts:** VT323 (display) and Share Tech Mono (data readouts)
- **Themes:** Green phosphor (default) and amber phosphor — toggled in the UI
- **Pattern buttons** — each button sends a POST to `/api/pattern` which proxies to Adafruit.IO; the active pattern persists in `localStorage`
- **Settings modal** — override AIO credentials in-browser (stored in `localStorage`, never sent to the server except as the actual API call)
- **Schedule modal** — create, enable/disable, and delete scheduled alerts; changes persist immediately to `schedules.json` via the GitHub Contents API

---

## Communication Flow

```
1. User clicks pattern button in browser
2. Browser  →  POST /api/pattern  { pattern: "fall" }
3. Next.js API route  →  POST https://io.adafruit.com/api/v2/{user}/feeds/{feed}/data
4. Adafruit.IO stores value in feed
5. ESP32-S2 polls feed every 0.5 s  →  receives "fall"
6. Device calls pattern.reset() then runs pattern.update() each main loop iteration
7. NeoPixels display animation
```

---

## Troubleshooting

### Device not changing patterns

- Check serial output (115200 baud) for connection errors
- Confirm the feed name is exactly `neopixel-pattern`
- Verify WiFi is 2.4 GHz — the ESP32-S2 does not support 5 GHz
- Both HTTP 200 and 201 from Adafruit.IO are treated as success

### Scheduled alert not firing

- Confirm `AIO_USERNAME`, `AIO_KEY`, and `GITHUB_TOKEN` secrets are set on the Cloudflare Worker: `cd worker && npx wrangler secret list`
- Verify the cron trigger registered: Cloudflare dashboard → Workers & Pages → neopixel-alert-scheduler → Triggers → Cron Triggers (must show `*/5 * * * *`); if missing, re-run `npx wrangler deploy`
- Tail live worker logs to see errors: `cd worker && npx wrangler tail`
- Test locally without waiting for cron: `npx wrangler dev --test-scheduled` then `curl "http://localhost:8787/__scheduled?cron=*%2F5+*+*+*+*"` (requires `worker/.dev.vars`)
- The GitHub Actions workflow (`schedule_alert.yml`) can be triggered manually from the Actions tab for independent testing of the `fire_schedules.js` script

### Frontend not loading / API errors

- Check that all Azure SWA app settings are configured (AIO credentials + `GITHUB_PAT`)
- The `GITHUB_PAT` must be a fine-grained PAT with **Contents: read+write** scoped to this repo only
- Open browser DevTools → Network tab to inspect the exact error response from the API routes

### Memory issues on device

- Never create new dicts, lists, or tuples inside animation loops — all state is allocated in `__init__`
- After switching patterns, `gc.collect()` is called once to reclaim memory
- Avoid string formatting (`f"..."`) inside tight animation loops

---

## Development Notes

- **No threading or async** on CircuitPython — all animations must be non-blocking (step-based) so the main loop can check Adafruit.IO on every iteration
- **`time.sleep()` is prohibited inside pattern `update()` methods** — use `time.monotonic()` checks instead
- **C++ reference** — `neostrip/neostrip.ino` and `libraries/fallpattern/` are the authoritative behavior reference; do not modify them
- **Polling interval** — 0.5 s is the minimum acceptable; do not decrease it
- **Color values** — RGB tuples are matched exactly to the C++ source; do not alter without a confirmed bug
