"""
Base pattern class — provides only shared math helpers.
All animation logic lives in subclasses.
"""

import random


class BasePattern:
    def __init__(self, pixels, num_pixels):
        self.pixels = pixels
        self.num_pixels = num_pixels

    def reset(self):
        raise NotImplementedError

    def update(self, now):
        raise NotImplementedError

    @staticmethod
    def wheel(pos):
        pos = pos & 255
        if pos < 85:
            return (pos * 3, 255 - pos * 3, 0)
        if pos < 170:
            pos -= 85
            return (255 - pos * 3, 0, pos * 3)
        pos -= 170
        return (0, pos * 3, 255 - pos * 3)

    @staticmethod
    def hsv_to_rgb(h, s, v):
        h = (h >> 8) & 255
        if s == 0:
            return (v, v, v)
        sector = h // 43
        f = ((h % 43) * 6) // 256
        p = (v * (255 - s)) // 255
        q = (v * (255 - ((s * f) // 256))) // 255
        t = (v * (255 - ((s * (255 - f)) // 256))) // 255
        if sector == 0:
            return (v, t, p)
        if sector == 1:
            return (q, v, p)
        if sector == 2:
            return (p, v, t)
        if sector == 3:
            return (p, q, v)
        if sector == 4:
            return (t, p, v)
        return (v, p, q)
