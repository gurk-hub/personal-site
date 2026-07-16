"""Tiny dev server that disables caching, so page edits always show up.
(Plain `python -m http.server` lets browsers heuristically cache HTML, which
made navigation show stale pages during development.)

Threaded on purpose: the previous single-threaded TCPServer served one request at a time, so a
page that kept a connection open (or a wedged tab) blocked *every* later request and looked like
the whole server had died. Also binds both IPv4 and IPv6, since "localhost" resolves to ::1 first
on Windows and an IPv4-only bind refused those connections.
"""
import http.server
import socket
import threading

PORT = 8766


class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()

    def log_message(self, fmt, *args):
        # Keep the noise down but keep errors visible.
        if not str(args[0]).startswith(("GET", "HEAD")) or " 200 " not in " ".join(str(a) for a in args):
            super().log_message(fmt, *args)


class DualStackServer(http.server.ThreadingHTTPServer):
    daemon_threads = True
    allow_reuse_address = True
    address_family = socket.AF_INET6 if socket.has_ipv6 else socket.AF_INET

    def server_bind(self):
        # Accept IPv4 too (::ffff:127.0.0.1), so both localhost and 127.0.0.1 work.
        if self.address_family == socket.AF_INET6:
            try:
                self.socket.setsockopt(socket.IPPROTO_IPV6, socket.IPV6_V6ONLY, 0)
            except OSError:
                pass
        super().server_bind()


if __name__ == "__main__":
    with DualStackServer(("", PORT), NoCacheHandler) as httpd:
        print(f"Serving with no-cache headers on http://localhost:{PORT}")
        httpd.serve_forever()
