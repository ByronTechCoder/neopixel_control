"""
Alert pattern — warning yellow matching alertpattern.cpp exactly.

Sequence (matches C++ start() while loop):
  Repeating colorWipe YELLOW (50 ms/pixel)
"""

from .base_pattern import BasePattern

_YELLOW = (255, 255, 0)
_DELAY  = 0.05   # 50 ms


class AlertPattern(BasePattern):
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
        self.pixels[self._step] = _YELLOW
        self.pixels.show()
        self._step += 1
        self._last_update = now
        if self._step >= self.num_pixels:
            self._step = 0
