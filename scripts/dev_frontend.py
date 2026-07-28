#!/usr/bin/env python3
"""Dev server for ntfy-alerts-panel frontend.

Serves the frontend directory with no-cache and CORS headers
so you can iterate on the JS without restarting Home Assistant.

Usage:
    python3 scripts/dev_frontend.py

Then in another terminal, start HA with:
    NTFY_DEV_URL=http://localhost:8000/ntfy-alerts-panel.js hass ...

Or if HA is containerized, set the env var on the container.
After the one-time HA restart to pick up the dev URL, just refresh
the browser after each JS edit — no more HA restarts for frontend work.
"""

import os
import sys
import time
import webbrowser
import threading
from http.server import HTTPServer, SimpleHTTPRequestHandler

PORT = int(os.environ.get("NTFY_DEV_PORT", 8000))

FRONTEND_DIR = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
    "custom_components",
    "ntfy_alerts",
    "frontend",
)


class DevHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=FRONTEND_DIR, **kwargs)

    def end_headers(self):
        self.send_header("Cache-Control", "no-cache, no-store, must-revalidate")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        self.send_header("Access-Control-Allow-Origin", "*")
        super().end_headers()

    def log_message(self, format, *args):
        sys.stderr.write(f"[dev] {self.address_string()} - {format % args}\n")


def watch_files(interval=1.0):
    last_mtime = {}
    while True:
        for fname in os.listdir(FRONTEND_DIR):
            fpath = os.path.join(FRONTEND_DIR, fname)
            if not os.path.isfile(fpath):
                continue
            mtime = os.stat(fpath).st_mtime
            last = last_mtime.get(fname)
            if last is not None and mtime > last:
                print(f"\n  [changed] {fname} — refresh the browser\n", flush=True)
            last_mtime[fname] = mtime
        time.sleep(interval)


def main():
    server = HTTPServer(("0.0.0.0", PORT), DevHandler)

    watcher = threading.Thread(target=watch_files, daemon=True)
    watcher.start()

    print(f"\n  ntfy Alerts dev server → http://localhost:{PORT}/")
    print(f"  Serving: {FRONTEND_DIR}")
    print(f"  Set NTFY_DEV_URL=http://localhost:{PORT}/ntfy-alerts-panel.js")
    print(f"  and restart HA once. Then just refresh the browser after each edit.\n")
    print(f"  Opening test panel in browser...\n")

    webbrowser.open(f"http://localhost:{PORT}/test_panel.html")

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n  Shutting down.")


if __name__ == "__main__":
    main()
