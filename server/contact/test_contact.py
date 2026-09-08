#!/usr/bin/env python3
"""Arnes del endpoint de contacto.  Uso: npm run verify:contact

Levanta un Resend FALSO y el servicio real apuntando a el, asi se ejercita el
camino completo sin mandar un solo mail ni necesitar una API key de verdad.
"""
import importlib
import json
import os
import threading
import urllib.error
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

received: list = []
fail_next = {"on": False}


class MockResend(BaseHTTPRequestHandler):
    def log_message(self, *a): pass

    def do_POST(self):
        n = int(self.headers.get("Content-Length") or 0)
        body = json.loads(self.rfile.read(n)) if n else {}
        received.append({"body": body, "auth": self.headers.get("Authorization"),
                         "ua": self.headers.get("User-Agent")})
        if fail_next["on"]:
            self.send_response(403); self.send_header("Content-Length", "26"); self.end_headers()
            self.wfile.write(b'{"message":"not allowed"}\n')
            return
        out = b'{"id":"mock"}'
        self.send_response(200); self.send_header("Content-Length", str(len(out))); self.end_headers()
        self.wfile.write(out)


def free_port():
    import socket
    s = socket.socket(); s.bind(("127.0.0.1", 0)); p = s.getsockname()[1]; s.close(); return p


MOCK_PORT = free_port()
SVC_PORT = free_port()
threading.Thread(target=ThreadingHTTPServer(("127.0.0.1", MOCK_PORT), MockResend).serve_forever, daemon=True).start()

os.environ.update({
    "RESEND_API_KEY": "re_test_key",
    "CONTACT_TO": "destino@ejemplo.com",
    "CONTACT_FROM": "onboarding@resend.dev",
    "CONTACT_PORT": str(SVC_PORT),
    "RESEND_API_BASE": f"http://127.0.0.1:{MOCK_PORT}",
})
import sys, pathlib
sys.path.insert(0, str(pathlib.Path(__file__).parent))
svc = importlib.import_module("contact_svc")
threading.Thread(target=ThreadingHTTPServer(("127.0.0.1", SVC_PORT), svc.Handler).serve_forever, daemon=True).start()

BASE = f"http://127.0.0.1:{SVC_PORT}"
GOOD = {"name": "Ada", "email": "ada@ejemplo.com", "message": "Hola, quiero contratarte."}


def call(payload=None, path="/api/contact", method="POST", ip="1.2.3.4"):
    url = BASE + path
    if method == "GET":
        req = urllib.request.Request(url)
    else:
        req = urllib.request.Request(url, data=json.dumps(payload).encode(),
                                     headers={"Content-Type": "application/json",
                                              "X-Forwarded-For": ip}, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=10) as r:
            return r.status, json.loads(r.read() or b"{}")
    except urllib.error.HTTPError as e:
        try:    return e.code, json.loads(e.read() or b"{}")
        except Exception: return e.code, {}


results = []
def check(id_, name, ok, detail):
    results.append((id_, name, ok, detail))


# ── K1 · health ──────────────────────────────────────────────────────────
st, body = call(path="/api/contact/health", method="GET")
check("K1", "health responde y se ve configurado", st == 200 and body.get("configured") is True, f"{st} {body}")

# ── K2 · envio valido, con el payload correcto ───────────────────────────
received.clear(); svc._hits.clear()
st, body = call(GOOD)
sent = received[0]["body"] if received else {}
ok = (st == 200 and body.get("ok") is True and len(received) == 1
      and sent.get("to") == ["destino@ejemplo.com"]
      and sent.get("reply_to") == "ada@ejemplo.com"
      and "Ada" in sent.get("subject", "")
      and "quiero contratarte" in sent.get("text", "")
      and received[0]["auth"] == "Bearer re_test_key")
check("K2", "Envio valido llega a Resend", ok, f"{st} · reply_to={sent.get('reply_to')} · to={sent.get('to')}")

# ── K2b · User-Agent propio ──────────────────────────────────────────────
# La API de Resend esta detras de Cloudflare, que bloquea el UA por defecto de
# urllib con un 403 "error code: 1010". Sin este header no sale un solo mail.
ua = received[0]["ua"] if received else ""
check("K2b", "Manda User-Agent propio (Cloudflare)", bool(ua) and "urllib" not in ua.lower(), f"UA={ua!r}")

# ── K3 · honeypot: 200 al bot, pero NO se manda nada ─────────────────────
received.clear(); svc._hits.clear()
st, body = call({**GOOD, "website": "http://spam.example"})
check("K3", "Honeypot: finge exito y no envia", st == 200 and body.get("ok") is True and len(received) == 0,
      f"{st} · mails enviados: {len(received)}")

# ── K4 · validacion ──────────────────────────────────────────────────────
received.clear(); svc._hits.clear()
casos = {
    "sin nombre":        {**GOOD, "name": ""},
    "email invalido":    {**GOOD, "email": "no-es-un-email"},
    "sin mensaje":       {**GOOD, "message": "   "},
    "mensaje >5000":     {**GOOD, "message": "x" * 5001},
    "salto en nombre":   {**GOOD, "name": "Ada\nBcc: otro@x.com"},
    "nombre >100":       {**GOOD, "name": "x" * 101},
}
malos = [k for k, v in casos.items() if call(v)[0] != 400]
check("K4", "Rechaza entrada invalida", not malos and len(received) == 0,
      f"pasaron indebidamente: {malos}" if malos else f"{len(casos)} casos, todos 400, 0 mails")

# ── K5 · rate limit por IP ───────────────────────────────────────────────
received.clear(); svc._hits.clear()
codes = [call(GOOD, ip="9.9.9.9")[0] for _ in range(svc.RATE_MAX + 1)]
otra = call(GOOD, ip="8.8.8.8")[0]
check("K5", f"Rate limit por IP ({svc.RATE_MAX}/h)", codes[:-1] == [200]*svc.RATE_MAX and codes[-1] == 429 and otra == 200,
      f"misma IP {codes} · otra IP {otra}")

# ── K6 · error de Resend no se traga ─────────────────────────────────────
received.clear(); svc._hits.clear(); fail_next["on"] = True
st, body = call(GOOD)
fail_next["on"] = False
check("K6", "Falla de Resend devuelve 502", st == 502 and "error" in body, f"{st} {body}")

# ── K7 · rutas ajenas ────────────────────────────────────────────────────
check("K7", "Otras rutas dan 404", call(GOOD, path="/api/otra")[0] == 404 and call(path="/", method="GET")[0] == 404, "ok")

# ── K8 · sin configurar -> 503, nunca un 500 ─────────────────────────────
saved = svc.API_KEY
svc.API_KEY = ""
st, _ = call(GOOD)
svc.API_KEY = saved
check("K8", "Sin API key devuelve 503", st == 503, str(st))

print("\n  ENDPOINT DE CONTACTO — server/contact/contact_svc.py\n")
failed = 0
for id_, name, ok, detail in results:
    if not ok: failed += 1
    print(f"  {'✓' if ok else '✗'} {id_.ljust(4)} {name.ljust(38)} {detail}")
print(f"\n  {len(results) - failed}/{len(results)} en verde\n")
raise SystemExit(1 if failed else 0)
