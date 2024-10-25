/*
 * 0: Successful run
 * 1: Config problem or internal error
 * 2: Warnings or validation issues
 */
export const EXIT_CODES = {
  SUCCESS: 0,
  ERROR: 1,
  WARNING: 2,
} as const;
