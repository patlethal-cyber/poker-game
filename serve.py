#!/usr/bin/env python3
import http.server
import socketserver
import os
import sys

PORT = 8080

# Change to the directory where this script lives
os.chdir(os.path.dirname(os.path.abspath(sys.argv[0])))

class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        # Prevent module caching during development so edits show up on reload
        self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()

NoCacheHandler.extensions_map.update({'.js': 'application/javascript'})

socketserver.TCPServer.allow_reuse_address = True
with socketserver.TCPServer(("", PORT), NoCacheHandler) as httpd:
    print(f"Serving Texas Hold'em Poker at http://localhost:{PORT}")
    print("Press Ctrl+C to stop")
    httpd.serve_forever()
