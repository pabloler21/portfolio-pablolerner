#!/usr/bin/env python3
"""Endpoint del formulario de contacto de pablolerner.dev.

Manda el mensaje por Resend. Existe porque el sitio es estatico y la API key
de Resend es un secreto: no puede vivir en el JS del navegador.

SOLO STDLIB, a proposito. El VPS tiene 1 GB de RAM y todo lo demas duerme
hasta que alguien entra; este servicio no puede dormir (el POST del
formulario caeria en la pantalla de espera), asi que queda siempre encendido
y tiene que pesar lo minimo. Python de stdlib idlea en ~15 MB; Node, en ~50.

Configuracion por entorno (ver contact-svc.service):
  RESEND_API_KEY   obligatoria
  CONTACT_TO       destino de los mensajes
  CONTACT_FROM     remitente. Con el dominio sin verificar en Resend tiene
                   que ser onboarding@resend.dev, y entonces CONTACT_TO solo
                   puede ser la casilla duena de la cuenta. Verificado el
                   dominio, pasa a algo como contacto@pablolerner.dev
  CONTACT_PORT     por defecto 8110
  RESEND_API_BASE  para apuntar a un mock en los tests
"""
import json
import os
import re
import sys
import time
import urllib.error
import urllib.request
from collections import deque
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

PORT = int(os.environ.get("CONTACT_PORT", "8110"))
API_KEY = os.environ.get("RESEND_API_KEY", "")
TO = os.environ.get("CONTACT_TO", "")
FROM = os.environ.get("CONTACT_FROM", "onboarding@resend.dev")
API_BASE = os.environ.get("RESEND_API_BASE", "https://api.resend.com")

MAX_BODY = 16 * 1024          # el mensaje mas largo aceptado son 5000 chars
RATE_MAX = 5                  # envios por IP...
RATE_WINDOW = 3600            # ...por hora
EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s.]+\.[^@\s]+$")

_hits: dict[str, deque] = {}


def rate_limited(ip: str) -> bool:
    now = time.time()
    q = _hits.setdefault(ip, deque())
    while q and now - q[0] > RATE_WINDOW:
        q.popleft()
    if len(q) >= RATE_MAX:
        return True
    q.append(now)
    return False


def validate(data: dict) -> tuple[dict | None, str | None]:
    """Devuelve (campos limpios, error). El honeypot se trata como exito
    silencioso: al bot no se le avisa que lo detectamos."""
    if not isinstance(data, dict):
        return None, "cuerpo invalido"
    if (data.get("website") or "").strip():
        return None, "__honeypot__"

    name = (data.get("name") or "").strip()
    email = (data.get("email") or "").strip()
    message = (data.get("message") or "").strip()

    if not 1 <= len(name) <= 100:
        return None, "nombre invalido"
    if len(email) > 200 or not EMAIL_RE.match(email):
        return None, "email invalido"
    if not 1 <= len(message) <= 5000:
        return None, "mensaje invalido"
    # Los headers se arman aparte, pero un salto de linea en un campo que
    # termina en el asunto es la receta de la inyeccion de cabeceras.
    if "\n" in name or "\r" in name or "\n" in email or "\r" in email:
        return None, "campos invalidos"
    return {"name": name, "email": email, "message": message}, None


def send(fields: dict) -> tuple[bool, str]:
    payload = json.dumps({
        "from": f"pablolerner.dev <{FROM}>",
        "to": [TO],
        "reply_to": fields["email"],          # responder le contesta al visitante
        "subject": f"[pablolerner.dev] {fields['name']}",
        "text": (
            f"De: {fields['name']} <{fields['email']}>\n"
            f"{'-' * 48}\n\n{fields['message']}\n"
        ),
    }).encode()
    req = urllib.request.Request(
        f"{API_BASE}/emails",
        data=payload,
        headers={"Authorization": f"Bearer {API_KEY}", "Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=15) as r:
            return 200 <= r.status < 300, ""
    except urllib.error.HTTPError as e:
        # El cuerpo de Resend se registra porque dice POR QUE rechazo (dominio
        # sin verificar, destino no permitido). La key nunca se registra.
        return False, f"resend {e.code}: {e.read()[:300].decode('utf8', 'replace')}"
    except Exception as e:
        return False, f"{type(e).__name__}: {e}"


class Handler(BaseHTTPRequestHandler):
    server_version = "contact-svc"
    sys_version = ""

    def log_message(self, fmt, *args):
        # El log por defecto imprime la linea de request entera. Acá no hay
        # querystring con datos, pero se acota igual a una linea propia.
        sys.stderr.write("  %s %s\n" % (self.address_string(), fmt % args))

    def _json(self, code: int, obj: dict):
        body = json.dumps(obj).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def client_ip(self) -> str:
        # Detras de Caddy siempre hay X-Forwarded-For; el primero es el cliente.
        xff = self.headers.get("X-Forwarded-For", "")
        return xff.split(",")[0].strip() if xff else self.client_address[0]

    def do_GET(self):
        if self.path == "/api/contact/health":
            self._json(200, {"ok": True, "configured": bool(API_KEY and TO)})
        else:
            self._json(404, {"error": "not found"})

    def do_POST(self):
        # El cuerpo se lee SIEMPRE y ANTES de decidir, incluso para responder
        # 404 o 503. Contestar sin leerlo deja bytes en el buffer del socket, y
        # al cerrar la conexion el kernel manda RST: el cliente ve un corte
        # ("connection reset") en lugar del codigo que le mandamos. Depende de
        # una carrera, asi que falla de a ratos — que es la peor forma.
        try:
            length = int(self.headers.get("Content-Length") or 0)
        except ValueError:
            length = 0
        raw = self.rfile.read(min(max(length, 0), MAX_BODY + 1))

        if self.path != "/api/contact":
            self._json(404, {"error": "not found"})
            return
        if not API_KEY or not TO:
            self._json(503, {"error": "servicio sin configurar"})
            return
        if length <= 0 or length > MAX_BODY:
            self._json(400, {"error": "cuerpo invalido"})
            return

        try:
            data = json.loads(raw)
        except Exception:
            self._json(400, {"error": "json invalido"})
            return

        fields, err = validate(data)
        if err == "__honeypot__":
            # 200 a proposito: el bot cree que funciono y no reintenta.
            self._json(200, {"ok": True})
            return
        if err:
            self._json(400, {"error": err})
            return

        if rate_limited(self.client_ip()):
            self.send_response(429)
            self.send_header("Retry-After", "3600")
            self.send_header("Content-Type", "application/json")
            body = json.dumps({"error": "demasiados envios, probá más tarde"}).encode()
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return

        ok, detail = send(fields)
        if ok:
            self._json(200, {"ok": True})
        else:
            sys.stderr.write(f"  envio fallido: {detail}\n")
            self._json(502, {"error": "no se pudo enviar"})


if __name__ == "__main__":
    if not API_KEY:
        sys.stderr.write("  AVISO: RESEND_API_KEY vacia — /api/contact devolverá 503\n")
    sys.stderr.write(f"  contact-svc escuchando en 127.0.0.1:{PORT} · from={FROM} to={TO or '(sin definir)'}\n")
    ThreadingHTTPServer(("127.0.0.1", PORT), Handler).serve_forever()
