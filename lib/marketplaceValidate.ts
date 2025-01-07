import chalk from 'chalk';
import {
  requestValidation,
  getValidationStatus,
  getValidationResults,
} from '@hubspot/local-dev-lib/api/marketplaceValidation';
import { logger } from '@hubspot/local-dev-lib/logger';

import { i18n } from './lang';
import { EXIT_CODES } from './enums/exitCodes';
import {
  Check,
  GetValidationResultsResponse,
} from '@hubspot/local-dev-lib/types/MarketplaceValidation';

const SLEEP_TIME = 2000;

export async function kickOffValidation(
  accountId: number,
  assetType: string,
  src: string
): Promise<number> {
  const requestGroup = 'EXTERNAL_DEVELOPER';
  try {
    const { data: requestResult } = await requestValidation(accountId, {
      path: src,
      assetType,
      requestGroup,
    });
    return requestResult;
  } catch (err) {
    logger.debug(err);
    process.exit(EXIT_CODES.ERROR);
  }
}

export async function pollForValidationFinish(
  accountId: number,
  validationId: string
): Promise<void> {
  try {
    const checkValidationStatus = async () => {
      const { data: validationStatus } = await getValidationStatus(accountId, {
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
}

export async function fetchValidationResults(
  accountId: number,
  validationId: string
): Promise<GetValidationResultsResponse> {
  try {
    const { data: validationResults } = await getValidationResults(accountId, {
      validationId,
    });
    return validationResults;
  } catch (err) {
    logger.debug(err);
    process.exit(EXIT_CODES.ERROR);
  }
}

export function processValidationErrors(
  i18nKey: string,
  validationResults: GetValidationResultsResponse
): void {
  if (validationResults.errors.length) {
    const { assetPath, errors } = validationResults;

    errors.forEach(err => {
      if (err.failureReasonType === 'DOWNLOAD_EMPTY') {
        logger.error(
          i18n(`${i18nKey}.errors.invalidPath`, {
            path: assetPath,
          })
        );
      } else {
        logger.error(`${err.context}`);
      }
    });
    process.exit(EXIT_CODES.ERROR);
  }
}

function displayFileInfo(
  file: string,
  line: number | null,
  i18nKey: string
): void {
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
}

type Result = {
  status: string;
  results: Check[];
};

type ValidationType = keyof GetValidationResultsResponse['results'];

function displayResults(checks: Result, i18nKey: string): void {
  if (checks) {
    const { status, results } = checks;

    if (status === 'FAIL') {
      const failedValidations = results.filter(test => test.status === 'FAIL');
      const warningValidations = results.filter(test => test.status === 'WARN');
      failedValidations.forEach(val => {
        logger.error(`${val.message}`);
        displayFileInfo(val.file, val.line, i18nKey);
      });
      warningValidations.forEach(val => {
        logger.warn(`${val.message}`);
        displayFileInfo(val.file, val.line, i18nKey);
      });
    }
    if (status === 'PASS') {
      logger.success(i18n(`${i18nKey}.results.noErrors`));

      results.forEach(test => {
        if (test.status === 'WARN') {
          logger.warn(`${test.message}`);
          displayFileInfo(test.file, test.line, i18nKey);
        }
      });
    }
  }
  return;
}

export function displayValidationResults(
  i18nKey: string,
  validationResults: GetValidationResultsResponse
) {
  Object.keys(validationResults.results).forEach(type => {
    logger.log(chalk.bold(i18n(`${i18nKey}.results.${type.toLowerCase()}`)));
    displayResults(validationResults.results[type as ValidationType], i18nKey);
    logger.log();
  });
}
