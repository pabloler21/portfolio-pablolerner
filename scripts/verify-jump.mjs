/* Verificación de la física del salto sobre los charcos de ácido.
   Uso: npm run verify:jump   (no necesita navegador — es matemática pura)

   Lee las constantes y la expresión del reloj del salto DEL PROPIO
   PortfolioScene.astro y replica el orden real de tick(): mover → compuerta
   del charco → avanzar el arco. Así el test mide lo que se despliega, no una
   copia de los números que se desincroniza al primer retoque. */
import { readFileSync } from 'node:fs';
import path from 'node:path';

const SRC = path.join(process.cwd(), 'src/components/ui/PortfolioScene.astro');
const src = readFileSync(SRC, 'utf8');

const num = (re, what) => {
  const m = src.match(re);
  if (!m) throw new Error(`no pude leer ${what} de PortfolioScene.astro`);
  return parseFloat(m[1]);
};

const C = {
  WALK_SPEED:      num(/const WALK_SPEED = ([\d.]+)/, 'WALK_SPEED'),
  SPRINT_MULT:     num(/const SPRINT_MULT = ([\d.]+)/, 'SPRINT_MULT'),
  JUMP_SPEED_MULT: num(/const JUMP_SPEED_MULT = ([\d.]+)/, 'JUMP_SPEED_MULT'),
  JUMP_DUR:        num(/const JUMP_DUR = ([\d.]+)/, 'JUMP_DUR'),
  CRATER_HALF_W:   num(/const CRATER_HALF_W = ([\d.]+)/, 'CRATER_HALF_W'),
};
const CRATER_ZS = JSON.parse(src.match(/const CRATER_ZS = (\[[^\]]+\])/)[1]);

/* La expresión de avance del reloj se evalúa tal cual está en el archivo, así
   el test detecta si vuelve a quedar atada al frame en vez del tiempo real. */
const stepExpr = src.match(/jumpT \+= ([^;]+);/)[1].trim();
const jumpStep = new Function('reduced', 'dtScale', `return ${stepExpr};`);

/* El modelo asume que la compuerta del charco es booleana sobre `jumping`
   (la altura no participa). Si eso cambia, el test miente y hay que
   reescribirlo — así que se verifica. */
const gateIsBoolean = /if \(!jumping\) \{\s*\n\s*CRATER_ZS\.forEach/.test(src);

const CZ   = CRATER_ZS[0];
const NEAR = CZ + C.CRATER_HALF_W;   // borde de acá, el que se cruza primero
const FAR  = CZ - C.CRATER_HALF_W;   // borde de allá
const WIDTH = NEAR - FAR;
const SPAWN_Z = 0;                   // resetToEntrance(): roleBillRefs[0].bz + 10, con bz = -10

/* Un frame de tick() con W apretado y sin Shift (o sea, corriendo). */
function simulate({ fps, reduced, takeoffZ, cz = CZ, spawnZ = SPAWN_Z }) {
  const dtScale = Math.min(1 / fps, 0.05) * 60;
  const step = jumpStep(reduced, dtScale);
  const near = cz + C.CRATER_HALF_W, far = cz - C.CRATER_HALF_W;
  let z = spawnZ, jumping = false, jumpT = 0, jumped = false, apex = 0;

  for (let f = 0; f < 10000; f++) {
    if (!jumped && z <= takeoffZ) { jumping = true; jumpT = 0; jumped = true; }

    // 1 · movimiento (tick ~1670)
    z -= C.WALK_SPEED * C.SPRINT_MULT * (jumping ? C.JUMP_SPEED_MULT : 1) * dtScale;

    // 2 · compuerta del charco (tick ~1714) — corriendo y en el piso = muerte
    if (!jumping && z < near && z > far) return { ok: false, z, apex };

    // 3 · arco del salto (tick ~1828)
    if (jumping) {
      jumpT += step;
      const p = jumpT / C.JUMP_DUR;
      if (p >= 1) jumping = false;
      else apex = Math.max(apex, Math.sin(p * Math.PI));
    }
    if (z < far - 0.5) return { ok: true, z, apex };
  }
  return { ok: false, z, apex, stalled: true };
}

/* Alcance horizontal en el aire: lo único que decide si se cruza. */
function reach(fps, reduced) {
  const dtScale = Math.min(1 / fps, 0.05) * 60;
  const frames = C.JUMP_DUR / jumpStep(reduced, dtScale);
  return frames * C.WALK_SPEED * C.SPRINT_MULT * C.JUMP_SPEED_MULT * dtScale;
}

const FPS = [60, 75, 120, 144, 165];
const results = [];
const record = (id, name, pass, detail) => results.push({ id, name, pass, detail });

record('J0', 'La compuerta sigue siendo booleana', gateIsBoolean,
  gateIsBoolean ? 'if (!jumping) — el modelo del test aplica' : 'CAMBIÓ: reescribir este test');

/* J1 — el alcance no puede depender de los Hz del monitor. */
const reaches = FPS.flatMap(f => [false, true].map(r => ({ fps: f, reduced: r, u: reach(f, r) })));
const spread = Math.max(...reaches.map(r => r.u)) - Math.min(...reaches.map(r => r.u));
record('J1', 'Alcance independiente del framerate', spread < 0.01,
  `${Math.min(...reaches.map(r => r.u)).toFixed(2)}u … ${Math.max(...reaches.map(r => r.u)).toFixed(2)}u`);

/* J2 — con margen sobrado sobre el ancho del charco, en toda condición. */
const short = reaches.filter(r => r.u < WIDTH * 1.5);
record('J2', `Alcance ≥ 1.5× el charco (${WIDTH.toFixed(1)}u)`, short.length === 0,
  short.length ? short.map(r => `${r.fps}fps${r.reduced ? '/reduced' : ''}=${r.u.toFixed(2)}u`).join(' ')
               : `mínimo ${Math.min(...reaches.map(r => r.u)).toFixed(2)}u`);

/* J3 — el jugador no tiene por qué adivinar el instante: desde cualquier
   punto de la pista de carrera el salto tiene que cruzar. Incluye saltar
   apenas aparece, que es lo que hace todo el mundo la primera vez. */
const takeoffs = [];
for (let tz = SPAWN_Z; tz > NEAR + 0.1; tz -= 0.1) takeoffs.push(+tz.toFixed(2));
const bad = [];
for (const fps of FPS) for (const reduced of [false, true]) for (const tz of takeoffs)
  if (!simulate({ fps, reduced, takeoffZ: tz }).ok) bad.push(`${fps}fps${reduced ? '/reduced' : ''}@z=${tz}`);
record('J3', 'Cruza desde cualquier punto de la pista', bad.length === 0,
  bad.length ? `${bad.length}/${FPS.length * 2 * takeoffs.length} mueren: ${bad.slice(0, 4).join(' ')}…`
             : `${FPS.length * 2 * takeoffs.length} combinaciones, todas cruzan`);

/* J4 — el segundo charco, ya en plena avenida, con carrera larga. */
const CZ2 = CRATER_ZS[1];
const far2 = [];
for (const fps of FPS) for (const reduced of [false, true]) {
  const r = simulate({ fps, reduced, cz: CZ2, spawnZ: CZ2 + 10,
                      takeoffZ: CZ2 + C.CRATER_HALF_W + 0.2 });
  if (!r.ok) far2.push(`${fps}fps${reduced ? '/reduced' : ''}`);
}
record('J4', `2º charco (z=${CZ2}) se cruza`, far2.length === 0,
  far2.length ? far2.join(' ') : 'en toda condición');

const pad = s => String(s).padEnd(38);
let failed = 0;
console.log('\n  FÍSICA DEL SALTO — charcos de ácido\n');
console.log(`  spawn z=${SPAWN_Z} · charco z ∈ (${FAR}, ${NEAR}) · pista de carrera ${(SPAWN_Z - NEAR).toFixed(1)}u\n`);
for (const r of results) {
  if (!r.pass) failed++;
  console.log(`  ${r.pass ? '✓' : '✗'} ${r.id.padEnd(4)} ${pad(r.name)} ${r.detail}`);
}
console.log('\n  alcance en el aire por framerate:');
for (const r of reaches) console.log(`    ${String(r.fps).padStart(3)}fps ${r.reduced ? 'reduced' : '       '}  ${r.u.toFixed(2)}u`);
console.log(`\n  ${results.length - failed}/${results.length} en verde\n`);
process.exit(failed ? 1 : 0);
