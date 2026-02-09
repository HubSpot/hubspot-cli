import { Arguments } from 'yargs';

/**
 * Middleware to handle the --disable-usage-tracking flag
 * Sets an environment variable that can be checked by tracking functions
 */
export function handleDisableUsageTracking(
  argv: Arguments<{ disableUsageTracking?: boolean }>
): void {
  if (argv.disableUsageTracking) {
    process.env.DISABLE_USAGE_TRACKING = 'true';
  }
}

/**
 * Helper function to check if usage tracking is disabled
 * @returns true if usage tracking is disabled via environment variable
 */
export function isUsageTrackingDisableFlagSet(): boolean {
  return process.env.DISABLE_USAGE_TRACKING === 'true';
}
