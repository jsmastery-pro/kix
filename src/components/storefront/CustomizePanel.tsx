// The Customize panel (plan 12): opened from the 3D view's Customize pill, it sits in the buy column
// under the Color picker. One chip per zone the model has, that zone's Original color plus the Kix
// palette, Reset, Save Design (or Sign In to Save) and this shoe's saved designs. Built from the
// design system's primitives, since there is no design for it. State lives in ProductView.
import { Bookmark, ChevronRight, LoaderCircle, RotateCcw, X } from 'lucide-react';
import type { CSSProperties, Ref } from 'react';
import type { SavedDesign } from '../../wix/models/designs';
import { PALETTE, paletteName } from '../../wix/models/palette';
import type { Zone, ZoneColors } from '../../wix/models/presets';

export const ZONE_LABELS: Record<Zone, string> = { upper: 'Upper', sole: 'Sole', laces: 'Laces', accent: 'Accent' };

export type SaveState =
  | { kind: 'checking' }
  | { kind: 'signed_out'; href: string }
  | { kind: 'signed_in'; editing: boolean; busy: boolean };

export type ListState = { kind: 'hidden' } | { kind: 'loading' } | { kind: 'error' } | { kind: 'ready'; designs: SavedDesign[] };

export interface Status {
  tone?: 'done' | 'error';
  text: string;
  link?: { href: string; label: string };
}

interface Props {
  id: string;
  headingRef: Ref<HTMLHeadingElement>;
  zones: Zone[];
  zone: Zone;
  /** The colors the shoe shows now. */
  shown: ZoneColors;
  /** The base colors (each zone's Original swatch). */
  original: ZoneColors;
  save: SaveState;
  list: ListState;
  /** A stock color's preset colors, to name a saved design's untouched zones "original". */
  presetZones: (choiceId: string) => ZoneColors | undefined;
  /** The saved design on show, if any. */
  activeId: string | null;
  status: Status | null;
  onZone: (zone: Zone) => void;
  onPick: (zone: Zone, hex: string) => void;
  onReset: () => void;
  onClose: () => void;
  onSave: (asNew: boolean) => void;
  onSignIn: () => void;
  onOpenDesign: (design: SavedDesign) => void;
  onRetryList: () => void;
}

const savedDate = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' });
const same = (a: string | undefined, b: string | undefined) => Boolean(a && b && a.toUpperCase() === b.toUpperCase());

/** "Royal", "Original" or "Custom" for a zone's color. */
export function colorLabel(hex: string | undefined, original: string | undefined): string {
  return same(hex, original) ? 'Original' : (paletteName(hex) ?? 'Custom');
}

/** A design's colors as dots (decorative: the caller names them). */
export function DesignDots({ zones, colors }: { zones: Zone[]; colors: ZoneColors }) {
  return (
    <span className="ui-design-dots" aria-hidden="true">
      {zones.filter((z) => colors[z]).map((z) => <span key={z} style={{ '--swatch-color': colors[z] } as CSSProperties} />)}
    </span>
  );
}

export default function CustomizePanel(p: Props) {
  const current = p.shown[p.zone];
  const original = p.original[p.zone];
  const label = ZONE_LABELS[p.zone];
  const describe = (d: SavedDesign) => {
    const base = p.presetZones(d.baseChoiceId);
    const names = p.zones.filter((z) => d.zones[z]).map((z) => `${ZONE_LABELS[z].toLowerCase()} ${colorLabel(d.zones[z], base?.[z]).toLowerCase()}`);
    return `Design saved ${savedDate.format(new Date(d.savedAt))}: ${names.join(', ')}`;
  };

  return (
    <section id={p.id} className="ui-customize pdp__customize" aria-labelledby={`${p.id}-title`}>
      <div className="ui-customize__head">
        <h2 ref={p.headingRef} id={`${p.id}-title`} className="ui-customize__title" tabIndex={-1}>Customize</h2>
        <button type="button" className="ui-text-button" onClick={p.onReset}>
          <RotateCcw aria-hidden="true" />Reset
        </button>
        <button type="button" className="ui-icon-button ui-icon-button--plain ui-customize__close" aria-label="Close customize" title="Close customize" onClick={p.onClose}>
          <X aria-hidden="true" />
        </button>
      </div>

      <div className="ui-customize__zones" role="group" aria-label="Part">
        {p.zones.map((z) => (
          <button key={z} type="button" className="ui-size-option ui-zone-option" aria-pressed={z === p.zone} onClick={() => p.onZone(z)}>
            <span className="ui-zone-option__dot" style={{ '--swatch-color': p.shown[z] } as CSSProperties} aria-hidden="true" />
            {ZONE_LABELS[z]}
          </button>
        ))}
      </div>

      <p className="ui-option-group__label ui-customize__label" id={`${p.id}-color`}>
        {label}: <span className="ui-option-group__value">{colorLabel(current, original)}</span>
      </p>
      <div className="ui-customize__swatches" role="group" aria-labelledby={`${p.id}-color`}>
        {original && (
          <button
            type="button"
            className="ui-swatch ui-swatch--sm"
            style={{ '--swatch-color': original } as CSSProperties}
            aria-pressed={same(current, original)}
            aria-label={`Original${paletteName(original) ? `, ${paletteName(original)}` : ''}`}
            title="Original"
            onClick={() => p.onPick(p.zone, original)}
          />
        )}
        {PALETTE.map((c) => (
          <button
            key={c.hex}
            type="button"
            className="ui-swatch ui-swatch--sm"
            style={{ '--swatch-color': c.hex } as CSSProperties}
            aria-pressed={same(current, c.hex) && !same(current, original)}
            aria-label={c.name}
            title={c.name}
            onClick={() => p.onPick(p.zone, c.hex)}
          />
        ))}
      </div>

      <div className="ui-customize__save">
        {p.save.kind === 'signed_out' ? (
          <a className="ui-button ui-button--quiet ui-button--wide" href={p.save.href} onClick={p.onSignIn}>
            <span className="ui-button__left"><Bookmark aria-hidden="true" />Sign In to Save</span>
            <ChevronRight aria-hidden="true" />
          </a>
        ) : (
          <button
            type="button"
            className="ui-button ui-button--quiet ui-button--wide"
            aria-busy={p.save.kind === 'checking' || p.save.busy}
            aria-disabled={p.save.kind === 'checking' || p.save.busy}
            onClick={() => p.save.kind === 'signed_in' && !p.save.busy && p.onSave(false)}
          >
            <span className="ui-button__left">
              <LoaderCircle className="ui-button__spinner" aria-hidden="true" />
              {!(p.save.kind === 'checking' || p.save.busy) && <Bookmark aria-hidden="true" />}
              {p.save.kind === 'signed_in' && p.save.busy ? 'Saving…' : p.save.kind === 'signed_in' && p.save.editing ? 'Save Changes' : 'Save Design'}
            </span>
            <ChevronRight aria-hidden="true" />
          </button>
        )}
        {p.save.kind === 'signed_in' && p.save.editing && (
          <button type="button" className="ui-text-button" disabled={p.save.busy} onClick={() => p.onSave(true)}>Save as New</button>
        )}
      </div>

      <p className={`ui-status-line ui-customize__status${p.status?.tone ? ` ui-status-line--${p.status.tone}` : ''}`} role="status">
        {p.status?.text}
        {p.status?.link && <> <a href={p.status.link.href}>{p.status.link.label}</a></>}
      </p>
      <p className="ui-customize__note">Add to Cart adds the stock color. Save your design to keep it.</p>

      {p.list.kind !== 'hidden' && !(p.list.kind === 'ready' && p.list.designs.length === 0) && (
        <div className="ui-customize__designs">
          <h3 className="ui-customize__subtitle">Your designs</h3>
          {p.list.kind === 'loading' && (
            <div className="ui-customize__list" aria-busy="true" aria-label="Loading your designs">
              <span className="ui-skeleton-line" /><span className="ui-skeleton-line" />
            </div>
          )}
          {p.list.kind === 'error' && (
            <p className="ui-customize__error">
              We couldn't load your designs. <button type="button" className="ui-text-button" onClick={p.onRetryList}>Retry</button>
            </p>
          )}
          {p.list.kind === 'ready' && (
            <ul className="ui-customize__list">
              {p.list.designs.map((d) => (
                <li key={d.id}>
                  <button type="button" className="ui-customize__design" aria-pressed={d.id === p.activeId} aria-label={describe(d)} onClick={() => p.onOpenDesign(d)}>
                    <DesignDots zones={p.zones} colors={d.zones} />
                    <span>Saved {savedDate.format(new Date(d.savedAt))}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
