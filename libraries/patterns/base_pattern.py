"""
Base pattern class — provides only shared math helpers.
All animation logic lives in subclasses.
"""

# Adafruit NeoPixel gamma-correction table (γ ≈ 2.6).
# Used by gamma32() to match C++ strip.gamma32(strip.ColorHSV(...)) output.
_GAMMA8 = bytes([
      0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,
      0,  0,  0,  0,  0,  0,  0,  0,  1,  1,  1,  1,  1,  1,  1,  1,
      1,  1,  1,  1,  2,  2,  2,  2,  2,  2,  2,  2,  3,  3,  3,  3,
      3,  3,  4,  4,  4,  4,  5,  5,  5,  5,  5,  6,  6,  6,  6,  7,
      7,  7,  8,  8,  8,  9,  9,  9, 10, 10, 10, 11, 11, 11, 12, 12,
     13, 13, 13, 14, 14, 15, 15, 16, 16, 17, 17, 18, 18, 19, 19, 20,
     20, 21, 21, 22, 22, 23, 24, 24, 25, 25, 26, 27, 27, 28, 29, 29,
     30, 31, 31, 32, 33, 34, 34, 35, 36, 37, 38, 38, 39, 40, 41, 42,
     42, 43, 44, 45, 46, 47, 48, 49, 50, 51, 52, 53, 54, 55, 56, 57,
     58, 59, 60, 61, 62, 63, 64, 65, 66, 68, 69, 70, 71, 72, 73, 75,
     76, 77, 78, 80, 81, 82, 84, 85, 86, 88, 89, 90, 92, 93, 94, 96,
     97, 99,100,102,103,105,106,108,109,111,112,114,115,117,119,120,
    122,124,125,127,129,130,132,134,135,137,139,141,142,144,146,148,
    150,151,153,155,157,159,161,163,165,167,169,171,173,175,177,179,
    181,183,185,187,189,192,194,196,198,200,203,205,207,209,212,214,
    216,218,221,223,226,228,230,233,235,238,240,243,245,248,250,253,
])


class BasePattern:
    def __init__(self, pixels, num_pixels):
        self.pixels = pixels
        self.num_pixels = num_pixels

    def reset(self):
        raise NotImplementedError

    def update(self, now):
        raise NotImplementedError

    @staticmethod
    def gamma32(rgb):
        return (_GAMMA8[rgb[0]], _GAMMA8[rgb[1]], _GAMMA8[rgb[2]])

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
