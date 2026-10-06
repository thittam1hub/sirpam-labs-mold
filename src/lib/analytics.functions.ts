import { createServerFn } from "@tanstack/react-start";

/** Microsoft Clarity project id (public value, safe in the bundle). */
export const CLARITY_PROJECT_ID = "yputo6ifx9";

/**
 * The GA4 measurement ID is stored as a project secret. It is a public value
 * once rendered in the page, but it is only available on the server, so the
 * root route loads it through this server function.
 */
export const getAnalyticsConfig = createServerFn({ method: "GET" }).handler(() => {
  const gaMeasurementId = process.env["GOOGLE_ANALYTICS_MEASUREMENT_ID"]?.trim() || null;
  return { gaMeasurementId, clarityProjectId: CLARITY_PROJECT_ID };
});
