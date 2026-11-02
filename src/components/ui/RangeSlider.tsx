// Two-thumb range (plan 08): two native range inputs over one rail, so keyboard and screen readers
// get real sliders. Thumbs move freely while dragged and commit on the native `change` event (a
// release, touch included; React's onChange fires on every step instead), keyboard steps after a
// pause, and on blur. Clamped so the low value never passes the high one.
import { useEffect, useRef, useState, type ChangeEvent, type CSSProperties } from 'react';

/** Arrow keys step one dollar at a time: wait for the shopper to pause before querying. */
const KEY_COMMIT_DELAY_MS = 500;

interface Props {
  min: number;
  max: number;
  value: [number, number];
  onCommit: (value: [number, number]) => void;
  format: (n: number) => string;
  minLabel: string;
  maxLabel: string;
  className?: string;
}

export default function RangeSlider({ min, max, value, onCommit, format, minLabel, maxLabel, className = '' }: Props) {
  const [lo, setLo] = useState(value[0]);
  const [hi, setHi] = useState(value[1]);
  useEffect(() => {
    setLo(value[0]);
    setHi(value[1]);
  }, [value[0], value[1]]);

  const span = max - min || 1;
  // Only a moved thumb commits. The ref holds the latest values so a delayed commit never sends a stale pair.
  const latest = useRef({ lo, hi, value, onCommit });
  latest.current = { lo, hi, value, onCommit };
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const commit = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    const { lo: l, hi: h, value: v, onCommit: send } = latest.current;
    if (l !== v[0] || h !== v[1]) send([l, h]);
  };
  const commitSoon = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(commit, KEY_COMMIT_DELAY_MS);
  };
  // Native change, not React's onChange: it fires once per release (or per key step).
  const loInput = useRef<HTMLInputElement>(null);
  const hiInput = useRef<HTMLInputElement>(null);
  const viaKey = useRef(false);
  useEffect(() => {
    const inputs = [loInput.current, hiInput.current].filter((el): el is HTMLInputElement => el !== null);
    // A tick later, so React has applied the step before the commit reads it.
    const onNativeChange = () => (viaKey.current ? commitSoon() : setTimeout(commit, 0));
    const onKeyDown = () => (viaKey.current = true);
    const onPointerDown = () => (viaKey.current = false);
    for (const el of inputs) {
      el.addEventListener('change', onNativeChange);
      el.addEventListener('keydown', onKeyDown);
      el.addEventListener('pointerdown', onPointerDown);
    }
    return () => {
      for (const el of inputs) {
        el.removeEventListener('change', onNativeChange);
        el.removeEventListener('keydown', onKeyDown);
        el.removeEventListener('pointerdown', onPointerDown);
      }
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);
  const onLo = (event: ChangeEvent<HTMLInputElement>) => setLo(Math.min(Number(event.target.value), hi));
  const onHi = (event: ChangeEvent<HTMLInputElement>) => setHi(Math.max(Number(event.target.value), lo));
  // When both thumbs meet at the top, the low thumb must stay reachable.
  const loOnTop = lo >= max - span * 0.05;
  const style = { '--lo': (lo - min) / span, '--hi': (hi - min) / span } as CSSProperties;

  return (
    <div className={['ui-range', className].filter(Boolean).join(' ')}>
      <div className="ui-range__values" aria-hidden="true">
        <span>{format(lo)}</span>
        <span>{format(hi)}</span>
      </div>
      <div className="ui-range__control" style={style}>
        <span className="ui-range__fill" />
        <input
          ref={loInput} type="range" className={`ui-range__input${loOnTop ? ' ui-range__input--top' : ''}`}
          min={min} max={max} step={1} value={lo}
          aria-label={minLabel} aria-valuetext={format(lo)}
          onChange={onLo} onBlur={commit}
        />
        <input
          ref={hiInput} type="range" className="ui-range__input"
          min={min} max={max} step={1} value={hi}
          aria-label={maxLabel} aria-valuetext={format(hi)}
          onChange={onHi} onBlur={commit}
        />
      </div>
    </div>
  );
}
