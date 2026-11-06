// Small shared pieces: board marks, confetti, sound effects and number formatters.

export const Mark = ({ v }: { v: string }) =>
  v === 'X' ? (
    <svg viewBox="0 0 40 40" className="mark x" aria-hidden>
      <path d="M8 8L32 32M32 8L8 32" />
    </svg>
  ) : v === 'O' ? (
    <svg viewBox="0 0 40 40" className="mark o" aria-hidden>
      <circle cx="20" cy="20" r="13" />
    </svg>
  ) : null;

const CONFETTI_COLORS = ['#5eead4', '#a78bfa', '#fbbf24', '#f472b6'];

export const Confetti = () => (
  <div className="confetti" aria-hidden>
    {Array.from({ length: 36 }, (_, i) => (
      <i
        key={i}
        style={{ left: `${(i * 53) % 100}%`, animationDelay: `${(i % 9) * 0.12}s`, background: CONFETTI_COLORS[i % 4] }}
      />
    ))}
  </div>
);

// Tiny Web Audio synth, so there are no sound files to ship.
let ctx: AudioContext | null = null;
function beep(freq: number, dur = 0.12, type: OscillatorType = 'square', delay = 0) {
  try {
    ctx ??= new AudioContext();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    const t = ctx.currentTime + delay;
    o.type = type;
    o.frequency.value = freq;
    g.gain.setValueAtTime(0.06, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g).connect(ctx.destination);
    o.start(t);
    o.stop(t + dur);
  } catch {
    /* audio unavailable */
  }
}

export const sfx = {
  place: (x: boolean) => beep(x ? 520 : 390, 0.1),
  win: () => [523, 659, 784, 1046].forEach((f, i) => beep(f, 0.18, 'triangle', i * 0.1)),
  lose: () => [330, 262, 196].forEach((f, i) => beep(f, 0.22, 'sawtooth', i * 0.14)),
  draw: () => [392, 392].forEach((f, i) => beep(f, 0.15, 'triangle', i * 0.15))
};

// Browsers clamp performance.now() to about 0.1 ms, so 0 means "faster than the clock can tell".
export function formatMs(ms: number) {
  if (!Number.isFinite(ms) || ms < 0) return '—';
  return ms === 0 ? '< 0.10 ms' : `${ms.toFixed(2)} ms`;
}

export const formatNodes = (n: number) => n.toLocaleString('en-US');
export const formatPct = (p: number | null) => (p === null ? '—' : `${p.toFixed(2)}%`);
export const formatCell = (c: number | null) => (c === null ? '—' : `cell ${c + 1}`);

/** Run `fn` after the current state has painted, so a long synchronous search never freezes a stale frame. */
export function afterPaint(fn: () => void) {
  let done = false;
  const go = () => {
    if (done) return;
    done = true;
    fn();
  };
  requestAnimationFrame(() => setTimeout(go, 0));
  // Frames are not guaranteed (background tab), so a fallback makes sure fn still runs.
  setTimeout(go, 200);
}
