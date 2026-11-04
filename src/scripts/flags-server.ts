// Server-picked experiment versions (plan 14). A page asks PostHog's /flags API which version a
// visitor gets before it renders, so the first paint is already that version, then bootstraps
// posthog-js with the answer. The visitor is whoever PostHog's own cookie names; a first visit gets
// a new UUIDv7, which the bootstrap hands to posthog-js as both its distinct ID and its device ID
// (experiment flags bucket by device, so a version survives sign-in). The token is PostHog's public
// one. Any failure resolves null and the page renders today's version with no exposure: analytics
// never blocks a page.
// docs: https://posthog.com/docs/api/flags, https://posthog.com/docs/feature-flags/device-bucketing.md,
// https://posthog.com/docs/feature-flags/bootstrapping.md
import type { AstroCookies } from 'astro';
import { PUBLIC_POSTHOG_HOST, PUBLIC_POSTHOG_PROJECT_TOKEN } from 'astro:env/client';
import { EXPERIMENTS, type ExperimentFlags } from './analytics';

export interface PostHogIdentity {
  distinctId: string;
  /** Null for an older cookie without one: device-bucketed flags then give no version. */
  deviceId: string | null;
}

/** posthog-js's `bootstrap` init option. Only a first visit's new ID is passed as `distinctID`. */
export interface PostHogBootstrap {
  distinctID?: string;
  featureFlags: Record<string, string>;
}

interface FlagsResponse {
  flags?: Record<string, { enabled?: boolean; variant?: string | null; failed?: boolean }>;
  errorsWhileComputingFlags?: boolean;
  quotaLimited?: string[];
}

const FLAGS_TIMEOUT_MS = 1500;

/** The cookie posthog-js writes, named as @posthog/core's getPostHogCookieName does. */
const cookieName = (token: string) => `ph_${token.replace(/\+/g, 'PL').replace(/\//g, 'SL').replace(/=/g, 'EQ')}_posthog`;

/** The visitor posthog-js already knows, from its cookie (Astro decodes it). Null when it's missing or unreadable. */
export function readPostHogIdentity(cookies: AstroCookies): PostHogIdentity | null {
  if (!PUBLIC_POSTHOG_PROJECT_TOKEN) return null;
  try {
    const raw = cookies.get(cookieName(PUBLIC_POSTHOG_PROJECT_TOKEN))?.value;
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    const { distinct_id: distinctId, $device_id: deviceId } = parsed as Record<string, unknown>;
    if (typeof distinctId !== 'string' || !distinctId) return null;
    return { distinctId, deviceId: typeof deviceId === 'string' && deviceId ? deviceId : null };
  } catch {
    return null;
  }
}

/** A UUIDv7, the format posthog-js gives anonymous IDs. */
export function newAnonymousId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  const ms = Date.now();
  for (let i = 0; i < 6; i++) bytes[i] = Math.floor(ms / 2 ** (8 * (5 - i))) & 0xff;
  bytes[6] = 0x70 | (bytes[6] & 0x0f);
  bytes[8] = 0x80 | (bytes[8] & 0x3f);
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** The visitor's version of one experiment, or null (no version, flag off, failure). Never throws. */
export async function getExperimentVariant<K extends keyof ExperimentFlags>(key: K, identity: PostHogIdentity): Promise<ExperimentFlags[K] | null> {
  if (!PUBLIC_POSTHOG_PROJECT_TOKEN || !PUBLIC_POSTHOG_HOST || !identity.deviceId) return null;
  try {
    // The body posthog-js's own /flags call sends: $device_id top level and in person_properties.
    const res = await fetch(new URL('/flags/?v=2', PUBLIC_POSTHOG_HOST), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: PUBLIC_POSTHOG_PROJECT_TOKEN,
        distinct_id: identity.distinctId,
        $device_id: identity.deviceId,
        person_properties: { $device_id: identity.deviceId },
        flag_keys_to_evaluate: [key],
      }),
      signal: AbortSignal.timeout(FLAGS_TIMEOUT_MS),
    });
    if (!res.ok) {
      console.warn('[flags] request failed', key, res.status);
      return null;
    }
    const body = (await res.json()) as FlagsResponse;
    if (body.errorsWhileComputingFlags || body.quotaLimited?.includes('feature_flags')) {
      console.warn('[flags] PostHog could not compute flags', key);
      return null;
    }
    const flag = body.flags?.[key];
    if (flag?.enabled !== true || flag.failed) return null;
    const variants: readonly string[] = EXPERIMENTS[key];
    return typeof flag.variant === 'string' && variants.includes(flag.variant) ? (flag.variant as ExperimentFlags[K]) : null;
  } catch (error) {
    console.warn('[flags] request failed', key, error instanceof Error ? error.name : 'unknown');
    return null;
  }
}
