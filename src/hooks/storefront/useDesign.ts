// The product page's design state (plan 12): which zone the Customize panel edits, the custom zone
// colors and the saved design they came from. `zones` null means the shoe shows its base: the preset
// the 3D view resolved (plan 11's rule), or a loaded design's own colors when its stock color can't
// be picked. "Customized" means custom colors exist, whether or not the panel is open.
import { useCallback, useMemo, useState } from 'react';
import type { SavedDesign } from '../../wix/models/designs';
import type { Preset, Zone, ZoneColors } from '../../wix/models/presets';

interface State {
  open: boolean;
  zone: Zone | null;
  zones: ZoneColors | null;
  savedId: string | null;
  baseOverride: Preset | null;
  /** Bumped when the design is replaced (reset, start over, load), so late async results can tell. */
  rev: number;
}

const INITIAL: State = { open: false, zone: null, zones: null, savedId: null, baseOverride: null, rev: 0 };

/** A design to load: a saved one (with its id) or a pending one from before sign-in (without). */
export type LoadableDesign = Pick<SavedDesign, 'baseChoiceId' | 'baseColor' | 'zones'> & { id?: string };

export function useDesign(preset: Preset | null, zonesOnModel: Zone[]) {
  const [state, setState] = useState<State>(INITIAL);
  const base = state.baseOverride ?? preset;
  const zone = state.zone && zonesOnModel.includes(state.zone) ? state.zone : (zonesOnModel[0] ?? null);

  const openPanel = useCallback(() => setState((s) => ({ ...s, open: true })), []);
  const closePanel = useCallback(() => setState((s) => ({ ...s, open: false })), []);
  const selectZone = useCallback((next: Zone) => setState((s) => ({ ...s, zone: next })), []);
  const pick = useCallback(
    (target: Zone, hex: string) => setState((s) => ({ ...s, zones: { ...(s.zones ?? (s.baseOverride ?? preset)?.zones), [target]: hex } })),
    [preset],
  );
  /** Back to the base colors; the link to an opened saved design goes too. */
  const reset = useCallback(() => setState((s) => ({ ...s, zones: null, savedId: null, rev: s.rev + 1 })), []);
  /** A stock color pick: drop the custom colors and any loaded design's base. */
  const startOver = useCallback(() => setState((s) => ({ ...s, zones: null, savedId: null, baseOverride: null, rev: s.rev + 1 })), []);
  /** Shows a design and opens the panel. `ownBase` keeps its colors as Original when its stock color can't be picked. */
  const load = useCallback((design: LoadableDesign, ownBase: boolean) => {
    setState((s) => ({
      ...s,
      open: true,
      zones: { ...design.zones },
      savedId: design.id ?? null,
      baseOverride: ownBase ? { choiceId: design.baseChoiceId, colorName: design.baseColor, zones: design.zones } : null,
      rev: s.rev + 1,
    }));
  }, []);
  const saved = useCallback((id: string) => setState((s) => ({ ...s, savedId: id })), []);

  return useMemo(
    () => ({
      open: state.open,
      zone,
      base,
      /** Custom colors, or null when the shoe shows its base. */
      custom: state.zones,
      /** What the shoe shows now. */
      shown: state.zones ?? base?.zones ?? null,
      /** Colors the gallery shows instead of its own preset; null lets the preset show. */
      override: state.zones ?? state.baseOverride?.zones ?? null,
      customized: state.zones !== null,
      savedId: state.savedId,
      rev: state.rev,
      openPanel,
      closePanel,
      selectZone,
      pick,
      reset,
      startOver,
      load,
      saved,
    }),
    [state, zone, base, openPanel, closePanel, selectZone, pick, reset, startOver, load, saved],
  );
}

// A design waiting for sign-in: stored before the Sign In to Save link navigates, read once on return
// (?resume=design). Storage can be off (private mode, blocked): then the shopper just returns to the page.
const PENDING_KEY = 'kix-pending-design';

export interface PendingDesign extends LoadableDesign {
  productId: string;
}

export function storePendingDesign(pending: PendingDesign): void {
  try {
    sessionStorage.setItem(PENDING_KEY, JSON.stringify(pending));
  } catch {
    /* storage off: nothing to resume */
  }
}

/** The pending design for this product, removed whether or not it matches. Zones are re-checked by the caller's validator. */
export function takePendingDesign(productId: string): PendingDesign | null {
  try {
    const raw = sessionStorage.getItem(PENDING_KEY);
    sessionStorage.removeItem(PENDING_KEY);
    const pending = raw ? (JSON.parse(raw) as PendingDesign) : null;
    return pending?.productId === productId ? pending : null;
  } catch {
    return null;
  }
}
