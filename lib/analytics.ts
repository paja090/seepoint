'use client';

export type SaaSAnalyticsEvent =
  | 'demo_cta_clicked'
  | 'demo_form_started'
  | 'demo_form_submitted'
  | 'pricing_viewed'
  | 'ai_section_viewed'
  | 'product_demo_clicked'
  | 'workflow_section_viewed'
  | 'onboarding_section_viewed';

export function trackSaaSEvent(eventName: SaaSAnalyticsEvent, properties?: Record<string, unknown>) {
  if (typeof window === 'undefined') return;

  const payload = {
    event: eventName,
    properties: properties || {},
    timestamp: new Date().toISOString(),
    path: window.location.pathname,
  };

  // 1. DataLayer for Google Tag Manager / GA4
  if (Array.isArray((window as unknown as { dataLayer?: unknown[] }).dataLayer)) {
    (window as unknown as { dataLayer: unknown[] }).dataLayer.push(payload);
  }

  // 2. Plausible / PostHog custom event hook
  if (typeof (window as unknown as { plausible?: (event: string, opts?: unknown) => void }).plausible === 'function') {
    (window as unknown as { plausible: (event: string, opts?: unknown) => void }).plausible(eventName, { props: properties });
  }

  // 3. Development logger
  if (process.env.NODE_ENV === 'development') {
    console.log(`[SaaS Analytics Tracked]`, payload);
  }
}
