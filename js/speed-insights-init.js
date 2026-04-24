/**
 * Vercel Speed Insights initialization
 * This file initializes Speed Insights for the poker game
 */

import { injectSpeedInsights } from './vendor/speed-insights.mjs';

// Initialize Speed Insights
// This will automatically collect Web Vitals and performance metrics
// Note: Speed Insights only tracks data in production mode
injectSpeedInsights({
  debug: false, // Set to true for development debugging
});
