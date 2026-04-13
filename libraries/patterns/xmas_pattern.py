"""
Christmas pattern — holiday colors matching xmaspattern.cpp exactly.

Brightness=1 in C++ means Full=255 for all colors.

Phase sequence (matches C++ start() while loop):
   0  CandyCane(30, 8, 50)          — 240 steps, 50 ms/step
   1  RainbowStripe(5, 4, 75)       — 120 steps, 75 ms/step
   2  RandomWhite(50, 200)          — 50 steps,  200 ms/step
   3  RandomColor(50, 200)          — 50 steps,  200 ms/step
   4  colorWipe RED      50 ms      — 90 steps
   5  colorWipe YELLOW   50 ms
   6  colorWipe GREEN    50 ms
   7  colorWipe CYAN     50 ms
   8  colorWipe BLUE     50 ms
   9  colorWipe MAGENTA  50 ms
  10  rainbowCycle(10, 2)            — 2560 steps, 2 ms/step
  11  alternateColor RED/GREEN x40   — 80 steps, 100 ms/step
  12  randomColorFill(10)            — variable steps, 10 ms/step
  13  randomPositionFill BLUE  50 ms — up to 89 steps
  14  randomPositionFill GREEN 50 ms
  15  randomPositionFill MAGENTA 50 ms
  16  randomPositionFill RED   50 ms
  17  randomPositionFill YELLOW 50 ms
  18  middleFill RED    50 ms       — 90 steps (45 in + 45 out)
  19  middleFill YELLOW 50 ms
  20  middleFill WHITE  50 ms
  21  middleFill GREEN  50 ms
  22  middleFill MAGENTA 50 ms
  23  middleFill CYAN   50 ms
  24  sideFill RED    50 ms
  25  sideFill YELLOW 50 ms
  26  sideFill RED    50 ms
  27  sideFill YELLOW 50 ms
  28  sideFill WHITE  50 ms
  29  sideFill GREEN  50 ms
  30  sideFill MAGENTA 50 ms
  31  sideFill CYAN   50 ms
  32  colorWipe BLACK 5 ms
  → wraps back to phase 0
"""

import random
from .base_pattern import BasePattern

_RED     = (255, 0, 0)
_YELLOW  = (255, 255, 0)
_GREEN   = (0, 255, 0)
_CYAN    = (0, 255, 255)
_BLUE    = (0, 0, 255)
_MAGENTA = (255, 0, 255)
_WHITE   = (255, 255, 255)
_OFF     = (0, 0, 0)

# Phase 4..9: colorWipe colors
_WIPE_COLORS = (_RED, _YELLOW, _GREEN, _CYAN, _BLUE, _MAGENTA)

# Phase 13..17: randomPositionFill colors (BLUE, GREEN, MAGENTA, RED, YELLOW)
_RPF_COLORS = (_BLUE, _GREEN, _MAGENTA, _RED, _YELLOW)

# Phase 18..23: middleFill colors
_MF_COLORS = (_RED, _YELLOW, _WHITE, _GREEN, _MAGENTA, _CYAN)

# Phase 24..31: sideFill colors
_SF_COLORS = (_RED, _YELLOW, _RED, _YELLOW, _WHITE, _GREEN, _MAGENTA, _CYAN)


class XmasPattern(BasePattern):
    def __init__(self, pixels, num_pixels):
        super().__init__(pixels, num_pixels)
        # Pre-allocate all state to avoid heap churn
        self._phase = 0
        self._step = 0
        self._last_update = 0.0
        self._used = bytearray(num_pixels)   # for randomPositionFill
        self._rpf_lights = 0
        self._cf_i = 0       # randomColorFill outer index
        self._cf_j = 0       # randomColorFill inner index
        self._cf_r = 0
        self._cf_g = 0
        self._cf_b = 0
        self._fill_sub = 0   # 0=filling in, 1=clearing out (for mid/side fill)
        self._fill_i = 0     # pixel index within fill sub-phase

    def reset(self):
        self._phase = 0
        self._step = 0
        self._last_update = 0.0
        self._rpf_lights = 0
        self._cf_i = 0
        self._cf_j = 0
        self._fill_sub = 0
        self._fill_i = 0

    def update(self, now):
        p = self._phase

        # ── Phase 0: CandyCane(30, 8, 50) ──────────────────────────────────
        # Outer j = _step, 0..239.  Inner: set all pixels based on stripe math.
        if p == 0:
            if now - self._last_update < 0.05:
                return
            j = self._step
            for i in range(self.num_pixels):
                L = self.num_pixels - i - 1
                if ((i + j) % 16) < 8:       # width=8, width*2=16
                    self.pixels[L] = _RED
                else:
                    self.pixels[L] = _WHITE
            self.pixels.show()
            self._step += 1
            self._last_update = now
            if self._step >= 240:             # 30 sets × 8 width
                self._phase += 1
                self._step = 0

        # ── Phase 1: RainbowStripe(5, 4, 75) ───────────────────────────────
        # Outer j = _step, 0..119.  Width=4, 6 colors.
        elif p == 1:
            if now - self._last_update < 0.075:
                return
            j = self._step
            for i in range(self.num_pixels):
                L = self.num_pixels - i - 1
                idx = ((i + j) // 4) % 6
                if idx == 0:
                    self.pixels[L] = _RED
                elif idx == 1:
                    self.pixels[L] = _YELLOW
                elif idx == 2:
                    self.pixels[L] = _GREEN
                elif idx == 3:
                    self.pixels[L] = _CYAN
                elif idx == 4:
                    self.pixels[L] = _BLUE
                else:
                    self.pixels[L] = _MAGENTA
            self.pixels.show()
            self._step += 1
            self._last_update = now
            if self._step >= 120:             # 5 × 4 × 6
                self._phase += 1
                self._step = 0

        # ── Phase 2: RandomWhite(50, 200) ───────────────────────────────────
        # 50 frames; each frame sets all pixels to random greyscale, then show.
        elif p == 2:
            if now - self._last_update < 0.2:
                return
            for j in range(self.num_pixels):
                v = random.randint(0, 255)
                self.pixels[j] = (v, v, v)
            self.pixels.show()
            self._step += 1
            self._last_update = now
            if self._step >= 50:
                self._phase += 1
                self._step = 0

        # ── Phase 3: RandomColor(50, 200) ───────────────────────────────────
        elif p == 3:
            if now - self._last_update < 0.2:
                return
            for j in range(self.num_pixels):
                self.pixels[j] = (
                    random.randint(0, 255),
                    random.randint(0, 255),
                    random.randint(0, 255),
                )
            self.pixels.show()
            self._step += 1
            self._last_update = now
            if self._step >= 50:
                self._phase += 1
                self._step = 0

        # ── Phases 4-9: colorWipe (RED, YELLOW, GREEN, CYAN, BLUE, MAGENTA) ─
        elif p < 10:
            if now - self._last_update < 0.05:
                return
            self.pixels[self._step] = _WIPE_COLORS[p - 4]
            self.pixels.show()
            self._step += 1
            self._last_update = now
            if self._step >= self.num_pixels:
                self._phase += 1
                self._step = 0

        # ── Phase 10: rainbowCycle(10, 2) ───────────────────────────────────
        # 256*10=2560 steps at 2 ms each.
        # Pixels rendered in reverse order to match C++ (numPixels-i-1).
        # C++ frame period = 2 ms delay + ~3 ms show = 5 ms; use 0.005 here
        # so Python frame period matches without step-advance.
        elif p == 10:
            if now - self._last_update < 0.005:
                return
            j = self._step
            for i in range(self.num_pixels):
                L = self.num_pixels - i - 1
                self.pixels[L] = self.wheel(((i * 256 // self.num_pixels) + j) & 255)
            self.pixels.show()
            self._step += 1
            self._last_update = now
            if self._step >= 2560:            # 256 × 10
                self._phase += 1
                self._step = 0

        # ── Phase 11: alternateColor RED/GREEN × 40 calls = 80 steps ────────
        # Each step: fill even/odd pixels with RED or GREEN and show.
        # call_num = step//2; sub = step%2
        # call even (0,2,4,...): c1=RED, c2=GREEN  → sub=0: R/G; sub=1: G/R
        # call odd  (1,3,5,...): c1=GREEN, c2=RED  → sub=0: G/R; sub=1: R/G
        elif p == 11:
            if now - self._last_update < 0.1:
                return
            call_num = self._step // 2
            sub = self._step % 2
            c1_red = (call_num % 2 == 0)    # True → c1=RED; False → c1=GREEN
            if c1_red:
                even_color = _RED if sub == 0 else _GREEN
                odd_color  = _GREEN if sub == 0 else _RED
            else:
                even_color = _GREEN if sub == 0 else _RED
                odd_color  = _RED if sub == 0 else _GREEN
            for i in range(self.num_pixels):
                self.pixels[i] = even_color if i % 2 == 0 else odd_color
            self.pixels.show()
            self._step += 1
            self._last_update = now
            if self._step >= 80:             # 40 calls × 2 sub-steps
                self._phase += 1
                self._step = 0

        # ── Phase 12: randomColorFill(10) ───────────────────────────────────
        # Outer i=0..89, inner j=0..numPixels-i-1.
        # Each step: turn off j-1 (skip when j==0), turn on j, show.
        # No step-advance here — each step sets a specific pixel sequentially.
        elif p == 12:
            if now - self._last_update < 0.01:
                return
            if self._cf_j == 0:
                # Start of new outer iteration: pick a random color
                self._cf_r = random.randint(0, 255)
                self._cf_g = random.randint(0, 255)
                self._cf_b = random.randint(0, 255)
            # Turn off previous pixel (j-1), skip when j==0 (would be pixel -1
            # which is out of bounds in C++ uint16 → no-op)
            if self._cf_j > 0:
                self.pixels[self._cf_j - 1] = _OFF
            self.pixels[self._cf_j] = (self._cf_r, self._cf_g, self._cf_b)
            self.pixels.show()
            self._cf_j += 1
            self._last_update = now
            if self._cf_j >= self.num_pixels - self._cf_i:
                self._cf_j = 0
                self._cf_i += 1
            if self._cf_i >= self.num_pixels:
                self._cf_i = 0
                self._phase += 1
                self._step = 0

        # ── Phases 13-17: randomPositionFill ────────────────────────────────
        # Each phase fills a different color; up to 89 pixels lit.
        # On phase entry (_step==0) reset the used array and lights counter.
        elif p < 18:
            if now - self._last_update < 0.05:
                return
            if self._step == 0:
                for k in range(self.num_pixels):
                    self._used[k] = 0
                self._rpf_lights = 0
            j = random.randint(0, self.num_pixels - 1)
            if self._used[j] == 0:
                self.pixels[j] = _RPF_COLORS[p - 13]
                self._used[j] = 1
                self._rpf_lights += 1
                self.pixels.show()
                self._step += 1
                self._last_update = now
            if self._rpf_lights >= self.num_pixels - 1:
                self._phase += 1
                self._step = 0

        # ── Phases 18-23: middleFill ─────────────────────────────────────────
        # Each phase fills from the middle out then clears from the sides in.
        # _fill_sub=0: fill in (45 steps); _fill_sub=1: clear out (45 steps)
        elif p < 24:
            if now - self._last_update < 0.05:
                return
            color = _MF_COLORS[p - 18]
            half = self.num_pixels // 2     # 45
            if self._fill_sub == 0:
                # Fill from centre outward: pixels[45+i] and pixels[45-i]
                self.pixels[half + self._fill_i] = color
                self.pixels[half - self._fill_i] = color
                self.pixels.show()
                self._fill_i += 1
                self._last_update = now
                if self._fill_i >= half:
                    self._fill_sub = 1
                    self._fill_i = 0
            else:
                # Clear from left/right sides inward (matches C++ second loop).
                # C++ sets pixels[i] and pixels[numPixels-i] — pixel[90] is
                # out of bounds and silently ignored.
                self.pixels[self._fill_i] = _OFF
                idx2 = self.num_pixels - self._fill_i
                if idx2 < self.num_pixels:
                    self.pixels[idx2] = _OFF
                self.pixels.show()
                self._fill_i += 1
                self._last_update = now
                if self._fill_i >= half:
                    self._fill_sub = 0
                    self._fill_i = 0
                    self._phase += 1
                    self._step = 0

        # ── Phases 24-31: sideFill ───────────────────────────────────────────
        # Fill from sides inward then clear from centre outward.
        # _fill_sub=0: fill (45 steps); _fill_sub=1: clear (45 steps)
        elif p < 32:
            if now - self._last_update < 0.05:
                return
            color = _SF_COLORS[p - 24]
            half = self.num_pixels // 2     # 45
            if self._fill_sub == 0:
                # Fill from edges inward: pixels[i] and pixels[numPixels-i].
                # pixels[numPixels-0]=pixels[90] is out of bounds → skip.
                self.pixels[self._fill_i] = color
                idx2 = self.num_pixels - self._fill_i
                if idx2 < self.num_pixels:
                    self.pixels[idx2] = color
                self.pixels.show()
                self._fill_i += 1
                self._last_update = now
                if self._fill_i >= half:
                    self._fill_sub = 1
                    self._fill_i = 0
            else:
                # Clear from centre outward: pixels[45+i] and pixels[45-i]
                self.pixels[half + self._fill_i] = _OFF
                self.pixels[half - self._fill_i] = _OFF
                self.pixels.show()
                self._fill_i += 1
                self._last_update = now
                if self._fill_i >= half:
                    self._fill_sub = 0
                    self._fill_i = 0
                    self._phase += 1
                    self._step = 0

        # ── Phase 32: colorWipe BLACK (5 ms) ────────────────────────────────
        else:
            if now - self._last_update < 0.005:
                return
            self.pixels[self._step] = _OFF
            self.pixels.show()
            self._step += 1
            self._last_update = now
            if self._step >= self.num_pixels:
                self._phase = 0
                self._step = 0
                self._cf_i = 0
                self._cf_j = 0
