// Placeholder storefront data for pages not yet wired to Wix. Shapes are the Headless kit's
// storefront DTOs, so wiring a page means swapping these imports for the kit's fetch calls
// (see prompts/03-home-page.md). Prices and products here are samples, not catalog data.
import type { Category, ProductSummary } from "../wix/storefront/types";

/** Editorial carousel slide. Becomes a Wix CMS collection when wired; not a Stores DTO. */
export interface EditorialSlide {
  id: string;
  eyebrow: string;
  title: string;
  body: string;
  ctaLabel: string;
  href: string;
  imageUrl: string;
  imageAlt: string;
}

export interface MemberPerk {
  id: string;
  title: string;
  text: string;
  icon: "truck" | "returns" | "lock";
}

const HOME = "/images/home";
const SPECIMENS = "/images/design-system";

function category(id: string, name: string, index: number, imageUrl: string, parentId: string | null): Category {
  return { id, slug: id, name, description: "", imageUrl, parentId, index, productCount: null, breadcrumbs: [] };
}

function product(slug: string, name: string, price: string, imageUrl: string): ProductSummary {
  return {
    id: slug,
    slug,
    name,
    price,
    maxPrice: price,
    fromPrice: false,
    compareAtPrice: null,
    discountNames: [],
    pricePerUnit: null,
    ribbon: null,
    ribbons: [],
    minPriceVariantId: null,
    availability: "IN_STOCK",
    preorder: false,
    hasSubscriptions: false,
    imageUrl,
    hoverImageUrl: "",
    optionsSummary: "",
    swatches: [],
    quickAddable: false,
  };
}

export const shopCategories: Category[] = [
  category("lifestyle", "Lifestyle", 0, `${SPECIMENS}/white-sneakers.jpg`, "sports"),
  category("running", "Running", 1, `${HOME}/running-silver.jpg`, "sports"),
  category("basketball", "Basketball", 2, `${HOME}/basketball-red.jpg`, "sports"),
  category("skate", "Skate", 3, `${HOME}/strap-maroon.jpg`, "sports"),
  category("training", "Training", 4, `${SPECIMENS}/black-training.jpg`, "sports"),
];

export const navCategories: Category[] = [
  category("men", "Men", 0, "", null),
  category("women", "Women", 1, "", null),
  category("kids", "Kids", 2, "", null),
];

const court = product("kix-court-1-retro", "KIX COURT 1 RETRO", "$229", `${HOME}/court-red.jpg`);
const summit = product("kix-summit-high", "KIX SUMMIT HIGH", "$89", `${HOME}/summit-navy.jpg`);
const strap = product("kix-strap-high-lx", "KIX STRAP HIGH LX", "$279", `${HOME}/strap-maroon.jpg`);
const nightshift = product("kix-nightshift-high", "KIX NIGHTSHIFT HIGH", "$349", `${HOME}/nightshift-black.jpg`);
const sandlot = product("kix-sandlot-suede", "KIX SANDLOT SUEDE", "$229", `${HOME}/sandlot-brown.jpg`);
const meridian = product("kix-meridian-premium", "KIX MERIDIAN PREMIUM", "$309", `${SPECIMENS}/studio-white.jpg`);
const orbit = product("kix-orbit-high", "KIX ORBIT HIGH", "$95", `${SPECIMENS}/pink-slip-ons.jpg`);

export const newArrivals: ProductSummary[] = [court, summit, strap];
export const popularNow: ProductSummary[] = [nightshift, sandlot, meridian, orbit];

export const heroSlides: EditorialSlide[] = [
  { id: "court", eyebrow: "New Release", title: "KIX COURT 1 RETRO", body: "Timeless style. Reimagined for today.", ctaLabel: "Shop Now", href: `/products/${court.slug}`, imageUrl: court.imageUrl, imageAlt: "Red leather Kix Court 1 Retro sneakers" },
  { id: "strap", eyebrow: "Just Dropped", title: "KIX STRAP HIGH LX", body: "Locked in. Lifted up.", ctaLabel: "Shop Now", href: `/products/${strap.slug}`, imageUrl: strap.imageUrl, imageAlt: "Burgundy Kix Strap High LX sneakers" },
  { id: "summit", eyebrow: "Back in Rotation", title: "KIX SUMMIT HIGH", body: "Built for the climb. Made for the street.", ctaLabel: "Shop Now", href: `/products/${summit.slug}`, imageUrl: summit.imageUrl, imageAlt: "Navy Kix Summit High sneaker" },
  { id: "design", eyebrow: "Make It Yours", title: "DESIGN YOUR PAIR", body: "Recolor the upper, sole, laces and accent.", ctaLabel: "Customize", href: "/customize", imageUrl: `${HOME}/basketball-red.jpg`, imageAlt: "Red sneakers with white laces" },
];

export const collectionSlides: EditorialSlide[] = [
  { id: "next", eyebrow: "Limited Collection", title: "BUILT FOR WHAT'S NEXT", body: "Icons, reimagined.", ctaLabel: "Explore", href: "/shop", imageUrl: `${SPECIMENS}/black-training.jpg`, imageAlt: "Black sneakers with orange straps" },
  { id: "nightshift", eyebrow: "Limited Collection", title: "NIGHTSHIFT HIGH", body: "Dark mode. Full speed.", ctaLabel: "Explore", href: `/products/${nightshift.slug}`, imageUrl: nightshift.imageUrl, imageAlt: "Black Kix Nightshift High sneaker" },
  { id: "meridian", eyebrow: "Limited Collection", title: "MERIDIAN PREMIUM", body: "Clean lines. Long days.", ctaLabel: "Explore", href: `/products/${meridian.slug}`, imageUrl: meridian.imageUrl, imageAlt: "White Kix Meridian Premium sneakers" },
  { id: "orbit", eyebrow: "Limited Collection", title: "ORBIT HIGH", body: "Bold color. Big moves.", ctaLabel: "Explore", href: `/products/${orbit.slug}`, imageUrl: orbit.imageUrl, imageAlt: "Pink Kix Orbit High sneakers" },
];

export const memberPerks: MemberPerk[] = [
  { id: "shipping", title: "Free Shipping", text: "On orders over $100", icon: "truck" },
  { id: "returns", title: "Easy Returns", text: "30-day return policy", icon: "returns" },
  { id: "access", title: "Exclusive Access", text: "Early drops & member-only releases", icon: "lock" },
];
