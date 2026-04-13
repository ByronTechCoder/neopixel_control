"""
Fall pattern — autumn colors matching fallpattern.cpp exactly.

Sequence (matches C++ start() while loop):
  Phase 0-2 : colorWipe  RED / YELLOW / ORANGE   (50 ms/pixel)
  Phase 3-5 : theaterChase YELLOW / RED / ORANGE  (10 j × 3 q = 30 steps, 50 ms/step)
  Phase 6   : fallPattern1 — alternating R/O/Y per-3-pixels (90 iterations, 50 ms each)
  Phase 7   : fallPattern2 — 1000 random R/Y/O flashes (no per-step delay)
  → wraps back to phase 0
"""

import random
from .base_pattern import BasePattern

_RED    = (255, 0, 0)
_YELLOW = (255, 255, 15)
_ORANGE = (255, 35, 0)
_OFF    = (0, 0, 0)

_WIPE_COLORS   = (_RED, _YELLOW, _ORANGE)
_CHASE_COLORS  = (_YELLOW, _RED, _ORANGE)

_DELAY_WIPE  = 0.05   # 50 ms
_DELAY_CHASE = 0.05   # 50 ms
_DELAY_P1    = 0.05   # 50 ms


class FallPattern(BasePattern):
    def __init__(self, pixels, num_pixels):
        super().__init__(pixels, num_pixels)
        self._phase = 0
        self._step = 0
        self._last_update = 0.0
        self._r = 0
        self._o = 0
        self._y = 0

    def reset(self):
        self._phase = 0
        self._step = 0
        self._last_update = 0.0

    def update(self, now):
        p = self._phase

        # ── Phases 0-2: colorWipe (RED, YELLOW, ORANGE) ────────────────────
        if p < 3:
            if now - self._last_update < _DELAY_WIPE:
                return
            self.pixels[self._step] = _WIPE_COLORS[p]
            self.pixels.show()
            self._step += 1
            self._last_update = now
            if self._step >= self.num_pixels:
                self._phase += 1
                self._step = 0

        # ── Phases 3-5: theaterChase (YELLOW, RED, ORANGE) ─────────────────
        # Matches fallpattern.cpp: 10 outer × 3 q phases = 30 steps.
        # No clear before setting — chase runs on top of previous colorWipe.
        elif p < 6:
            if now - self._last_update < _DELAY_CHASE:
                return
            color = _CHASE_COLORS[p - 3]
            q = self._step % 3
            for i in range(q, self.num_pixels, 3):
                self.pixels[i] = color
            self.pixels.show()
            for i in range(q, self.num_pixels, 3):
                self.pixels[i] = _OFF
            self._step += 1
            self._last_update = now
            if self._step >= 30:   # 10 j × 3 q
                self._phase += 1
                self._step = 0

        # ── Phase 6: fallPattern1 ───────────────────────────────────────────
        # Matches fallpattern.cpp: loop runs num_pixels iterations.
        # r/o/y start at 0/1/2 and advance by 3 each iteration.
        # All three pixels set then one combined show per iteration.
        elif p == 6:
            if now - self._last_update < _DELAY_P1:
                return
            if self._step == 0:
                self._r = 0
                self._o = 1
                self._y = 2
            if self._r < self.num_pixels:
                self.pixels[self._r] = _RED
                self._r += 3
            if self._o < self.num_pixels:
                self.pixels[self._o] = _ORANGE
                self._o += 3
            if self._y < self.num_pixels:
                self.pixels[self._y] = _YELLOW
                self._y += 3
            self.pixels.show()
            self._step += 1
            self._last_update = now
            if self._step >= self.num_pixels:
                self._phase += 1
                self._step = 0

        # ── Phase 7: fallPattern2 ───────────────────────────────────────────
        # Matches fallpattern.cpp: 1000 iterations, no per-iteration delay.
        # Three random pixels set per iteration (3 shows in C++ → 1 here for
        # I2C efficiency; visual is identical at I2C speeds).
        else:
            self.pixels[random.randint(0, self.num_pixels - 1)] = _RED
            self.pixels[random.randint(0, self.num_pixels - 1)] = _YELLOW
            self.pixels[random.randint(0, self.num_pixels - 1)] = _ORANGE
            self.pixels.show()
            self._step += 1
            if self._step >= 1000:
                self._phase = 0
                self._step = 0
