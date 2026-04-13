"""
July pattern — patriotic colors matching julypattern.cpp exactly.

Sequence (matches C++ start() while loop):
  Phase 0-2 : colorWipe  RED / WHITE / BLUE        (50 ms/pixel)
  Phase 3-5 : theaterChase WHITE / RED / BLUE       (10 j × 3 q = 30 steps, 50 ms/step)
  Phase 6   : julyPattern1 — alternating R/B/W per-3-pixels (90 iterations, 50 ms each)
  Phase 7   : julyPattern2 — 1000 random R/W/B flashes (no per-step delay)
  → wraps back to phase 0
"""

import random
from .base_pattern import BasePattern

_RED   = (255, 0, 0)
_WHITE = (255, 255, 255)
_BLUE  = (0, 0, 255)
_OFF   = (0, 0, 0)

_WIPE_COLORS  = (_RED, _WHITE, _BLUE)
_CHASE_COLORS = (_WHITE, _RED, _BLUE)

_DELAY_WIPE  = 0.05
_DELAY_CHASE = 0.05
_DELAY_P1    = 0.05


class JulyPattern(BasePattern):
    def __init__(self, pixels, num_pixels):
        super().__init__(pixels, num_pixels)
        self._phase = 0
        self._step = 0
        self._last_update = 0.0
        self._r = 0
        self._b = 0
        self._w = 0

    def reset(self):
        self._phase = 0
        self._step = 0
        self._last_update = 0.0

    def update(self, now):
        p = self._phase

        # ── Phases 0-2: colorWipe (RED, WHITE, BLUE) ───────────────────────
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

        # ── Phases 3-5: theaterChase (WHITE, RED, BLUE) ────────────────────
        # Matches julypattern.cpp: 10 outer × 3 q = 30 steps, no prior clear.
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
            if self._step >= 30:
                self._phase += 1
                self._step = 0

        # ── Phase 6: julyPattern1 ───────────────────────────────────────────
        # Matches julypattern.cpp: r=red, b=blue, w=white, 90 iterations.
        elif p == 6:
            if now - self._last_update < _DELAY_P1:
                return
            if self._step == 0:
                self._r = 0
                self._b = 1
                self._w = 2
            if self._r < self.num_pixels:
                self.pixels[self._r] = _RED
                self._r += 3
            if self._b < self.num_pixels:
                self.pixels[self._b] = _BLUE
                self._b += 3
            if self._w < self.num_pixels:
                self.pixels[self._w] = _WHITE
                self._w += 3
            self.pixels.show()
            self._step += 1
            self._last_update = now
            if self._step >= self.num_pixels:
                self._phase += 1
                self._step = 0

        # ── Phase 7: julyPattern2 ───────────────────────────────────────────
        # Matches julypattern.cpp: 1000 iterations, no per-iteration delay.
        else:
            self.pixels[random.randint(0, self.num_pixels - 1)] = _RED
            self.pixels[random.randint(0, self.num_pixels - 1)] = _WHITE
            self.pixels[random.randint(0, self.num_pixels - 1)] = _BLUE
            self.pixels.show()
            self._step += 1
            if self._step >= 1000:
                self._phase = 0
                self._step = 0
