import * as Sentry from "@sentry/node";
import { nodeProfilingIntegration } from "@sentry/profiling-node";

export const initSentry = () => {
  if (!process.env.APPLICATION_SENTRY_DSN) {
    return;
  }

  Sentry.init({
    dsn: process.env.APPLICATION_SENTRY_DSN,
    integrations: [
      nodeProfilingIntegration(),
    ],
    tracesSampleRate: 1.0,
    profilesSampleRate: 1.0,
    environment: process.env.NODE_ENV,
  });
  console.log(`Sentry initialized successfully for ${process.env.NODE_ENV}`);
};
