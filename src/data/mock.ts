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
  { id: "court", eyebrow: "New Release", title: "KIX COURT 1 RETRO", body: "Timeless style. Reimagined for today.", ctaLabel: "Shop Now", href: "/products/kix-court-1-retro", imageUrl: `${HOME}/court-red.jpg`, imageAlt: "Red leather Kix Court 1 Retro sneakers" },
  { id: "strap", eyebrow: "Just Dropped", title: "KIX STRAP HIGH LX", body: "Locked in. Lifted up.", ctaLabel: "Shop Now", href: "/products/kix-strap-high-lx", imageUrl: `${HOME}/strap-maroon.jpg`, imageAlt: "Burgundy Kix Strap High LX sneakers" },
  { id: "summit", eyebrow: "Back in Rotation", title: "KIX SUMMIT HIGH", body: "Built for the climb. Made for the street.", ctaLabel: "Shop Now", href: "/products/kix-summit-high", imageUrl: `${HOME}/summit-navy.jpg`, imageAlt: "Navy Kix Summit High sneaker" },
  { id: "design", eyebrow: "Make It Yours", title: "DESIGN YOUR PAIR", body: "Recolor the upper, sole, laces and accent.", ctaLabel: "Customize", href: "/customize", imageUrl: `${HOME}/basketball-red.jpg`, imageAlt: "Red sneakers with white laces" },
];

export const collectionSlides: EditorialSlide[] = [
  { id: "next", eyebrow: "Limited Collection", title: "BUILT FOR WHAT'S NEXT", body: "Icons, reimagined.", ctaLabel: "Explore", href: "/shop", imageUrl: `${SPECIMENS}/black-training.jpg`, imageAlt: "Black sneakers with orange straps" },
  { id: "nightshift", eyebrow: "Limited Collection", title: "NIGHTSHIFT HIGH", body: "Dark mode. Full speed.", ctaLabel: "Explore", href: "/products/kix-nightshift-high", imageUrl: `${HOME}/nightshift-black.jpg`, imageAlt: "Black Kix Nightshift High sneaker" },
  { id: "meridian", eyebrow: "Limited Collection", title: "MERIDIAN PREMIUM", body: "Clean lines. Long days.", ctaLabel: "Explore", href: "/products/kix-meridian-premium", imageUrl: `${SPECIMENS}/studio-white.jpg`, imageAlt: "White Kix Meridian Premium sneakers" },
  { id: "orbit", eyebrow: "Limited Collection", title: "ORBIT HIGH", body: "Bold color. Big moves.", ctaLabel: "Explore", href: "/products/kix-orbit-high", imageUrl: `${SPECIMENS}/pink-slip-ons.jpg`, imageAlt: "Pink Kix Orbit High sneakers" },
];

export const memberPerks: MemberPerk[] = [
  { id: "shipping", title: "Free Shipping", text: "On orders over $100", icon: "truck" },
  { id: "returns", title: "Easy Returns", text: "30-day return policy", icon: "returns" },
  { id: "access", title: "Exclusive Access", text: "Early drops & member-only releases", icon: "lock" },
];
