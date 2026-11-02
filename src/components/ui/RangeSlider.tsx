// Two-thumb range (plan 08): two native range inputs over one rail, so keyboard and screen readers
// get real sliders. Thumbs move freely while dragged and commit once on release (pointer up, key up
// or blur; React's onChange fires on every step), clamped so the low value never passes the high one.
import { useEffect, useState, type ChangeEvent, type CSSProperties } from 'react';

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
  // Tab, blur and pointer-up all land here; only a moved thumb commits.
  const commit = () => {
    if (lo !== value[0] || hi !== value[1]) onCommit([lo, hi]);
  };
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
          type="range" className={`ui-range__input${loOnTop ? ' ui-range__input--top' : ''}`}
          min={min} max={max} step={1} value={lo}
          aria-label={minLabel} aria-valuetext={format(lo)}
          onChange={onLo} onPointerUp={commit} onKeyUp={commit} onBlur={commit}
        />
        <input
          type="range" className="ui-range__input"
          min={min} max={max} step={1} value={hi}
          aria-label={maxLabel} aria-valuetext={format(hi)}
          onChange={onHi} onPointerUp={commit} onKeyUp={commit} onBlur={commit}
        />
      </div>
    </div>
  );
}
