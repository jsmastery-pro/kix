// A color filter toggle (plan 08). The fill is the catalog's own hex, so it arrives as data in
// --swatch-color; a choice without one gets the muted fill and a ring. `pending` keeps the dot
// focusable but announces it unavailable until the filter can take it.
import type { CSSProperties } from 'react';

interface Props {
  name: string;
  hex: string | null;
  count: number;
  pressed: boolean;
  pending?: boolean;
  onToggle: () => void;
}

export default function ColorDot({ name, hex, count, pressed, pending = false, onToggle }: Props) {
  const label = `${name}, ${count} ${count === 1 ? 'sneaker' : 'sneakers'}`;
  return (
    <button
      type="button"
      className={`ui-color-dot${hex ? '' : ' ui-color-dot--none'}`}
      style={hex ? ({ '--swatch-color': hex } as CSSProperties) : undefined}
      aria-pressed={pressed}
      aria-disabled={pending || undefined}
      aria-label={label}
      title={name}
      onClick={() => {
        if (!pending) onToggle();
      }}
    />
  );
}
