/* Arnés de la música ambiente generativa.
   Uso: npm run verify:audio
        npm run verify:audio -- --wav   (además deja previews en .cache/audio/)

   El problema de fondo: nadie puede escuchar el CI, y "no explota" no es lo
   mismo que "suena". Por eso `createAmbient` recibe un BaseAudioContext en vez
   de crearse el suyo: acá se le pasa un OfflineAudioContext, se renderiza el
   audio de verdad y se MIDE la señal. Lo que se mide es lo que se prometió:
   que no haya silencio, que no clipee, que sea suave, y que cada variante
   tenga el carácter que dice tener (A sin transitorios, B con pulso).

   El módulo se bundlea con esbuild y se sirve al navegador headless: es el
   MISMO src/lib/ambient.ts que despacha el sitio, no una copia. */
import { chromium } from 'playwright-core';
import { createServer } from 'node:http';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { existsSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';

const ROOT = process.cwd();
const OUT = path.join(ROOT, '.cache/audio');
const PORT = 4402;
const BASE = `http://127.0.0.1:${PORT}`;
const WANT_WAV = process.argv.includes('--wav');

/* Duración del render. Tiene que ser larga o el test no ve lo que importa:
   el filtro de A respira cada 40s y B cambia de acorde cada 32s. */
const DUR = 96;
const SR = 44100;
const SEED = 20260908;

function browserEnv() {
  const libs = path.join(ROOT, '.cache/pw-libs/root/usr/lib/x86_64-linux-gnu');
  if (!existsSync(libs)) return process.env;
  const prev = process.env.LD_LIBRARY_PATH;
  return { ...process.env, LD_LIBRARY_PATH: prev ? `${libs}:${prev}` : libs };
}
function resolveChrome() {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH;
  const base = path.join(process.env.HOME, '.cache/ms-playwright');
  for (const d of readdirSync(base).filter(x => x.startsWith('chromium-'))) {
    const p = path.join(base, d, 'chrome-linux64', 'chrome');
    if (existsSync(p)) return p;
  }
  throw new Error('no encontre chromium; defini CHROME_PATH');
}

await mkdir(OUT, { recursive: true });
const BUNDLE = path.join(OUT, 'ambient.js');
execFileSync(path.join(ROOT, 'node_modules/.bin/esbuild'), [
  path.join(ROOT, 'src/lib/ambient.ts'), '--bundle', '--format=esm', `--outfile=${BUNDLE}`,
], { stdio: 'pipe' });

const srv = createServer(async (req, res) => {
  if (req.url.startsWith('/ambient.js')) {
    res.writeHead(200, { 'Content-Type': 'text/javascript' }).end(await readFile(BUNDLE));
  } else {
    res.writeHead(200, { 'Content-Type': 'text/html' }).end('<!doctype html><title>audio harness</title>');
  }
});
await new Promise(r => srv.listen(PORT, '127.0.0.1', r));

const results = [];
const record = (id, name, pass, detail) => results.push({ id, name, pass, detail });

/* WAV de 16 bits, mono — para poder escuchar lo que midió el test. */
function wav(samples, sampleRate) {
  const n = samples.length;
  const buf = Buffer.alloc(44 + n * 2);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + n * 2, 4); buf.write('WAVE', 8);
  buf.write('fmt ', 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(1, 22); buf.writeUInt32LE(sampleRate, 24);
  buf.writeUInt32LE(sampleRate * 2, 28); buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34);
  buf.write('data', 36); buf.writeUInt32LE(n * 2, 40);
  for (let i = 0; i < n; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    buf.writeInt16LE(Math.round(s * 32767), 44 + i * 2);
  }
  return buf;
}

const browser = await chromium.launch({ executablePath: resolveChrome(), env: browserEnv(), args: ['--no-sandbox'] });
const VARIANTS = ['engine', 'lofi', 'terminal'];
const stats = {};

try {
  const page = await browser.newPage();
  page.on('pageerror', e => console.error('  [page]', e.message));
  await page.goto(BASE + '/blank.html', { waitUntil: 'load' });

  for (const variant of VARIANTS) {
    const m = await page.evaluate(async ({ variant, DUR, SR, SEED, wantWav }) => {
      const mod = await import('/ambient.js');
      const ctx = new OfflineAudioContext(2, SR * DUR, SR);
      const h = mod.createAmbient(ctx, variant, { volume: 0.18, fadeIn: 2, seed: SEED });
      h.start();
      /* Offline el reloj de JS no avanza: la ventana se programa de una sola
         vez para toda la duración, en vez de con el timer de runLive(). */
      h.schedule(0, DUR);
      const buf = await ctx.startRendering();
      const L = buf.getChannelData(0), R = buf.getChannelData(1);

      let peak = 0, sum = 0, sumSq = 0;
      for (let i = 0; i < L.length; i++) {
        const v = (L[i] + R[i]) / 2;
        const a = Math.abs(v);
        if (a > peak) peak = a;
        sum += v; sumSq += v * v;
      }
      const rms = Math.sqrt(sumSq / L.length);
      const dc = sum / L.length;

      /* Ventanas de 4s: RMS (¿hay silencio?) y brillo (¿evoluciona?).
         El brillo es la energía de la diferencia de primer orden dividida por
         la energía total — una aproximación barata al centroide espectral,
         sin FFT: si el filtro se abre, sube. */
      const W = SR * 4, win = [];
      for (let s = 0; s + W <= L.length; s += W) {
        let e = 0, d = 0;
        for (let i = s + 1; i < s + W; i++) {
          const v = (L[i] + R[i]) / 2, p = (L[i - 1] + R[i - 1]) / 2;
          e += v * v; d += (v - p) * (v - p);
        }
        win.push({ rms: Math.sqrt(e / W), bright: e > 0 ? Math.sqrt(d / e) : 0 });
      }

      /* Ventanas cortas (50ms) para detectar transitorios: un kick sube el
         pico muy por encima de la mediana; un drone no. */
      const S = Math.floor(SR * 0.05), short = [];
      for (let s = 0; s + S <= L.length; s += S) {
        let e = 0;
        for (let i = s; i < s + S; i++) { const v = (L[i] + R[i]) / 2; e += v * v; }
        short.push(Math.sqrt(e / S));
      }
      /* Brillo en ventanas de 1s: sirve para ver el cambio de acorde de C,
         que abre el filtro de la cama justo en el borde. */
      const B = SR, bright1s = [];
      for (let s = 0; s + B <= L.length; s += B) {
        let e = 0, d = 0;
        for (let i = s + 1; i < s + B; i++) {
          const v = (L[i] + R[i]) / 2, p = (L[i - 1] + R[i - 1]) / 2;
          e += v * v; d += (v - p) * (v - p);
        }
        bright1s.push(e > 0 ? Math.sqrt(d / e) : 0);
      }

      const sorted = [...short].sort((a, b) => a - b);
      const median = sorted[Math.floor(sorted.length / 2)];
      const p99 = sorted[Math.floor(sorted.length * 0.99)];

      /* "Tener pulso" es ser PERIODICO, no tener transitorios: por eso se mide
         autocorrelacion de la envolvente y no factor de cresta. El kick cae en
         los tiempos 1 y 3 de un compas de 4s y el hat a contratiempo, o sea que
         el patron se repite cada 2s = 40 ventanas de 50ms. Un drone no
         correlaciona ahi; un beat si. */
      const autocorr = (lag) => {
        const n = short.length - lag;
        if (n <= 0) return 0;
        const mean = short.reduce((a, b) => a + b, 0) / short.length;
        let num = 0, den = 0;
        for (let i = 0; i < short.length; i++) den += (short[i] - mean) ** 2;
        for (let i = 0; i < n; i++) num += (short[i] - mean) * (short[i + lag] - mean);
        return den > 0 ? num / den : 0;
      };
      const pulse = autocorr(Math.round(2 / 0.05));   /* 2s = el compas del kick */

      /* Goertzel: energia en UNA frecuencia, sin FFT. Con esto se puede leer
         cual es la fundamental de la cama en cada tramo y comprobar que
         realmente se mueve con el acorde. */
      const goertzel = (from, len, freq) => {
        const k = Math.round((freq * len) / SR);
        const w = (2 * Math.PI * k) / len;
        const coeff = 2 * Math.cos(w);
        let s1 = 0, s2 = 0;
        for (let i = from; i < from + len; i++) {
          const x = (L[i] + R[i]) / 2;
          const s0 = x + coeff * s1 - s2;
          s2 = s1; s1 = s0;
        }
        return s2 * s2 + s1 * s1 - coeff * s1 * s2;
      };
      /* Un tramo de 4s en el MEDIO de cada acorde (del segundo 8 al 12),
         lejos del glissando de 1.4s del borde. */
      const roots = [];
      for (let seg = 0; (seg * 15 + 12) * SR < L.length; seg++) {
        const from = Math.floor((seg * 15 + 8) * SR), len = SR * 4;
        roots.push([110.0, 87.31, 130.81, 98.0].map(f => goertzel(from, len, f)));
      }

      let wavData = null;
      if (wantWav) {
        /* Preview mono, submuestreada a la mitad y recortada a 48s: el render
           completo son 96s estéreo, o sea 34 MB por variante. Para decidir la
           dirección alcanza de sobra y entra en un mensaje. */
        const step = 2, n = Math.floor(Math.min(L.length, SR * 48) / step);
        wavData = new Array(n);
        for (let i = 0; i < n; i++) wavData[i] = (L[i * step] + R[i * step]) / 2;
      }

      return {
        peak, rms, dc,
        winRms: win.map(w => +w.rms.toFixed(5)),
        winBright: win.map(w => +w.bright.toFixed(4)),
        crest: median > 0 ? p99 / median : 0,
        pulse,
        bright1s: bright1s.map(b => +b.toFixed(4)),
        roots,
        wavData,
      };
    }, { variant, DUR, SR, SEED, wantWav: WANT_WAV });

    stats[variant] = m;
    if (WANT_WAV && m.wavData) {
      await writeFile(path.join(OUT, `${variant}.wav`), wav(m.wavData, SR / 2));
    }
  }
} finally {
  await browser.close();
  srv.close();
}

/* ── Aserciones ───────────────────────────────────────────────────────── */
for (const v of VARIANTS) {
  const s = stats[v];
  const minWin = Math.min(...s.winRms);
  const brightSpread = Math.max(...s.winBright) - Math.min(...s.winBright);

  record(`${v}/S1`, 'Suena en todo el tramo (sin huecos)', minWin > 0.002,
    `RMS min por ventana ${minWin.toFixed(5)} · global ${s.rms.toFixed(4)}`);

  /* Un pico >= 1 se recorta y suena a distorsión; el margen de 0.9 deja
     lugar para que el usuario suba el volumen sin romperlo. */
  record(`${v}/S2`, 'No clipea', s.peak < 0.9, `pico ${s.peak.toFixed(3)}`);

  /* "Suave" es un requisito, no una impresión: esto es fondo, no primer
     plano. Sobre 0.15 de RMS ya compite con la voz de la página. */
  record(`${v}/S3`, 'Es suave (fondo, no primer plano)', s.rms > 0.004 && s.rms < 0.15,
    `RMS ${s.rms.toFixed(4)}`);

  record(`${v}/S4`, 'Sin componente continua', Math.abs(s.dc) < 0.01, `DC ${s.dc.toFixed(5)}`);

  /* Que EVOLUCIONE: un pad que no cambia en 96s es un zumbido. Se acepta
     movimiento por nivel o por brillo — A respira con el filtro (brillo),
     B y C además cambian de nivel. */
  const rmsSpread = Math.max(...s.winRms) - Math.min(...s.winRms);
  record(`${v}/S5`, 'Evoluciona (no es un zumbido fijo)', rmsSpread > 0.002 || brightSpread > 0.02,
    `rango RMS ${rmsSpread.toFixed(4)} · rango brillo ${brightSpread.toFixed(3)}`);
}

/* Carácter: cada variante tiene que ser lo que dice ser. Sin esto, las tres
   podrían converger al mismo pad y el test seguiría en verde. */
/* B es la unica que promete un beat. Se mide periodicidad de la envolvente al
   compas del kick (2s): un drone no correlaciona ahi, un beat si. El factor de
   cresta —que era lo que media antes— no servia: daba 1.28 contra 1.33 y
   pasaba por alto que el kick estaba tapado por el pad. */
record('X1', 'B tiene pulso, A y C no',
  stats.lofi.pulse > 0.25 && stats.engine.pulse < 0.15 && stats.terminal.pulse < 0.15,
  `periodicidad @2s — A ${stats.engine.pulse.toFixed(3)} · B ${stats.lofi.pulse.toFixed(3)} · C ${stats.terminal.pulse.toFixed(3)}`);

/* X3 — C rota de acorde cada 15s y el cambio SE TIENE QUE NOTAR. Antes la
   cama de drone quedaba fija en A2+E3 para siempre: el arpegio cambiaba de
   acorde arriba de una fundamental que no acompañaba, y el cambio pasaba
   desapercibido. Esto mide UNA de las dos correcciones: el golpe de brillo del
   filtro en el borde (los 2s siguientes al cambio contra el medio del acorde).
   Que la cama se mueva de verdad lo mide X4 — son cosas distintas y este test
   solo pasaria igual con la cama quieta. */
{
  const CHORD_DUR = 15;
  const b = stats.terminal.bright1s;
  const borde = [], medio = [];
  for (let i = 0; i < b.length; i++) {
    const fase = i % CHORD_DUR;
    if (fase < 2) borde.push(b[i]);
    else if (fase >= 7 && fase <= 12) medio.push(b[i]);
  }
  const avg = a => a.reduce((x, y) => x + y, 0) / a.length;
  const ratio = avg(borde) / avg(medio);
  record('X3', 'C: el cambio de acorde se nota', ratio > 1.15,
    `brillo borde/medio ${ratio.toFixed(2)}× · cada ${CHORD_DUR}s`);
}

/* X4 — la cama SIGUE al acorde. Es la correccion de fondo: antes los dos
   osciladores graves quedaban clavados en A2+E3 para siempre y el arpegio
   cambiaba de armonia sobre una fundamental que no acompañaba.

   Ojo con como se mide. La primera version tomaba el argmax entre las cuatro
   fundamentales y fallaba en los tramos de Fa — no por el audio, sino porque
   C3 (130.81) es la FUNDAMENTAL del acorde de Do y a la vez la QUINTA del de
   Fa: las candidatas no son mutuamente excluyentes y el argmax no discrimina.
   Lo que si discrimina es comparar contra las notas AJENAS al acorde: en el
   tramo de Fa, La (110) no deberia estar. Con la cama clavada en A2, La gana
   siempre y esto falla, que es justo la regresion que hay que atrapar. */
{
  const F = { A: 0, F: 1, C: 2, G: 3 };
  const NOMBRE = ['A(110)', 'F(87)', 'C(131)', 'G(98)'];
  /* raiz de cada acorde + las candidatas que NO estan en su cama */
  const SEG = [
    { raiz: F.A, ajenas: [F.F, F.C, F.G] },   /* Am9   — cama A2 + E3 */
    { raiz: F.F, ajenas: [F.A, F.G] },        /* Fmaj9 — cama F2 + C3 */
    { raiz: F.C, ajenas: [F.A, F.F, F.G] },   /* Cmaj9 — cama C3 + G3 */
    { raiz: F.G, ajenas: [F.A, F.F, F.C] },   /* G6/9  — cama G2 + D3 */
  ];
  const detalle = [];
  let ok = 0;
  stats.terminal.roots.forEach((e, i) => {
    const { raiz, ajenas } = SEG[i % 4];
    const peorAjena = Math.max(...ajenas.map(a => e[a]));
    const margen = peorAjena > 0 ? e[raiz] / peorAjena : Infinity;
    if (margen > 1.5) ok++;
    detalle.push(`${NOMBRE[raiz]}×${margen.toFixed(1)}`);
  });
  record('X4', 'C: la cama sigue al acorde', ok === stats.terminal.roots.length,
    `${ok}/${stats.terminal.roots.length} tramos · raiz sobre notas ajenas: ${detalle.join(' ')}`);
}

record('X2', 'Las tres son distintas entre si',
  new Set(VARIANTS.map(v => stats[v].rms.toFixed(3))).size === 3,
  VARIANTS.map(v => `${v} ${stats[v].rms.toFixed(3)}`).join(' · '));

const pad = s => String(s).padEnd(38);
let failed = 0;
console.log('\n  MUSICA AMBIENTE — render offline y medicion de la señal\n');
console.log(`  ${DUR}s por variante · ${SR}Hz · semilla ${SEED}\n`);
for (const r of results) {
  if (!r.pass) failed++;
  console.log(`  ${r.pass ? '✓' : '✗'} ${r.id.padEnd(14)} ${pad(r.name)} ${r.detail}`);
}
if (WANT_WAV) console.log(`\n  previews en ${path.relative(ROOT, OUT)}/*.wav`);
console.log(`\n  ${results.length - failed}/${results.length} en verde\n`);
process.exit(failed ? 1 : 0);
