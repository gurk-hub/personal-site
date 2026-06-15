"""Tiny dev server that disables caching, so page edits always show up.
(Plain `python -m http.server` lets browsers heuristically cache HTML, which
made navigation show stale pages during development.)
"""
import http.server
import socketserver

PORT = 8766


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()


socketserver.TCPServer.allow_reuse_address = True
with socketserver.TCPServer(("", PORT), NoCacheHandler) as httpd:
    print(f"Serving with no-cache headers on http://localhost:{PORT}")
    httpd.serve_forever()
