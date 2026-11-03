// Placeholder content that has no Wix source yet. Products, prices and categories come from Wix Stores
// (plan 07); what remains here is editorial copy: the home carousels (a Wix CMS collection later),
// the member perks (user-confirmed copy) and the header's fixed category links.
import type { Category } from "../wix/storefront/types";

/** Editorial carousel slide. Becomes a Wix CMS collection when wired; not a Stores DTO. */
export interface EditorialSlide {
  id: string;
  eyebrow: string;
  title: string;
  body: string;
  ctaLabel: string;
  href: string;
  /** Local editorial photo; "" for a product slide, whose photo the page reads from Wix. */
  imageUrl: string;
  imageAlt: string;
  /** Set when the slide features one product: the page shows that product's main Wix photo. */
  productSlug?: string;
}

export interface MemberPerk {
  id: string;
  title: string;
  text: string;
  icon: "truck" | "returns" | "lock";
}

const HOME = "/images/home";
const SPECIMENS = "/images/design-system";

/** The photo and its alt text come from the product in Wix Stores. */
function product(slug: string) {
  return { href: `/products/${slug}`, productSlug: slug, imageUrl: "", imageAlt: "" };
}

function category(id: string, name: string, index: number): Category {
  return { id, slug: id, name, description: "", imageUrl: "", parentId: null, index, productCount: null, breadcrumbs: [] };
}

/** Header nav. Slugs match the Wix Stores categories seeded in plan 07. */
export const navCategories: Category[] = [
  category("men", "Men", 0),
  category("women", "Women", 1),
  category("kids", "Kids", 2),
];

export const heroSlides: EditorialSlide[] = [
  { id: "court", eyebrow: "New Release", title: "KIX COURT 1 RETRO", body: "Timeless style. Reimagined for today.", ctaLabel: "Shop Now", ...product("kix-court-1-retro") },
  { id: "strap", eyebrow: "Just Dropped", title: "KIX STRAP HIGH LX", body: "Locked in. Lifted up.", ctaLabel: "Shop Now", ...product("kix-strap-high-lx") },
  { id: "summit", eyebrow: "Back in Rotation", title: "KIX SUMMIT HIGH", body: "Built for the climb. Made for the street.", ctaLabel: "Shop Now", ...product("kix-summit-high") },
  { id: "design", eyebrow: "Make It Yours", title: "DESIGN YOUR PAIR", body: "Recolor the upper, sole, laces and accent.", ctaLabel: "Customize", href: "/customize", imageUrl: `${HOME}/basketball-red.jpg`, imageAlt: "Red sneakers with white laces" },
];

export const collectionSlides: EditorialSlide[] = [
  { id: "next", eyebrow: "Limited Collection", title: "BUILT FOR WHAT'S NEXT", body: "Icons, reimagined.", ctaLabel: "Explore", href: "/shop", imageUrl: `${SPECIMENS}/black-training.jpg`, imageAlt: "Black sneakers with orange straps" },
  { id: "nightshift", eyebrow: "Limited Collection", title: "NIGHTSHIFT HIGH", body: "Dark mode. Full speed.", ctaLabel: "Explore", ...product("kix-nightshift-high") },
  { id: "meridian", eyebrow: "Limited Collection", title: "MERIDIAN PREMIUM", body: "Clean lines. Long days.", ctaLabel: "Explore", ...product("kix-meridian-premium") },
  { id: "orbit", eyebrow: "Limited Collection", title: "ORBIT HIGH", body: "Bold color. Big moves.", ctaLabel: "Explore", ...product("kix-orbit-high") },
];

export const memberPerks: MemberPerk[] = [
  { id: "shipping", title: "Free Shipping", text: "On orders over $100", icon: "truck" },
  { id: "returns", title: "Easy Returns", text: "30-day return policy", icon: "returns" },
  { id: "access", title: "Exclusive Access", text: "Early drops & member-only releases", icon: "lock" },
];
