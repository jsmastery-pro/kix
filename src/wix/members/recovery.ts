// Kix addition to the kit's members data layer: the password reset email. @wix/astro has no
// reset route; Wix's Astro custom-login guide says to call the SDK's sendPasswordResetEmail from
// the browser, which is IAM Recovery's Send Recovery Email. We call that endpoint through the
// kit's shared seam (wixFetch: the same ambient visitor/member auth as every SDK module).
// Wix emails a link to its own reset page; after a reset the member lands on `redirect.url`,
// which must be allowed by the project's OAuth app.
// docs: https://dev.wix.com/docs/api-reference/business-management/headless/recovery/send-recovery-email.md
// docs: https://dev.wix.com/docs/go-headless/authentication/members/custom-login-page/add-custom-login-with-the-astro-integration.md
import { wixFetch } from "../sdk";

export type ResetOutcome = "sent" | "rate-limited" | "failed";

export interface ResetRedirect {
  /** Absolute URL to land on after the reset. */
  url: string;
  /** The project's OAuth client id (WIX_CLIENT_ID). */
  clientId: string;
}

/**
 * Statuses that mean "no such account". They show the same confirmation as a sent email, so the
 * page never reveals which emails have accounts. Recorded from a live call in plan 05 step 8.
 */
const UNKNOWN_EMAIL_STATUSES: number[] = [];

/** Never throws. Every outcome except a send, an unknown email or a rate limit is `failed`. */
export async function sendPasswordReset(email: string, redirect?: ResetRedirect): Promise<ResetOutcome> {
  let res: Response;
  try {
    res = await wixFetch("/_api/iam/recovery/v1/send-email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, ...(redirect ? { redirect } : {}) }),
    });
  } catch {
    return "failed";
  }
  if (res.ok || UNKNOWN_EMAIL_STATUSES.includes(res.status)) return "sent";
  if (res.status === 429) return "rate-limited";
  if (import.meta.env.DEV) console.warn(`[kix] Send Recovery Email answered ${res.status}`);
  return "failed";
}
