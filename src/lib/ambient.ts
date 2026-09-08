/* Música ambiente generativa para la escena 3D.
 *
 * NO hay archivo de audio, a propósito, y es la misma postura que ya había
 * tomado `beep()` en PortfolioScene ("no files to source/license"): un loop
 * decente pesa 2-3 MB sobre un build de 26, hay que licenciarlo, y —lo peor—
 * se escucha loopear a los tres minutos. Acá la gente se queda caminando por
 * la avenida un rato largo. Un pad generativo no repite nunca y pesa 0 KB.
 *
 * ── La decisión de diseño que sostiene todo lo demás ──
 * `createAmbient` recibe un `BaseAudioContext`, NO crea el suyo. Así el mismo
 * código corre en vivo (`AudioContext`) y adentro de un `OfflineAudioContext`,
 * que es lo que permite renderizarlo y MEDIRLO en el arnés: sin eso, el test
 * sólo podría comprobar que la función no explota, no que suena.
 *
 * De ahí sale la segunda regla: los eventos discretos (pings, kick, hat, notas
 * del arpegio) NO se programan con setTimeout — offline el reloj de JS no
 * avanza y no sonaría nada. Se programan sobre el reloj de audio en ventanas,
 * con `schedule(desde, hasta)`. En vivo esa misma función se llama cada pocos
 * segundos; offline se llama una sola vez para toda la duración.
 */

export type AmbientVariant = 'engine' | 'lofi' | 'terminal';

export interface AmbientOptions {
  /** Volumen final del master (0-1). Suave de fábrica: esto es fondo. */
  volume?: number;
  /** Segundos del fade de entrada. */
  fadeIn?: number;
  /** Semilla del PRNG — el arnés la fija para medir siempre lo mismo. */
  seed?: number;
}

export interface AmbientHandle {
  readonly variant: AmbientVariant;
  /** Arranca (o reanuda) el fade de entrada. */
  start(): void;
  /** Baja el volumen y desconecta todo. No se puede reusar. */
  stop(fade?: number): void;
  setVolume(v: number): void;
  /** Programa eventos entre `from` y `to` (segundos del reloj de audio). */
  schedule(from: number, to: number): void;
}

/* ── Utilidades ────────────────────────────────────────────────────── */

/** mulberry32 — PRNG chico y sembrable. Sin esto el arnés mediría ruido. */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Ruido blanco en un buffer de 2s, que después se loopea. */
function noiseBuffer(ctx: BaseAudioContext, rand: () => number): AudioBuffer {
  const len = Math.floor(ctx.sampleRate * 2);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = rand() * 2 - 1;
  return buf;
}

/** Fuente de ruido loopeada y ya arrancada. */
function noiseSource(ctx: BaseAudioContext, buf: AudioBuffer): AudioBufferSourceNode {
  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.loop = true;
  src.start(0);
  return src;
}

/* Reverb barata: la respuesta al impulso es ruido con decaimiento
   exponencial. Son diez líneas y es la diferencia entre "osciladores" y
   "un lugar". */
function reverb(ctx: BaseAudioContext, seconds: number, decay: number, rand: () => number): ConvolverNode {
  const len = Math.floor(ctx.sampleRate * seconds);
  const ir = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = ir.getChannelData(ch);
    for (let i = 0; i < len; i++) {
      d[i] = (rand() * 2 - 1) * Math.pow(1 - i / len, decay);
    }
  }
  const conv = ctx.createConvolver();
  conv.buffer = ir;
  return conv;
}

/** Un oscilador continuo ya conectado y arrancado. */
function drone(
  ctx: BaseAudioContext, type: OscillatorType, freq: number, detune: number, dest: AudioNode, gain: number,
): { osc: OscillatorNode; g: GainNode } {
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  osc.detune.value = detune;
  g.gain.value = gain;
  osc.connect(g).connect(dest);
  osc.start(0);
  return { osc, g };
}

/** LFO continuo sobre un AudioParam: `param = base + depth * sin(rate)`. */
function lfo(ctx: BaseAudioContext, rate: number, depth: number, param: AudioParam, base: number): OscillatorNode {
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.frequency.value = rate;
  g.gain.value = depth;
  param.value = base;
  osc.connect(g).connect(param);
  osc.start(0);
  return osc;
}

/* Notas, por nombre, para que los acordes se lean como acordes y no como
   una lista de números. A4 = 440, temperamento igual. */
const NOTE: Record<string, number> = {
  F1: 43.65, G1: 49.0, A1: 55.0, C2: 65.41, E2: 82.41, F2: 87.31,
  G2: 98.0, A2: 110.0, C3: 130.81, E3: 164.81, F3: 174.61, G3: 196.0,
  A3: 220.0, B3: 246.94, C4: 261.63, D3: 146.83, D4: 293.66, E4: 329.63,
  F4: 349.23, G4: 392.0,
  A4: 440.0, B4: 493.88, C5: 523.25, E5: 659.26,
};

/* ── El motor ──────────────────────────────────────────────────────── */

export function createAmbient(
  ctx: BaseAudioContext, variant: AmbientVariant, opts: AmbientOptions = {},
): AmbientHandle {
  const volume = opts.volume ?? 0.18;
  const fadeIn = opts.fadeIn ?? 3;
  const rand = rng(opts.seed ?? Math.floor(Math.random() * 2 ** 31));

  const master = ctx.createGain();
  master.gain.value = 0;
  master.connect(ctx.destination);

  /* Todo pasa por acá: es lo que le da el carácter "lofi". Sin este filtro
     los sawtooth suenan a sintetizador barato, no a sala en penumbra. */
  const tone = ctx.createBiquadFilter();
  tone.type = 'lowpass';
  tone.frequency.value = 2200;
  tone.Q.value = 0.4;
  tone.connect(master);

  const space = reverb(ctx, 3.5, 2.6, rand);
  const spaceGain = ctx.createGain();
  spaceGain.gain.value = 0.5;
  space.connect(spaceGain).connect(tone);

  const noise = noiseBuffer(ctx, rand);
  const running: { stop(t: number): void }[] = [];
  const track = <T extends OscillatorNode | AudioBufferSourceNode>(n: T): T => { running.push(n); return n; };

  let schedule: (from: number, to: number) => void = () => {};

  /* ══ A · ENGINE ROOM ═══════════════════════════════════════════════
     Sin pulso y sin melodía: quintas graves desafinadas atravesando un
     filtro que respira cada 40s, ventilación de fondo, y cada tanto un
     ping metálico lejano. Lo más tenebroso y lo que menos interfiere. */
  if (variant === 'engine') {
    const bed = ctx.createBiquadFilter();
    bed.type = 'lowpass';
    bed.Q.value = 1.6;
    bed.connect(tone);
    track(lfo(ctx, 0.025, 350, bed.frequency, 550));   /* ciclo de 40s */

    track(drone(ctx, 'sawtooth', NOTE.A1, -7, bed, 0.20).osc);
    track(drone(ctx, 'sawtooth', NOTE.E2, +5, bed, 0.15).osc);
    track(drone(ctx, 'triangle', NOTE.A2, +3, bed, 0.10).osc);

    /* Ventilación: ruido en una banda angosta y grave. */
    const vent = ctx.createBiquadFilter();
    vent.type = 'bandpass';
    vent.frequency.value = 380;
    vent.Q.value = 0.7;
    const ventG = ctx.createGain();
    ventG.gain.value = 0.06;
    track(noiseSource(ctx, noise)).connect(vent).connect(ventG).connect(tone);
    track(lfo(ctx, 0.013, 120, vent.frequency, 380));

    const PINGS = [NOTE.A4, NOTE.C5, NOTE.E5];
    let next = -1;
    schedule = (from, to) => {
      if (next < 0) next = from + 8;
      while (next < to) {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.value = PINGS[Math.floor(rand() * PINGS.length)];
        g.gain.setValueAtTime(0.0001, next);
        g.gain.exponentialRampToValueAtTime(0.05, next + 0.01);
        g.gain.exponentialRampToValueAtTime(0.0001, next + 3.2);
        osc.connect(g).connect(space);
        osc.start(next);
        osc.stop(next + 3.4);
        next += 20 + rand() * 40;   /* uno cada 20-60s */
      }
    };
  }

  /* ══ B · LOFI PULSE ════════════════════════════════════════════════
     60 BPM: negra = 1s, compás = 4s, acorde cada 8 compases = 32s.
     El único que suena a lofi de verdad. */
  if (variant === 'lofi') {
    const BAR = 4;
    const CHORDS = [
      { root: NOTE.A1, notes: [NOTE.A2, NOTE.C3, NOTE.E3, NOTE.G3] },   /* i   Am7   */
      { root: NOTE.F1, notes: [NOTE.F2, NOTE.A2, NOTE.C3, NOTE.E3] },   /* VI  Fmaj7 */
      { root: NOTE.C2, notes: [NOTE.C3, NOTE.E3, NOTE.G3, NOTE.B3] },   /* III Cmaj7 */
      { root: NOTE.G1, notes: [NOTE.G2, NOTE.B3, NOTE.E3, NOTE.G3] },   /* VII G     */
    ];

    const padFilter = ctx.createBiquadFilter();
    padFilter.type = 'lowpass';
    padFilter.frequency.value = 780;
    padFilter.Q.value = 0.9;
    const padGain = ctx.createGain();
    padGain.gain.value = 0.070;
    padFilter.connect(padGain);
    padGain.connect(tone);
    padGain.connect(space);

    const voices = CHORDS[0].notes.map((f, i) => {
      const o = ctx.createOscillator();
      o.type = i === 0 ? 'triangle' : 'sawtooth';
      o.frequency.value = f;
      o.connect(padFilter);
      o.start(0);
      return track(o);
    });
    /* Wobble de cinta: sin esto el pad suena digital y perfecto, que es
       justo lo contrario de lofi. */
    voices.forEach((v, i) => track(lfo(ctx, 0.22 + i * 0.03, 6, v.detune, 0)));

    const bass = ctx.createOscillator();
    const bassG = ctx.createGain();
    bass.type = 'sine';
    bass.frequency.value = CHORDS[0].root;
    bassG.gain.value = 0.14;
    bass.connect(bassG).connect(tone);
    bass.start(0);
    track(bass);

    const hatFilter = ctx.createBiquadFilter();
    hatFilter.type = 'highpass';
    hatFilter.frequency.value = 7000;
    hatFilter.connect(tone);

    let bar = -1;
    schedule = (from, to) => {
      if (bar < 0) bar = Math.floor(from / BAR);
      while (bar * BAR < to) {
        const t0 = bar * BAR;
        if (t0 >= from) {
          /* Acorde cada 8 compases, con transición lenta: un salto seco se
             oiría como un corte. */
          if (bar % 8 === 0) {
            const c = CHORDS[(bar / 8) % CHORDS.length];
            voices.forEach((v, i) => {
              v.frequency.setValueAtTime(v.frequency.value, t0);
              v.frequency.exponentialRampToValueAtTime(c.notes[i], t0 + 1.2);
            });
            bass.frequency.setValueAtTime(bass.frequency.value, t0);
            bass.frequency.exponentialRampToValueAtTime(c.root, t0 + 1.2);
          }
          /* Kick en 1 y 3, muy blando: sub con caída de tono. */
          for (const beat of [0, 2]) {
            const t = t0 + beat;
            const k = ctx.createOscillator();
            const kg = ctx.createGain();
            k.type = 'sine';
            k.frequency.setValueAtTime(95, t);
            k.frequency.exponentialRampToValueAtTime(45, t + 0.11);
            kg.gain.setValueAtTime(0.0001, t);
            kg.gain.exponentialRampToValueAtTime(0.55, t + 0.008);
            kg.gain.exponentialRampToValueAtTime(0.0001, t + 0.30);
            k.connect(kg).connect(tone);
            k.start(t);
            k.stop(t + 0.34);
          }
          /* Hat a contratiempo. */
          for (const beat of [1.5, 3.5]) {
            const t = t0 + beat;
            const h = ctx.createBufferSource();
            const hg = ctx.createGain();
            h.buffer = noise;
            hg.gain.setValueAtTime(0.0001, t);
            hg.gain.exponentialRampToValueAtTime(0.055, t + 0.004);
            hg.gain.exponentialRampToValueAtTime(0.0001, t + 0.06);
            h.connect(hg).connect(hatFilter);
            h.start(t);
            h.stop(t + 0.08);
          }
        }
        bar++;
      }
    };
  }

  /* ══ C · TERMINAL ARP ══════════════════════════════════════════════
     Sin batería: un acorde con novena desgranado lento sobre una cama de
     drone, con delay largo. Movimiento sin percusión. */
  if (variant === 'terminal') {
    const BED_BASE = 420;
    const bed = ctx.createBiquadFilter();
    bed.type = 'lowpass';
    bed.Q.value = 1.2;
    bed.connect(tone);
    track(lfo(ctx, 0.02, 180, bed.frequency, BED_BASE));
    /* La cama se guarda en variables porque AHORA SE MUEVE con el acorde.
       Antes eran dos osciladores fijos en A2+E3 para siempre: cuando el
       arpegio pasaba a Fmaj9, la fundamental seguía diciendo A y el cambio
       quedaba flotando sobre un bajo que no acompañaba. Por eso "no se
       notaba" — no era que fuera poco frecuente, era que abajo no pasaba
       nada. */
    const bedRoot = drone(ctx, 'sawtooth', NOTE.A2, -6, bed, 0.13).osc;
    const bedFifth = drone(ctx, 'sawtooth', NOTE.E3, +4, bed, 0.09).osc;
    track(bedRoot);
    track(bedFifth);

    const air = ctx.createBiquadFilter();
    air.type = 'lowpass';
    air.frequency.value = 1200;
    const airG = ctx.createGain();
    airG.gain.value = 0.03;
    track(noiseSource(ctx, noise)).connect(air).connect(airG).connect(tone);

    /* Delay con realimentación — el eco es lo que lo hace sonar a sala de
       máquinas y no a caja de música. */
    const delay = ctx.createDelay(1.5);
    delay.delayTime.value = 0.48;
    const fb = ctx.createGain();
    fb.gain.value = 0.35;
    const damp = ctx.createBiquadFilter();
    damp.type = 'lowpass';
    damp.frequency.value = 1600;
    delay.connect(damp).connect(fb).connect(delay);
    delay.connect(tone);
    delay.connect(space);

    /* Cuatro acordes, no dos. Rotando cada 15s, un péndulo Am⇄Fm se vuelve
       MÁS repetitivo que antes, no menos: se oye el vaivén. Con cuatro, la
       vuelta completa tarda un minuto y cada cambio parece ir a algún lado.
       Todo diatónico a la menor de A — i · VI · III · VII. */
    const CHORDS = [
      { bed: [NOTE.A2, NOTE.E3], arp: [NOTE.A3, NOTE.C4, NOTE.E4, NOTE.G4, NOTE.B4] },  /* Am9   */
      { bed: [NOTE.F2, NOTE.C3], arp: [NOTE.F3, NOTE.A3, NOTE.C4, NOTE.E4, NOTE.G4] },  /* Fmaj9 */
      { bed: [NOTE.C3, NOTE.G3], arp: [NOTE.C4, NOTE.E4, NOTE.G4, NOTE.B4, NOTE.D4] },  /* Cmaj9 */
      { bed: [NOTE.G2, NOTE.D3], arp: [NOTE.G3, NOTE.B3, NOTE.D4, NOTE.E4, NOTE.A4] },  /* G6/9  */
    ];
    const STEP = 1.2;
    const CHORD_DUR = 15;   /* pedido explícito: cada 15s */

    /* Dos contadores independientes sobre la misma ventana: uno para las
       notas del arpegio y otro para los cambios de acorde. No coinciden a
       propósito — 15 no es múltiplo de 1.2, así que el arpegio cae en un
       lugar distinto de cada acorde y no se oye como un molde. */
    let n = -1;
    let chordN = -1;
    schedule = (from, to) => {
      /* ── Cambios de acorde: la cama baja y el filtro se abre ── */
      if (chordN < 0) chordN = Math.floor(from / CHORD_DUR);
      while (chordN * CHORD_DUR < to) {
        const t0 = chordN * CHORD_DUR;
        if (t0 >= from) {
          const c = CHORDS[chordN % CHORDS.length];
          /* Glissando de 1.4s en vez de salto: un cambio seco en un drone
             continuo se oye como un corte de cinta, no como una armonía. */
          for (const [osc, f] of [[bedRoot, c.bed[0]], [bedFifth, c.bed[1]]] as [OscillatorNode, number][]) {
            osc.frequency.setValueAtTime(osc.frequency.value, t0);
            osc.frequency.exponentialRampToValueAtTime(f, t0 + 1.4);
          }
          /* Golpe de brillo: el filtro se abre y vuelve. Es lo que convierte
             el cambio en un ACONTECIMIENTO en vez de en una modulación que
             pasa desapercibida. La automación del param y el LFO conectado se
             suman, así que esto no pelea con la respiración de fondo. */
          bed.frequency.cancelScheduledValues(t0);
          bed.frequency.setValueAtTime(BED_BASE, t0);
          bed.frequency.exponentialRampToValueAtTime(BED_BASE * 2.4, t0 + 0.5);
          bed.frequency.exponentialRampToValueAtTime(BED_BASE, t0 + 5);
        }
        chordN++;
      }

      /* ── Notas del arpegio ── */
      if (n < 0) n = Math.floor(from / STEP);
      while (n * STEP < to) {
        const t = n * STEP;
        if (t >= from) {
          const chord = CHORDS[Math.floor(t / CHORD_DUR) % CHORDS.length];
          /* La primera nota de cada acorde es la FUNDAMENTAL, y suena más
             fuerte: es el anuncio. El resto se saltea grados en vez de subir
             y bajar en escalera, que es lo que evita que se oiga como un
             ejercicio de piano. */
          const first = t % CHORD_DUR < STEP;
          const f = first ? chord.arp[0] : chord.arp[(n * 2 + Math.floor(n / 5)) % chord.arp.length];
          const o = ctx.createOscillator();
          const g = ctx.createGain();
          o.type = 'triangle';
          o.frequency.value = f;
          o.detune.value = (rand() * 2 - 1) * 5;
          g.gain.setValueAtTime(0.0001, t);
          g.gain.exponentialRampToValueAtTime(first ? 0.105 : 0.075, t + 0.03);
          g.gain.exponentialRampToValueAtTime(0.0001, t + (first ? 2.4 : 1.9));
          o.connect(g);
          g.connect(delay);
          g.connect(tone);
          o.start(t);
          o.stop(t + (first ? 2.5 : 2.0));
        }
        n++;
      }
    };
  }

  let stopped = false;

  return {
    variant,
    start() {
      if (stopped) return;
      const t = ctx.currentTime;
      master.gain.cancelScheduledValues(t);
      master.gain.setValueAtTime(Math.max(master.gain.value, 0.0001), t);
      master.gain.linearRampToValueAtTime(volume, t + fadeIn);
    },
    stop(fade = 1.2) {
      if (stopped) return;
      stopped = true;
      const t = ctx.currentTime;
      master.gain.cancelScheduledValues(t);
      master.gain.setValueAtTime(master.gain.value, t);
      master.gain.linearRampToValueAtTime(0.0001, t + fade);
      /* Recién después del fade se paran las fuentes: cortarlas en seco deja
         un click, que en un pad continuo se escucha como un golpe. */
      running.forEach(n => { try { n.stop(t + fade + 0.1); } catch { /* ya parado */ } });
      setTimeout(() => { try { master.disconnect(); } catch { /* ya desconectado */ } }, (fade + 0.3) * 1000);
    },
    setVolume(v) {
      const t = ctx.currentTime;
      master.gain.cancelScheduledValues(t);
      master.gain.setValueAtTime(master.gain.value, t);
      master.gain.linearRampToValueAtTime(Math.max(0.0001, v), t + 0.15);
    },
    schedule,
  };
}

/* Envoltorio para uso en vivo: mantiene la ventana de programación
   adelantada al reloj con un timer de JS. Offline no se usa —ahí se llama
   `schedule(0, duracion)` una sola vez. */
export function runLive(handle: AmbientHandle, ctx: BaseAudioContext, aheadSec = 12): () => void {
  let horizon = ctx.currentTime;
  const pump = () => {
    const to = ctx.currentTime + aheadSec;
    if (to > horizon) { handle.schedule(horizon, to); horizon = to; }
  };
  pump();
  const id = setInterval(pump, (aheadSec / 2) * 1000);
  return () => clearInterval(id);
}
