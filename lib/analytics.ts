/**
 * Unified analytics wrapper.
 * Currently logs to console, but can be easily swapped out for PostHog/Mixpanel.
 */
/* eslint-disable no-console */
export function trackEvent(eventName: string, properties?: Record<string, any>) {
  if (process.env.NODE_ENV !== "production") {
    console.log(`[Analytics] ${eventName}`, properties || {});
  } else {
    // In production, this would send to PostHog, Mixpanel, etc.
    // e.g., posthog.capture(eventName, properties)
    console.log(`[Analytics] ${eventName}`, properties || {});
  }
}
