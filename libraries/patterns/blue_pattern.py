"""
Blue pattern — blue fill matching blue.cpp exactly.

Sequence (matches C++ start() while loop):
  Repeating colorWipe BLUE (255 ms/pixel)
"""

from .base_pattern import BasePattern

_BLUE  = (0, 0, 255)
_DELAY = 0.255   # 255 ms


class BluePattern(BasePattern):
    def __init__(self, pixels, num_pixels):
        super().__init__(pixels, num_pixels)
        self._step = 0
        self._last_update = 0.0

    def reset(self):
        self._step = 0
        self._last_update = 0.0

    def update(self, now):
        if now - self._last_update < _DELAY:
            return
        self.pixels[self._step] = _BLUE
        self.pixels.show()
        self._step += 1
        self._last_update = now
        if self._step >= self.num_pixels:
            self._step = 0
