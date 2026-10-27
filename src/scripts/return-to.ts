// Where a page may send the shopper next. No imports, so .astro frontmatter and browser scripts
// share it. Every redirect, link and returnToUrl goes through safeReturnTo.

export const DEFAULT_RETURN_TO = '/account';

/**
 * A same-origin path, or null. Resolving against the origin rejects `//evil.com`, `/\evil.com`
 * (browsers read `\` as `/`) and other schemes, which a "starts with /" check lets through.
 */
export function safeReturnTo(value: string | null | undefined, origin: string): string | null {
  if (!value) return null;
  try {
    const url = new URL(value, origin);
    return url.origin === origin ? `${url.pathname}${url.search}${url.hash}` : null;
  } catch {
    return null;
  }
}

/** Adds ?returnTo= to an internal link when the current page was given a safe one. */
export function withReturnTo(href: string, returnTo: string | null): string {
  return returnTo ? `${href}?returnTo=${encodeURIComponent(returnTo)}` : href;
}

/** Google through @wix/astro's built-in login route. */
export function googleLoginHref(returnTo: string): string {
  return `/api/auth/login?idp=google&returnToUrl=${encodeURIComponent(returnTo)}`;
}

/** The built-in logout route; it must be a native form POST (the flow redirects through Wix). */
export function logoutAction(returnTo: string): string {
  return `/api/auth/logout?returnToUrl=${encodeURIComponent(returnTo)}`;
}
