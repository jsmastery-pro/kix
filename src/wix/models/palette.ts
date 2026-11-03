// The Customize panel's colors (plan 12): the same 16 for every zone. Shoe color data like the
// presets' hexes in ProductModels, not UI styling, so it lives here rather than in global.css.
// Hexes tuned by eye in the 3D view (RoomEnvironment lighting, neutral-shaded models).
export interface PaletteColor {
  name: string;
  hex: string;
}

export const PALETTE: readonly PaletteColor[] = [
  { name: 'White', hex: '#F4F4F2' },
  { name: 'Sail', hex: '#EDE6D6' },
  { name: 'Gum', hex: '#B5835A' },
  { name: 'Wolf Grey', hex: '#A3A6AB' },
  { name: 'Graphite', hex: '#3C3F44' },
  { name: 'Black', hex: '#1F1F1F' },
  { name: 'Red', hex: '#C8102E' },
  { name: 'Orange', hex: '#F2711C' },
  { name: 'Volt', hex: '#D4F33A' },
  { name: 'Sage', hex: '#A9BFA0' },
  { name: 'Forest', hex: '#2F4F3A' },
  { name: 'Sky', hex: '#8EC5E8' },
  { name: 'Royal', hex: '#2453B8' },
  { name: 'Navy', hex: '#1E365E' },
  { name: 'Pink', hex: '#F4A6C0' },
  { name: 'Grape', hex: '#5B3F8C' },
];

/** The palette name for a hex, or null (an Original color that isn't in the palette). */
export function paletteName(hex: string | undefined): string | null {
  if (!hex) return null;
  const upper = hex.toUpperCase();
  return PALETTE.find((c) => c.hex === upper)?.name ?? null;
}
