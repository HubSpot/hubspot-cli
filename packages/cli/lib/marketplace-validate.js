const chalk = require('chalk');

const { logger } = require('@hubspot/cli-lib/logger');
const {
  requestValidation,
  getValidationStatus,
  getValidationResults,
} = require('@hubspot/cli-lib/api/marketplaceValidation');
const { i18n } = require('./lang');
const { EXIT_CODES } = require('./enums/exitCodes');

const SLEEP_TIME = 2000;

const kickOffValidation = async (accountId, assetType, src) => {
  const requestGroup = 'EXTERNAL_DEVELOPER';
  try {
    const requestResult = await requestValidation(accountId, {
      path: src,
      assetType,
      requestGroup,
    });
    return requestResult;
  } catch (err) {
    logger.debug(err);
    process.exit(EXIT_CODES.ERROR);
  }
};

const pollForValidationFinish = async (accountId, validationId) => {
  try {
    const checkValidationStatus = async () => {
      const validationStatus = await getValidationStatus(accountId, {
        validationId,
      });

      if (validationStatus === 'REQUESTED') {
        await new Promise(resolve => setTimeout(resolve, SLEEP_TIME));
        await checkValidationStatus();
      }
    };
    await checkValidationStatus();
  } catch (err) {
    logger.debug(err);
    process.exit(EXIT_CODES.ERROR);
  }
};

const fetchValidationResults = async (accountId, validationId) => {
  try {
    const validationResults = await getValidationResults(accountId, {
      validationId,
    });
    return validationResults;
  } catch (err) {
    logger.debug(err);
    process.exit(EXIT_CODES.ERROR);
  }
};

const processValidationErrors = validationResults => {
  if (validationResults.errors.length) {
    const { errors } = validationResults;

    errors.forEach(err => {
      logger.error(`${err.context}`);
    });
    process.exit(EXIT_CODES.ERROR);
  }
};

const displayValidationResults = (i18nKey, validationResults) => {
  const displayResults = checks => {
    const displayFileInfo = (file, line) => {
      if (file) {
        logger.log(
          i18n(`${i18nKey}.results.warnings.file`, {
            file,
          })
        );
      }
      if (line) {
        logger.log(
          i18n(`${i18nKey}.results.warnings.lineNumber`, {
            line,
          })
        );
      }
      return null;
    };

    if (checks) {
      const { status, results } = checks;

      if (status === 'FAIL') {
        const failedValidations = results.filter(
          test => test.status === 'FAIL'
        );
        const warningValidations = results.filter(
          test => test.status === 'WARN'
        );
        failedValidations.forEach(val => {
          logger.error(`${val.message}`);
          displayFileInfo(val.file, val.line);
        });
        warningValidations.forEach(val => {
          logger.warn(`${val.message}`);
          displayFileInfo(val.file, val.line);
        });
      }
      if (status === 'PASS') {
        logger.success(i18n(`${i18nKey}.results.noErrors`));

        results.forEach(test => {
          if (test.status === 'WARN') {
            logger.warn(`${test.message}`);
            displayFileInfo(test.file, test.line);
          }
        });
      }
    }
    return null;
  };

  Object.keys(validationResults.results).forEach(type => {
    logger.log(chalk.bold(i18n(`${i18nKey}.results.${type.toLowerCase()}`)));
    displayResults(validationResults.results[type]);
    logger.log();
  });
};

module.exports = {
  kickOffValidation,
  pollForValidationFinish,
  fetchValidationResults,
  processValidationErrors,
  displayValidationResults,
};
