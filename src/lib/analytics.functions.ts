import { createServerFn } from "@tanstack/react-start";

/**
 * Analytics IDs are read on the server so the measurement ID can live in the
 * secret store; both values are public once rendered in the browser.
 */
export const getAnalyticsConfig = createServerFn({ method: "GET" }).handler(
  async () => {
    return {
      gaId: process.env["GOOGLE_ANALYTICS_MEASUREMENT_ID"] ?? "",
      clarityId: process.env["CLARITY_PROJECT_ID"] ?? "yputo6ifx9",
    };
  },
);
