// One product option as the design's pickers (plan 09): round swatches for a color option, a
// 5-column grid of pills otherwise. It renders the kit's OptionGroupView (selected, inStock and exists
// per choice, judged against the other picks) and reports clicks; selection lives in the kit's store.
import type { CSSProperties } from 'react';
import type { OptionGroupView } from '../../hooks/storefront/useProductDetail';

interface Props {
  group: OptionGroupView;
  onSelect: (optionId: string, choiceId: string) => void;
  className?: string;
}

export default function OptionGroup({ group, onSelect, className = '' }: Props) {
  const picked = group.choices.find((c) => c.selected);
  const swatches = group.isColor && group.choices.every((c) => c.colorCode);
  return (
    <fieldset className={['ui-option-group', className].filter(Boolean).join(' ')} data-option-group={group.id}>
      <legend className="ui-option-group__label">
        {group.name}
        {group.isColor && picked && <>: <span className="ui-option-group__value">{picked.name}</span></>}
      </legend>
      <div className={swatches ? 'ui-swatch-list' : 'ui-size-grid'}>
        {group.choices.map((c) => {
          // unavailable = sold out with the other picks, or no variant has this combination (kit rule)
          const unavailable = !c.inStock || !c.exists;
          const label = unavailable ? `${c.name}, unavailable` : c.name;
          return swatches ? (
            <button
              key={c.choiceId}
              type="button"
              className="ui-swatch"
              style={{ '--swatch-color': c.colorCode } as CSSProperties}
              aria-pressed={c.selected}
              aria-label={label}
              title={label}
              disabled={unavailable}
              onClick={() => onSelect(group.id, c.choiceId)}
            />
          ) : (
            <button
              key={c.choiceId}
              type="button"
              className="ui-size-option"
              aria-pressed={c.selected}
              aria-label={unavailable ? label : undefined}
              disabled={unavailable}
              onClick={() => onSelect(group.id, c.choiceId)}
            >
              {c.name}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
