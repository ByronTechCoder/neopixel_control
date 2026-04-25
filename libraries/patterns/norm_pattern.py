"""
Normal pattern — standard colors matching normpattern.cpp exactly.

Sequence (matches C++ start() while loop):
  Phase 0-2 : colorWipe RED / GREEN / BLUE           (50 ms/pixel)
  Phase 3-5 : theaterChase WHITE_HALF / RED_HALF / BLUE_HALF
              (10 j × 10 a × 3 b = 300 steps, clear-before-set, 50 ms/step)
  Phase 6   : rainbow (1280 steps, 10 ms/step)
  Phase 7   : theaterChaseRainbow (90 steps, 50 ms/step)
  → wraps back to phase 0

Color notes from normpattern.cpp:
  theaterChase white = Color(127,127,127)  — half brightness
  theaterChase red   = Color(127,0,0)      — half brightness
  theaterChase blue  = Color(0,0,127)      — half brightness
"""

from .base_pattern import BasePattern

_RED        = (255, 0, 0)
_GREEN      = (0, 255, 0)
_BLUE       = (0, 0, 255)
_WHITE_HALF = (127, 127, 127)
_RED_HALF   = (127, 0, 0)
_BLUE_HALF  = (0, 0, 127)
_OFF        = (0, 0, 0)

_WIPE_COLORS  = (_RED, _GREEN, _BLUE)
_CHASE_COLORS = (_WHITE_HALF, _RED_HALF, _BLUE_HALF)

_DELAY_WIPE  = 0.05
_DELAY_CHASE = 0.05
_DELAY_RAIN  = 0.013  # 10 ms C++ delay + ~3 ms C++ show() = 13 ms frame period
_DELAY_TCR   = 0.053  # 50 ms C++ delay + ~3 ms C++ show() = 53 ms frame period

_RAINBOW_STEPS = 5 * 65536 // 256   # 1280


class NormPattern(BasePattern):
    def __init__(self, pixels, num_pixels):
        super().__init__(pixels, num_pixels)
        self._phase = 0
        self._step = 0
        self._last_update = 0.0
        self._tcr_hue = 0   # first_pixel_hue for theaterChaseRainbow

    def reset(self):
        self._phase = 0
        self._step = 0
        self._last_update = 0.0
        self._tcr_hue = 0

    def update(self, now):
        p = self._phase

        # ── Phases 0-2: colorWipe (RED, GREEN, BLUE) ───────────────────────
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

        # ── Phases 3-5: theaterChase ────────────────────────────────────────
        # Matches normpattern.cpp: 10 j × 10 a × 3 b = 300 steps.
        # clear() called before each b-group (strip.clear in C++).
        elif p < 6:
            if now - self._last_update < _DELAY_CHASE:
                return
            color = _CHASE_COLORS[p - 3]
            b = self._step % 3
            self.pixels.fill(_OFF)
            for i in range(b, self.num_pixels, 3):
                self.pixels[i] = color
            self.pixels.show()
            self._step += 1
            self._last_update = now
            if self._step >= 300:   # 10 × 10 × 3
                self._phase += 1
                self._step = 0

        # ── Phase 6: rainbow ────────────────────────────────────────────────
        # Matches normpattern.cpp rainbow(10): 1280 steps at 13 ms each.
        # (C++ frame period = 10 ms delay + ~3 ms show = 13 ms; _DELAY_RAIN
        # absorbs this so Python period matches without step-advance.)
        elif p == 6:
            if now - self._last_update < _DELAY_RAIN:
                return
            first_pixel_hue = self._step * 256
            for i in range(self.num_pixels):
                pixel_hue = first_pixel_hue + (i * 65536 // self.num_pixels)
                self.pixels[i] = self.gamma32(self.hsv_to_rgb(pixel_hue, 255, 255))
            self.pixels.show()
            self._step += 1
            self._last_update = now
            if self._step >= _RAINBOW_STEPS:
                self._phase += 1
                self._step = 0

        # ── Phase 7: theaterChaseRainbow ────────────────────────────────────
        # Matches normpattern.cpp theaterChaseRainbow(50): 30 a × 3 b = 90 steps.
        # first_pixel_hue advances by 65536//90 per step.
        else:
            if now - self._last_update < _DELAY_TCR:
                return
            b = self._step % 3
            self.pixels.fill(_OFF)
            for c in range(b, self.num_pixels, 3):
                hue = self._tcr_hue + c * 65536 // self.num_pixels
                self.pixels[c] = self.gamma32(self.hsv_to_rgb(hue, 255, 255))
            self.pixels.show()
            self._tcr_hue += 65536 // 90
            self._step += 1
            self._last_update = now
            if self._step >= 90:   # 30 × 3
                self._phase = 0
                self._step = 0
                self._tcr_hue = 0
