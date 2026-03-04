import chalk from 'chalk';
import {
  requestValidation,
  getValidationStatus,
  getValidationResults,
} from '@hubspot/local-dev-lib/api/marketplaceValidation';
import { uiLogger } from './ui/logger.js';
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
  const { data: requestResult } = await requestValidation(accountId, {
    path: src,
    assetType,
    requestGroup,
  });
  return requestResult;
}

export async function pollForValidationFinish(
  accountId: number,
  validationId: number
): Promise<void> {
  async function checkValidationStatus() {
    const { data: validationStatus } = await getValidationStatus(accountId, {
      validationId,
    });

    if (validationStatus === 'REQUESTED') {
      await new Promise(resolve => setTimeout(resolve, SLEEP_TIME));
      await checkValidationStatus();
    }
  }
  await checkValidationStatus();
}

export async function fetchValidationResults(
  accountId: number,
  validationId: number
): Promise<GetValidationResultsResponse> {
  const { data: validationResults } = await getValidationResults(accountId, {
    validationId,
  });
  return validationResults;
}

export function hasProcessValidationErrors(
  invalidPathError: (path: string) => string,
  validationResults: GetValidationResultsResponse
): boolean {
  if (validationResults.errors.length) {
    const { assetPath, errors } = validationResults;

    errors.forEach(err => {
      if (err.failureReasonType === 'DOWNLOAD_EMPTY') {
        uiLogger.error(invalidPathError(assetPath));
      } else {
        uiLogger.error(err.context);
      }
    });
    return true;
  }
  return false;
}

function displayFileInfo(
  file: string,
  line: number | null,
  resultsCopy: ResultsCopy
): void {
  if (file) {
    uiLogger.log(resultsCopy.warnings.file(file));
  }
  if (line) {
    uiLogger.log(resultsCopy.warnings.lineNumber(line.toString()));
  }
}

type Result = {
  status: string;
  results: Check[];
};

type ValidationType = keyof GetValidationResultsResponse['results'];

function displayResults(checks: Result, resultsCopy: ResultsCopy): void {
  if (checks) {
    const { status, results } = checks;

    if (status === 'FAIL') {
      const failedValidations = results.filter(test => test.status === 'FAIL');
      const warningValidations = results.filter(test => test.status === 'WARN');
      failedValidations.forEach(val => {
        uiLogger.error(`${val.message}`);
        displayFileInfo(val.file, val.line, resultsCopy);
      });
      warningValidations.forEach(val => {
        uiLogger.warn(`${val.message}`);
        displayFileInfo(val.file, val.line, resultsCopy);
      });
    }
    if (status === 'PASS') {
      uiLogger.success(resultsCopy.noErrors);

      results.forEach(test => {
        if (test.status === 'WARN') {
          uiLogger.warn(`${test.message}`);
          displayFileInfo(test.file, test.line, resultsCopy);
        }
      });
    }
  }
  return;
}

type ResultsCopy = {
  noErrors: string;
  required: string;
  recommended: string;
  warnings: {
    file: (file: string) => string;
    lineNumber: (line: string) => string;
  };
};

export function displayValidationResults(
  resultsCopy: ResultsCopy,
  validationResults: GetValidationResultsResponse
) {
  Object.keys(validationResults.results).forEach(type => {
    uiLogger.log(
      chalk.bold(resultsCopy[type.toLowerCase() as keyof ResultsCopy])
    );
    displayResults(
      validationResults.results[type as ValidationType],
      resultsCopy
    );
    uiLogger.log('');
  });
}
