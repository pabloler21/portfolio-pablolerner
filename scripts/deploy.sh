#!/usr/bin/env bash
# Deploy de dist/ al VPS que sirve pablolerner.dev.
#   npm run deploy:dry   -> build + simulacro, no toca el server
#   npm run deploy       -> build + sync + verificación en vivo
#
# El server es un Vultr con Caddy sirviendo estáticos desde /var/www/portfolio.
# El Caddyfile se administra desde el repo vps-infra y NO se edita a mano acá;
# este script sólo reemplaza el contenido del directorio raíz.
set -euo pipefail

HOST="${DEPLOY_HOST:-vultr}"
REMOTE="${DEPLOY_PATH:-/var/www/portfolio}"
SITE="${DEPLOY_URL:-https://pablolerner.dev}"
DRY=""
[ "${1:-}" = "--dry" ] && DRY="--dry-run"

cd "$(dirname "$0")/.."

echo
echo "  destino: $HOST:$REMOTE  ($SITE)"
echo "  commit:  $(git rev-parse --short HEAD) $(git rev-parse --abbrev-ref HEAD)"
if [ -n "$(git status --porcelain)" ]; then
  echo "  ⚠ hay cambios sin commitear — se despliega el árbol de trabajo, no el commit"
fi

echo
echo "── build ──"
rm -rf dist
npm run build 2>&1 | grep -E "page\(s\) built|error" || true
echo "  dist: $(find dist -type f | wc -l) archivos · $(du -sh dist | cut -f1)"

echo
echo "── rsync ${DRY:-(en serio)} ──"
# --delete deja el server EXACTAMENTE igual a dist/: los assets viejos con hash
# superado y los modelos que ya no se usan tienen que desaparecer, o el
# directorio crece para siempre.
rsync -az --delete $DRY --itemize-changes -e "ssh -o BatchMode=yes" dist/ "$HOST:$REMOTE/" \
  | sed 's/^/  /' | head -40

if [ -n "$DRY" ]; then
  echo
  echo "  simulacro: no se tocó nada. Corré 'npm run deploy' para aplicarlo."
  exit 0
fi

echo
echo "── verificación en vivo ──"
fail=0
for r in / /en/ /es/ /en/risk/ /en/ai/ /en/contact/ /es/contact/ /models/remy.glb; do
  code=$(curl -sS -o /dev/null -w '%{http_code}' "$SITE$r" --max-time 60 || echo 000)
  [ "$code" = "200" ] || fail=1
  printf "  %-18s %s\n" "$r" "$code"
done
code=$(curl -sS -o /dev/null -w '%{http_code}' "$SITE/noexiste" --max-time 30 || echo 000)
printf "  %-18s %s (esperado 404)\n" "/noexiste" "$code"
[ "$code" = "404" ] || fail=1

# La prueba de fondo: el árbol servido tiene que ser idéntico al build.
# LC_ALL=C porque el orden de `sort` depende del locale y el server tiene otro.
loc=$(cd dist && find . -type f -exec md5sum {} \; | sed 's|\./||' | LC_ALL=C sort | md5sum | cut -d' ' -f1)
rem=$(ssh -o BatchMode=yes "$HOST" "cd $REMOTE && find . -type f -exec md5sum {} \; | sed 's|\./||' | LC_ALL=C sort | md5sum | cut -d' ' -f1")
echo
if [ "$loc" = "$rem" ]; then
  echo "  ✓ el árbol servido es idéntico al build ($loc)"
else
  echo "  ✗ el árbol servido DIFIERE del build"
  echo "    local $loc · server $rem"
  fail=1
fi

echo
[ $fail -eq 0 ] && echo "  deploy OK" || { echo "  deploy con errores"; exit 1; }
