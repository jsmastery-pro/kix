// A product's 3D model as the product page needs it (plan 11): the ProductModels row (plan 10)
// trimmed to the model URL, each part's zone and each color's zone colors. Client-safe: no
// server-only imports, so the gallery island can use it. resolvePreset picks the colors to show.
import { mediaKey } from '../media';
import type { OptionChoice } from '../storefront/types';

export const ZONES = ['upper', 'sole', 'laces', 'accent'] as const;
export type Zone = (typeof ZONES)[number];
export type ZoneColors = Partial<Record<Zone, string>>;

export interface ProductModel {
  modelUrl: string;
  /** Mesh name (tripo_part_N) → the zone a preset colors. */
  parts: { node: string; zone: Zone }[];
  /** One per Wix color choice, by choiceId. */
  presets: { choiceId: string; zones: ZoneColors }[];
}

export interface ColorGroup {
  choices: (Pick<OptionChoice, 'choiceId' | 'name' | 'imageUrl'> & { selected: boolean })[];
}

/**
 * The colors to show: the shopper's color pick, else the color whose photo is in the frame, else the
 * first choice with a preset. Null zones mean the GLB's own colors (its made color).
 */
export function resolvePreset(model: ProductModel, colors: ColorGroup | null, framePhotoUrl: string | null): { zones: ZoneColors | null; colorName: string | null } {
  const presetFor = (choiceId: string) => model.presets.find((p) => p.choiceId === choiceId) ?? null;
  const choices = colors?.choices ?? [];
  const frameKey = framePhotoUrl ? mediaKey(framePhotoUrl) : '';
  const choice =
    choices.find((c) => c.selected && presetFor(c.choiceId)) ??
    (frameKey ? choices.find((c) => c.imageUrl && mediaKey(c.imageUrl) === frameKey && presetFor(c.choiceId)) : undefined) ??
    choices.find((c) => presetFor(c.choiceId));
  return choice ? { zones: presetFor(choice.choiceId)!.zones, colorName: choice.name } : { zones: null, colorName: null };
}
