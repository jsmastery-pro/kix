// Design codes (plan 13): a customized pair's colors as a short code on its cart line and order,
// e.g. KIX-D6S0. One character per zone in ZONES order (upper, sole, laces, accent):
//   0-9, A-F  the PALETTE color at that index (so PALETTE is append-only, 16 at most)
//   S         the stock color: that zone's color in the preset of the line's Color
//   -         the model has no such part
// Client-safe. The product page writes it into the products' "Design code" field; the cart, the
// thank-you page and the account read it back from the line's description and link to ?code=.
import { PALETTE } from './palette';
import { ZONES, type Zone, type ZoneColors } from './presets';

/** The products' free-text modifier the code is sent in (added by .seed/design-code.mjs). */
export const DESIGN_CODE_FIELD = 'Design code';

const PREFIX = 'KIX-';
const DIGITS = '0123456789ABCDEF';
const CODE = /^KIX-[0-9A-FS-]{4}$/;
// No trailing \b: a code can end in "-", which isn't a word character.
const IN_TEXT = /(?:^|[\s:])(KIX-[0-9A-FS-]{4})(?=\s|$)/;

const same = (a: string | undefined, b: string | undefined) => Boolean(a && b && a.toUpperCase() === b.toUpperCase());

/** The code for the colors shown, against the line's stock colors. Null when a zone is neither stock nor a palette color. */
export function encodeDesignCode(shown: ZoneColors, stock: ZoneColors, zonesOnModel: readonly Zone[]): string | null {
  let code = PREFIX;
  for (const zone of ZONES) {
    if (!zonesOnModel.includes(zone)) {
      code += '-';
      continue;
    }
    const hex = shown[zone] ?? stock[zone];
    if (!hex || same(hex, stock[zone])) {
      code += 'S';
      continue;
    }
    const index = PALETTE.findIndex((color) => same(color.hex, hex));
    if (index < 0 || index >= DIGITS.length) return null;
    code += DIGITS[index];
  }
  return code;
}

/** The colors a code stands for, or null when it doesn't fit this model (or needs a stock color it wasn't given). */
export function decodeDesignCode(code: string, stock: ZoneColors | null, zonesOnModel: readonly Zone[]): ZoneColors | null {
  const normalized = code.trim().toUpperCase();
  if (!CODE.test(normalized)) return null;
  const zones: ZoneColors = {};
  for (const [i, zone] of ZONES.entries()) {
    const char = normalized[PREFIX.length + i];
    const onModel = zonesOnModel.includes(zone);
    if (char === '-') {
      if (onModel) return null;
      continue;
    }
    if (!onModel) return null;
    const hex = char === 'S' ? stock?.[zone] : PALETTE[DIGITS.indexOf(char)]?.hex;
    if (!hex) return null;
    zones[zone] = hex;
  }
  return zones;
}

/** A code with at least one palette color; all stock (KIX-SSSS, KIX-SS--) adds as the stock pair. */
export const isCustomCode = (code: string) => /[0-9A-F]/.test(code.slice(PREFIX.length));

/** The design code in a line's description ("Design code: KIX-D6S0"), or null. */
export function findDesignCode(lines: readonly string[]): string | null {
  for (const line of lines) {
    const match = line.match(IN_TEXT);
    if (match) return match[1];
  }
  return null;
}

/** The product page with the design open in 3D, on the line's Color when known. */
export function designLink(slug: string, code: string, colorName?: string | null): string {
  const params = new URLSearchParams({ code });
  if (colorName) params.set('color', colorName);
  return `/products/${encodeURIComponent(slug)}?${params}`;
}
