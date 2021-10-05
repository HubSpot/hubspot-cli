/*
 * 0: Successful run
 * 1: Config problem or internal error
 * 2: Warnings or validation issues
 */
const EXIT_CODES = {
  SUCCESS: 0,
  ERROR: 1,
  WARNING: 2,
};

// Option 2 for handling exits:
const exitWithSuccess = () => {
  process.exit(EXIT_CODES.SUCCESS);
};

const exitWithError = () => {
  process.exit(EXIT_CODES.ERROR);
};

const exitWithWarning = () => {
  process.exit(EXIT_CODES.WARNING);
};

// Option 3 for handling exits:
const EXIT_CODES_V2 = {
  SUCCESS: () => {
    process.exit(EXIT_CODES.SUCCESS);
  },
  ERROR: () => {
    process.exit(EXIT_CODES.ERROR);
  },
  WARNING: () => {
    process.exit(EXIT_CODES.WARNING);
  },
};

module.exports = {
  EXIT_CODES,
  EXIT_CODES_V2,
  exitWithSuccess,
  exitWithError,
  exitWithWarning,
};
