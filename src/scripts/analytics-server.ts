// The server twin of track() (plan 13): server code (backend event handlers) sends catalog events
// to PostHog's capture API. Same rules as the browser: only events in ServerAnalyticsEvents, no
// personal data. The project token is PostHog's public one, so no secret is involved. Unlike
// track(), a failure throws: a backend event that fails can be retried by Wix, and `uuid` +
// `timestamp` make a retried event collapse into the first in PostHog.
// docs: https://posthog.com/docs/api/capture (POST /i/v0/e/), https://posthog.com/docs/data/events#event-deduplication
import type { ServerAnalyticsEvents } from './analytics';
import { POSTHOG_HOST as PUBLIC_POSTHOG_HOST, POSTHOG_PROJECT_TOKEN as PUBLIC_POSTHOG_PROJECT_TOKEN } from './posthog-public';

export interface ServerCapture {
  /** A member's Wix ID (the browser's identifyMember ID), or an ID tied to no person. */
  distinctId: string;
  /** False keeps PostHog from making a person for this ID (guest orders). */
  personProfile: boolean;
  /** Stable per real-world event, for de-duplication. */
  uuid: string;
  timestamp: Date;
}

/** Sends one catalog event. Resolves false when PostHog isn't configured; throws when the request fails. */
export async function captureServer<E extends keyof ServerAnalyticsEvents>(event: E, properties: ServerAnalyticsEvents[E], capture: ServerCapture): Promise<boolean> {
  if (!PUBLIC_POSTHOG_PROJECT_TOKEN || !PUBLIC_POSTHOG_HOST) return false;
  const res = await fetch(new URL('/i/v0/e/', PUBLIC_POSTHOG_HOST), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      api_key: PUBLIC_POSTHOG_PROJECT_TOKEN,
      event,
      distinct_id: capture.distinctId,
      uuid: capture.uuid,
      timestamp: capture.timestamp.toISOString(),
      properties: { ...properties, ...(capture.personProfile ? {} : { $process_person_profile: false }) },
    }),
    signal: AbortSignal.timeout(5000),
  });
  if (!res.ok) throw new Error(`PostHog capture failed: ${res.status}`);
  return true;
}
