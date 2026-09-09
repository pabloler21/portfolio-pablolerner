import { useCallback, useEffect, useRef, useState } from 'react';
import { Joystick } from 'react-joystick-component';
import { JoystickShape } from 'react-joystick-component';

/* Controles tactiles de la escena 3D.
 *
 * Unica isla React del sitio. No le habla a la escena por una API propia:
 * despacha KeyboardEvent sinteticos sobre `document`, que es donde
 * PortfolioScene ya escucha WASD y Space. Asi el joystick recorre EXACTAMENTE
 * el mismo camino que el teclado —mismo estado, mismas guardas, mismo tick—
 * en vez de abrir una segunda puerta de entrada que despues se desincroniza.
 */

const DEADZONE = 0.35;          // por debajo de esto el pulgar esta "centrado"
const MOVE_KEYS = ['KeyW', 'KeyA', 'KeyS', 'KeyD'] as const;

function sendKey(code: string, down: boolean) {
  document.dispatchEvent(
    new KeyboardEvent(down ? 'keydown' : 'keyup', { code, bubbles: true, cancelable: true }),
  );
}

/* El boton se rotula en el idioma de la pagina: estaba fijo en "[ SALTO ]" y
   salia asi tambien en /en/. */
const LABEL = { en: '[ JUMP ]', es: '[ SALTO ]' } as const;

export default function TouchControls({ lang = 'en' }: { lang?: 'en' | 'es' }) {
  /* Se muestra solo si el dispositivo es tactil Y la escena arranco de verdad:
     si WebGL falla, PortfolioScene muestra su fallback y un joystick flotando
     sobre una lista de links no controlaria nada. */
  const [isTouch, setIsTouch] = useState(false);
  const [sceneUp, setSceneUp] = useState(false);
  /* Antes habia un tercer pestillo (`personaChosen`): los controles esperaban a
     que se eligiera un rol porque el overlay del selector tenia z-index 9000 y
     el dedo le pegaba al overlay, no al joystick. Ese overlay ya no existe —la
     calle arranca sola— asi que el unico requisito que queda es que la escena
     este viva. */
  const held = useRef<Set<string>>(new Set());

  useEffect(() => {
    const mq = window.matchMedia('(hover: none) and (pointer: coarse)');
    const sync = () => setIsTouch(mq.matches);
    sync();
    mq.addEventListener('change', sync);

    const up = () => setSceneUp(true);
    const down = () => setSceneUp(false);
    window.addEventListener('nier:scene-ready', up);
    window.addEventListener('nier:scene-fallback', down);
    /* La escena puede haber arrancado antes de que hidrate esta isla. */
    if (document.documentElement.dataset.scene === 'ready') setSceneUp(true);

    return () => {
      mq.removeEventListener('change', sync);
      window.removeEventListener('nier:scene-ready', up);
      window.removeEventListener('nier:scene-fallback', down);
    };
  }, []);

  /* Soltar TODO al desmontar o al esconderse: una tecla que queda apretada
     deja al personaje caminando solo para siempre. */
  const releaseAll = useCallback(() => {
    held.current.forEach(code => sendKey(code, false));
    held.current.clear();
  }, []);
  useEffect(() => releaseAll, [releaseAll]);
  useEffect(() => {
    const onHide = () => { if (document.hidden) releaseAll(); };
    document.addEventListener('visibilitychange', onHide);
    return () => document.removeEventListener('visibilitychange', onHide);
  }, [releaseAll]);

  /* El joystick es analogico y el tick() consume -1/0/1 por eje, asi que se
     traduce a las mismas cuatro teclas. Se manda solo el DIFERENCIAL: repetir
     keydown en cada frame del joystick inundaria el handler sin necesidad. */
  const applyDirection = useCallback((x: number | null, y: number | null) => {
    const want = new Set<string>();
    if ((y ?? 0) > DEADZONE) want.add('KeyW');
    if ((y ?? 0) < -DEADZONE) want.add('KeyS');
    if ((x ?? 0) > DEADZONE) want.add('KeyD');
    if ((x ?? 0) < -DEADZONE) want.add('KeyA');

    for (const code of MOVE_KEYS) {
      const on = want.has(code);
      const was = held.current.has(code);
      if (on && !was) { held.current.add(code); sendKey(code, true); }
      else if (!on && was) { held.current.delete(code); sendKey(code, false); }
    }
  }, []);

  /* onPointerUp y onPointerLeave disparan los dos al levantar el dedo, asi que
     el keyup salia duplicado. Se lleva el estado para mandar uno solo. */
  const jumping = useRef(false);
  const jumpDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    if (jumping.current) return;
    jumping.current = true;
    sendKey('Space', true);
  }, []);
  const jumpUp = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    if (!jumping.current) return;
    jumping.current = false;
    sendKey('Space', false);
  }, []);

  if (!isTouch || !sceneUp) return null;

  return (
    <div className="tc-root" aria-hidden="true">
      <div className="tc-stick">
        <Joystick
          size={116}
          stickSize={52}
          /* Cuadrado, no redondo: la regla dura del design system es cero
             border-radius. La libreria lo soporta de fabrica. */
          baseShape={JoystickShape.Square}
          stickShape={JoystickShape.Square}
          baseColor="rgba(18, 21, 28, 0.72)"
          stickColor="rgba(94, 231, 170, 0.85)"
          throttle={60}
          move={e => applyDirection(e.x, e.y)}
          stop={() => applyDirection(0, 0)}
        />
      </div>

      <button
        type="button"
        className="tc-jump"
        onPointerDown={jumpDown}
        onPointerUp={jumpUp}
        onPointerCancel={jumpUp}
        onPointerLeave={jumpUp}
      >
        {LABEL[lang] ?? LABEL.en}
      </button>
    </div>
  );
}
