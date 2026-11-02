// Server helpers for the product page (plan 09): the merchant's description and info sections split
// into the page's parts, the eyebrow, the Product Details rows, the size range and the
// recommendation scopes. Pure: no Wix calls.
import type { Category, ProductDetail, ProductSummary } from '../../wix/storefront/types';

const EYEBROW: Record<string, string> = { men: "Men's Shoe", women: "Women's Shoe", kids: "Kids' Shoe" };
const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'", nbsp: ' ' };
// Info sections the page places itself; any other section becomes its own Product Details row.
const FEATURES = 'features';
const MATERIALS = 'materials';
const CARE = 'care';

export interface DetailRow {
  label: string;
  value: string;
}

export interface ProductPage {
  /** "Men's Shoe" from the product's gender category; null when it has none or categories failed. */
  eyebrow: string | null;
  /** The description's first paragraph (merchant HTML), shown under the price. */
  summaryHtml: string | null;
  /** The remaining paragraphs (merchant HTML), shown in About This Product. */
  aboutHtml: string[];
  /** The "Features" info section, one plain-text item per paragraph. */
  features: string[];
  details: DetailRow[];
  /** First and last Size choice ("7", "12"); null when the product has no Size option. */
  sizeRange: { first: string; last: string } | null;
  /** The sport (child of Sports) and gender categories, for You Might Also Like. */
  sportId: string | null;
  genderId: string | null;
  viewAllHref: string | null;
}

/** The inner HTML of each non-empty `<p>`; the whole string when it has no paragraphs. */
export function paragraphs(html: string): string[] {
  const blocks = [...html.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)].map((match) => match[1].trim());
  return (blocks.length > 0 ? blocks : [html.trim()]).filter((block) => plainText(block) !== '');
}

/** Tags stripped (a line break becomes a space), common entities decoded, whitespace collapsed. */
export function plainText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<\/p>\s*<p\b[^>]*>/gi, ' ')
    .replace(/<[^>]*>/g, '')
    .replace(/&(amp|lt|gt|quot|#39|nbsp);/g, (_, name: string) => ENTITIES[name])
    .replace(/\s+/g, ' ')
    .trim();
}

export function productPage(product: ProductDetail, categories: Category[]): ProductPage {
  const byId = new Map(categories.map((c) => [c.id, c]));
  const sportsId = categories.find((c) => c.slug === 'sports')?.id ?? null;
  const direct = product.categoryIds.map((id) => byId.get(id)).filter((c): c is Category => !!c);
  const gender = direct.find((c) => EYEBROW[c.slug]) ?? null;
  const sport = direct.find((c) => sportsId !== null && c.parentId === sportsId) ?? null;

  const section = (title: string) => product.infoSections.find((s) => s.title.trim().toLowerCase() === title);
  const [summaryHtml = null, ...aboutHtml] = paragraphs(product.descriptionHtml);
  const features = paragraphs(section(FEATURES)?.html ?? '').map(plainText);

  const details: DetailRow[] = [];
  const color = product.options.find((o) => o.isColor);
  if (color && color.choices.length > 0) details.push({ label: 'Colorway', value: color.choices.map((c) => c.name).join(' · ') });
  const material = plainText(section(MATERIALS)?.html ?? '');
  if (material) details.push({ label: 'Material', value: material });
  const care = plainText(section(CARE)?.html ?? '');
  if (care) details.push({ label: 'Product Care', value: care });
  for (const s of product.infoSections) {
    const title = s.title.trim();
    const value = plainText(s.html);
    if (title && value && ![FEATURES, MATERIALS, CARE].includes(title.toLowerCase())) details.push({ label: title, value });
  }

  const sizes = product.options.find((o) => o.name.trim().toLowerCase() === 'size')?.choices ?? [];
  const scope = sport ?? gender;
  return {
    eyebrow: gender ? EYEBROW[gender.slug] : null,
    summaryHtml,
    aboutHtml,
    features,
    details,
    sizeRange: sizes.length > 0 ? { first: sizes[0].name, last: sizes[sizes.length - 1].name } : null,
    sportId: sport?.id ?? null,
    genderId: gender?.id ?? null,
    viewAllHref: scope ? `/category/${scope.slug}` : null,
  };
}

/** The lists in order (sport first), without duplicates or the current product, cut to n. */
export function pickRelated(lists: ProductSummary[][], excludeId: string, n: number): ProductSummary[] {
  const seen = new Set([excludeId]);
  const picked: ProductSummary[] = [];
  for (const product of lists.flat()) {
    if (picked.length === n) break;
    if (seen.has(product.id)) continue;
    seen.add(product.id);
    picked.push(product);
  }
  return picked;
}
