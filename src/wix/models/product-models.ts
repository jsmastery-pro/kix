// Reads a product's ProductModels row (plan 10's CMS collection, _id = the Stores product ID) for
// the product page (plan 11). One Get Data Item call through the kit's wixFetch, so no @wix/data
// package; the collection is readable by anyone. No row, a failed read or an invalid row all mean
// "no 3D", logged, never an error for the page.
// docs: https://dev.wix.com/docs/api-reference/business-solutions/cms/data-items/get-data-item.md
import { wixFetch } from '../sdk';
import { ZONES, type ProductModel, type Zone, type ZoneColors } from './presets';

const COLLECTION = 'ProductModels';
const HEX = /^#[0-9a-f]{6}$/i;

const isZone = (value: unknown): value is Zone => ZONES.includes(value as Zone);

/** The row → the island's DTO, or null when any field is off. */
function toModel(data: Record<string, any>): ProductModel | null {
  const { modelUrl, parts, presets } = data;
  if (typeof modelUrl !== 'string' || !modelUrl.startsWith('https://static.wixstatic.com/')) return null;
  if (!Array.isArray(parts) || !Array.isArray(presets) || parts.length === 0) return null;
  const outParts: ProductModel['parts'] = [];
  for (const part of parts) {
    if (typeof part?.node !== 'string' || !isZone(part.zone)) return null;
    outParts.push({ node: part.node, zone: part.zone });
  }
  const outPresets: ProductModel['presets'] = [];
  for (const preset of presets) {
    if (typeof preset?.choiceId !== 'string' || !preset.zones || typeof preset.zones !== 'object') return null;
    const zones: ZoneColors = {};
    for (const [zone, hex] of Object.entries(preset.zones)) {
      if (!isZone(zone) || typeof hex !== 'string' || !HEX.test(hex)) return null;
      zones[zone] = hex;
    }
    outPresets.push({ choiceId: preset.choiceId, zones });
  }
  return { modelUrl, parts: outParts, presets: outPresets };
}

export async function fetchProductModel(productId: string): Promise<ProductModel | null> {
  try {
    const res = await wixFetch(`/wix-data/v2/items/${encodeURIComponent(productId)}?dataCollectionId=${COLLECTION}`);
    if (res.status === 404) return null;
    if (!res.ok) {
      console.error('[models] ProductModels read failed', productId, res.status);
      return null;
    }
    const body = (await res.json()) as { dataItem?: { data?: Record<string, any> } };
    const model = body.dataItem?.data ? toModel(body.dataItem.data) : null;
    if (!model) console.error('[models] invalid ProductModels row', productId);
    return model;
  } catch (error) {
    console.error('[models] ProductModels read failed', productId, error);
    return null;
  }
}
