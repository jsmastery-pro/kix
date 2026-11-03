// Shoppers' saved designs (plan 12): the SavedDesigns CMS collection, read and written as the
// signed-in member through wixFetch. Wix's permissions do the access check (members read, update and
// remove only items they added), and every query also filters on _owner. Client-safe; the account
// page uses it on the server too. Every item is validated before use: a member can write anything
// to their own item.
// docs: https://dev.wix.com/docs/api-reference/business-solutions/cms/data-items/query-data-items.md
// docs: https://dev.wix.com/docs/api-reference/business-solutions/cms/data-items/insert-data-item.md
// docs: https://dev.wix.com/docs/api-reference/business-solutions/cms/data-items/update-data-item.md
import { wixFetch } from '../sdk';
import { ZONES, type Zone, type ZoneColors } from './presets';

const COLLECTION = 'SavedDesigns';
const HEX = /^#[0-9a-f]{6}$/i;

export interface SavedDesign {
  id: string;
  productId: string;
  productSlug: string;
  /** The product name when saved. */
  title: string;
  /** The stock color the design started from. */
  baseChoiceId: string;
  baseColor: string;
  zones: ZoneColors;
  /** ISO date of the last save (_updatedDate). */
  savedAt: string;
}

export type DesignInput = Omit<SavedDesign, 'id' | 'savedAt'>;

/** A failed call. `reason` is Wix's error code, the HTTP status, or 'network': safe for analytics. */
export class DesignError extends Error {
  constructor(readonly reason: string) {
    super(`SavedDesigns: ${reason}`);
  }
}

const isText = (value: unknown): value is string => typeof value === 'string' && value.length > 0;

/** Valid zone colors (known zones, #RRGGBB, at least one), or null. */
export function toZones(value: unknown): ZoneColors | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const zones: ZoneColors = {};
  for (const [zone, hex] of Object.entries(value)) {
    if (!ZONES.includes(zone as Zone) || typeof hex !== 'string' || !HEX.test(hex)) return null;
    zones[zone as Zone] = hex.toUpperCase();
  }
  return Object.keys(zones).length > 0 ? zones : null;
}

/** A data item → a design, or null when any field is off. */
export function toDesign(item: { id?: string; data?: Record<string, any> } | undefined): SavedDesign | null {
  const data = item?.data;
  if (!data) return null;
  const id = item.id ?? data._id;
  const zones = toZones(data.zones);
  const savedAt = data._updatedDate?.$date ?? data._updatedDate;
  if (!isText(id) || !isText(data.productId) || !isText(data.productSlug) || !isText(data.baseChoiceId) || !zones || !isText(savedAt)) return null;
  return {
    id,
    productId: data.productId,
    productSlug: data.productSlug,
    title: typeof data.title === 'string' ? data.title : '',
    baseChoiceId: data.baseChoiceId,
    baseColor: typeof data.baseColor === 'string' ? data.baseColor : '',
    zones,
    savedAt,
  };
}

async function request(path: string, init?: RequestInit): Promise<Response> {
  let res: Response;
  try {
    res = await wixFetch(path, init);
  } catch {
    throw new DesignError('network');
  }
  return res;
}

async function failure(res: Response): Promise<DesignError> {
  const body = (await res.json().catch(() => null)) as { details?: { applicationError?: { code?: string } } } | null;
  return new DesignError(body?.details?.applicationError?.code ?? String(res.status));
}

const json = (body: unknown): RequestInit => ({ method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

/** The member's designs, newest save first; `productId` narrows to one sneaker. Throws DesignError. */
/** `ownerId` is the member's `id` (what Wix writes to _owner; not `contactId`). */
export async function listDesigns(ownerId: string, options: { productId?: string; limit: number; fresh?: boolean }): Promise<SavedDesign[]> {
  const filter: Record<string, string> = { _owner: ownerId };
  if (options.productId) filter.productId = options.productId;
  const res = await request('/wix-data/v2/items/query', json({
    dataCollectionId: COLLECTION,
    query: { filter, sort: [{ fieldName: '_updatedDate', order: 'DESC' }], paging: { limit: options.limit } },
    consistentRead: options.fresh ?? false,
  }));
  if (!res.ok) throw await failure(res);
  const body = (await res.json()) as { dataItems?: { id?: string; data?: Record<string, any> }[] };
  const designs: SavedDesign[] = [];
  for (const item of body.dataItems ?? []) {
    const design = toDesign(item);
    if (design) designs.push(design);
    else console.error('[designs] invalid SavedDesigns item', item.id);
  }
  return designs;
}

/** One design, or null when it's missing, not the caller's, or invalid. Throws DesignError on other failures. */
export async function getDesign(id: string): Promise<SavedDesign | null> {
  const res = await request(`/wix-data/v2/items/${encodeURIComponent(id)}?dataCollectionId=${COLLECTION}`);
  if (res.status === 404 || res.status === 403) return null;
  if (!res.ok) throw await failure(res);
  const body = (await res.json()) as { dataItem?: { id?: string; data?: Record<string, any> } };
  return toDesign(body.dataItem);
}

/** Inserts a design, or replaces design `id` (Update replaces the whole payload). Throws DesignError. */
export async function saveDesign(input: DesignInput, id?: string): Promise<SavedDesign> {
  const data = {
    title: input.title,
    productId: input.productId,
    productSlug: input.productSlug,
    baseChoiceId: input.baseChoiceId,
    baseColor: input.baseColor,
    zones: input.zones,
  };
  const res = id
    ? await request(`/wix-data/v2/items/${encodeURIComponent(id)}`, { ...json({ dataCollectionId: COLLECTION, dataItem: { id, data } }), method: 'PUT' })
    : await request('/wix-data/v2/items', json({ dataCollectionId: COLLECTION, dataItem: { data } }));
  if (!res.ok) throw await failure(res);
  const body = (await res.json()) as { dataItem?: { id?: string; data?: Record<string, any> } };
  const saved = toDesign(body.dataItem);
  if (!saved) throw new DesignError('invalid_response');
  return saved;
}

/** Removes a design. Throws DesignError. */
export async function deleteDesign(id: string): Promise<void> {
  const res = await request(`/wix-data/v2/items/${encodeURIComponent(id)}?dataCollectionId=${COLLECTION}`, { method: 'DELETE' });
  if (!res.ok) throw await failure(res);
}
