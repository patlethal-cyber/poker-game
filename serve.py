#!/usr/bin/env python3
import http.server
import socketserver
import os
import sys

PORT = 8080

# Change to the directory where this script lives
os.chdir(os.path.dirname(os.path.abspath(sys.argv[0])))

Handler = http.server.SimpleHTTPRequestHandler
Handler.extensions_map.update({'.js': 'application/javascript'})

socketserver.TCPServer.allow_reuse_address = True
with socketserver.TCPServer(("", PORT), Handler) as httpd:
    print(f"Serving Texas Hold'em Poker at http://localhost:{PORT}")
    print("Press Ctrl+C to stop")
    httpd.serve_forever()
