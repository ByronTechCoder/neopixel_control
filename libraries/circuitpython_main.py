"""
CircuitPython NeoPixel Control for Adafruit ESP32-S2 Qtpy
Hardware: Seesaw I2C NeoPixel driver (addr 0x60, pin 15), 90 pixels.
Control:  Adafruit.IO dashboard via WiFi — see ADAFRUIT_IO_SETUP.md.

Deploy this file as code.py on the CIRCUITPY drive.
"""

import board
import busio
import time
import wifi
import socketpool
import ssl
import adafruit_requests
import supervisor
import gc
from adafruit_seesaw import seesaw
from adafruit_seesaw import neopixel as seesaw_neopixel

try:
    from config import (
        WIFI_SSID, WIFI_PASSWORD,
        AIO_USERNAME, AIO_KEY, AIO_FEED,
        NUM_PIXELS, PATTERN_NAMES,
    )
except ImportError:
    print("config.py not found — using defaults")
    WIFI_SSID = "your_wifi_ssid"
    WIFI_PASSWORD = "your_wifi_password"
    AIO_USERNAME = "your_adafruit_io_username"
    AIO_KEY = "your_adafruit_io_key"
    AIO_FEED = "neopixel-pattern"
    NUM_PIXELS = 90
    PATTERN_NAMES = ["fall", "july", "xmas", "normal", "alert", "blue", "pink"]

# ── Hardware setup ──────────────────────────────────────────────────────────
i2c = busio.I2C(board.SCL1, board.SDA1, frequency=400000)
ss = seesaw.Seesaw(i2c, addr=0x60)
pixels = seesaw_neopixel.NeoPixel(
    ss, 15, NUM_PIXELS,
    brightness=1.0,
    auto_write=False,
    pixel_order=seesaw_neopixel.GRB,
)

# ── Pattern imports ─────────────────────────────────────────────────────────
from patterns.fall_pattern import FallPattern
from patterns.july_pattern import JulyPattern
from patterns.xmas_pattern import XmasPattern
from patterns.norm_pattern import NormPattern
from patterns.alert_pattern import AlertPattern
from patterns.blue_pattern import BluePattern
from patterns.pink_pattern import PinkPattern

patterns = [
    FallPattern(pixels, NUM_PIXELS),
    JulyPattern(pixels, NUM_PIXELS),
    XmasPattern(pixels, NUM_PIXELS),
    NormPattern(pixels, NUM_PIXELS),
    AlertPattern(pixels, NUM_PIXELS),
    BluePattern(pixels, NUM_PIXELS),
    PinkPattern(pixels, NUM_PIXELS),
]

# ── Adafruit.IO state ───────────────────────────────────────────────────────
_requests = None
_aio_connected = False


def connect_wifi():
    print("Connecting to WiFi:", WIFI_SSID)
    try:
        wifi.radio.connect(WIFI_SSID, WIFI_PASSWORD)
        print("Connected:", wifi.radio.ipv4_address)
        return True
    except Exception as e:
        print("WiFi failed:", e)
        return False


def setup_adafruit_io():
    global _requests, _aio_connected
    if not connect_wifi():
        return False
    try:
        pool = socketpool.SocketPool(wifi.radio)
        _requests = adafruit_requests.Session(pool, ssl.create_default_context())
        _aio_connected = True
        print("Adafruit.IO session ready")
        return True
    except Exception as e:
        print("Adafruit.IO setup failed:", e)
        _aio_connected = False
        return False


def get_pattern_from_adafruit_io(current):
    if not _requests or not _aio_connected:
        return current
    try:
        url = (
            "https://io.adafruit.com/api/v2/"
            + AIO_USERNAME + "/feeds/" + AIO_FEED + "/data/last"
        )
        response = _requests.get(url, headers={"X-AIO-Key": AIO_KEY})
        if response.status_code == 200:
            value = response.json().get("value", "").lower().strip()
            if value == "off":
                return -1
            for i, name in enumerate(PATTERN_NAMES):
                if value == name:
                    return i
            try:
                n = int(value)
                if 0 <= n < len(patterns):
                    return n
            except ValueError:
                pass
    except Exception as e:
        print("AIO get error:", e)
    return current


def send_status_to_adafruit_io(pattern_name):
    if not _requests or not _aio_connected:
        return
    try:
        url = (
            "https://io.adafruit.com/api/v2/"
            + AIO_USERNAME + "/feeds/" + AIO_FEED + "/data"
        )
        headers = {"X-AIO-Key": AIO_KEY, "Content-Type": "application/json"}
        response = _requests.post(url, headers=headers, json={"value": pattern_name})
        if response.status_code in (200, 201):
            print("AIO status sent:", pattern_name)
        else:
            print("AIO status failed:", response.status_code)
    except Exception as e:
        print("AIO send error:", e)


def initialize_feed(current_index):
    if not _requests or not _aio_connected:
        return
    try:
        url = (
            "https://io.adafruit.com/api/v2/"
            + AIO_USERNAME + "/feeds/" + AIO_FEED + "/data/last"
        )
        response = _requests.get(url, headers={"X-AIO-Key": AIO_KEY})
        if response.status_code == 200:
            data = response.json()
            if not data or not data.get("value"):
                send_status_to_adafruit_io(PATTERN_NAMES[current_index])
                print("Feed initialised to:", PATTERN_NAMES[current_index])
    except Exception as e:
        print("AIO init error:", e)


# ── Main loop ───────────────────────────────────────────────────────────────

def main():
    global _aio_connected

    print("NeoPixel Control starting —", len(patterns), "patterns")

    if setup_adafruit_io():
        print("Adafruit.IO connected")
        initialize_feed(0)
    else:
        print("No Adafruit.IO — running default pattern")

    pixels.fill((0, 0, 0))
    pixels.show()

    current_index = 0
    last_check = 0.0
    check_interval = 2.0   # seconds between Adafruit.IO polls

    while True:
        now = time.monotonic()

        # ── Poll Adafruit.IO for pattern changes ────────────────────────────
        if now - last_check >= check_interval:
            new_index = get_pattern_from_adafruit_io(current_index)
            last_check = time.monotonic()   # refresh after network round-trip

            if new_index != current_index:
                current_index = new_index

                if current_index == -1:
                    print("Off")
                    pixels.fill((0, 0, 0))
                    pixels.show()
                else:
                    print("Switching to:", PATTERN_NAMES[current_index])
                    pixels.fill((0, 0, 0))
                    pixels.show()
                    time.sleep(0.2)
                    patterns[current_index].reset()
                    gc.collect()
                    if _aio_connected:
                        try:
                            send_status_to_adafruit_io(PATTERN_NAMES[current_index])
                        except Exception as e:
                            print("Status send error:", e)

        # ── Break on serial input (matches C++ Serial.available() > 0) ──────
        if supervisor.runtime.serial_bytes_available:
            break

        # ── Advance current pattern one non-blocking step ───────────────────
        if current_index >= 0:
            patterns[current_index].update(time.monotonic())


if __name__ == "__main__":
    main()
