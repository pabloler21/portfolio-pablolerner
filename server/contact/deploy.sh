#!/usr/bin/env bash
# Instala/actualiza el endpoint de contacto en el VPS.  npm run deploy:contact
#
# Idempotente: se puede correr las veces que haga falta. NO toca la API key —
# si /etc/contact-svc.env no existe lo crea con un placeholder y avisa.
set -euo pipefail
HOST="${DEPLOY_HOST:-vultr}"
cd "$(dirname "$0")"

echo
echo "  destino: $HOST · servicio contact-svc en 127.0.0.1:8110"
echo
echo "── subiendo ──"
rsync -az -e "ssh -o BatchMode=yes" contact_svc.py contact-svc.service "$HOST:/tmp/contact-deploy/" \
  --rsync-path="mkdir -p /tmp/contact-deploy && rsync"

ssh -o BatchMode=yes "$HOST" 'bash -s' <<'REMOTE'
set -euo pipefail
say() { printf '  \033[0;36m▸\033[0m %s\n' "$*"; }

id -u contact >/dev/null 2>&1 || {
  say "creando usuario de sistema 'contact'"
  sudo useradd --system --no-create-home --shell /usr/sbin/nologin contact
}
sudo install -d -o root -g root -m 755 /opt/contact
sudo install -o root -g root -m 755 /tmp/contact-deploy/contact_svc.py /opt/contact/contact_svc.py
sudo install -o root -g root -m 644 /tmp/contact-deploy/contact-svc.service /etc/systemd/system/contact-svc.service

# El env NO se pisa nunca: es donde vive la API key.
if [ ! -f /etc/contact-svc.env ]; then
  say "creando /etc/contact-svc.env con placeholder (falta cargar la key)"
  sudo tee /etc/contact-svc.env >/dev/null <<'ENV'
# API key de Resend. Este archivo es root:contact 0640 — no entra en ningun repo.
RESEND_API_KEY=
CONTACT_TO=lerner.pb@gmail.com
# Con el dominio SIN verificar en Resend el remitente tiene que ser este, y el
# destino solo puede ser la casilla duena de la cuenta. Verificado el dominio,
# cambiar por algo como contacto@pablolerner.dev
CONTACT_FROM=onboarding@resend.dev
ENV
fi
sudo chown root:contact /etc/contact-svc.env
sudo chmod 640 /etc/contact-svc.env

sudo systemctl daemon-reload
sudo systemctl enable --quiet contact-svc.service
sudo systemctl restart contact-svc.service
sleep 1
say "estado: $(systemctl is-active contact-svc.service) · memoria: $(systemctl show -p MemoryCurrent --value contact-svc.service | awk '{printf "%.1f MB", $1/1048576}')"
say "health: $(curl -sS --max-time 5 http://127.0.0.1:8110/api/contact/health || echo 'sin respuesta')"
rm -rf /tmp/contact-deploy
REMOTE

echo
grep -q "RESEND_API_KEY=$" <(ssh -o BatchMode=yes "$HOST" 'sudo cat /etc/contact-svc.env') 2>/dev/null \
  && echo "  ⚠ falta cargar RESEND_API_KEY en /etc/contact-svc.env del VPS" \
  || echo "  key cargada"
