import { logger } from '@hubspot/local-dev-lib/logger';
import {
  HubLValidationError,
  LintResult,
  Validation,
} from '@hubspot/local-dev-lib/types/HublValidation';

function getErrorsFromHublValidationObject(
  validation: Validation
): Array<HubLValidationError> {
  return (
    (validation && validation.meta && validation.meta.template_errors) || []
  );
}

function printHublValidationError(err: HubLValidationError) {
  const { severity, message, lineno, startPosition } = err;
  const method = severity === 'FATAL' ? 'error' : 'warn';
  logger[method]('[%d, %d]: %s', lineno, startPosition, message);
}

export function printHublValidationResult({
  file,
  validation,
}: LintResult): number {
  let count = 0;

  if (!validation) {
    return count;
  }

  const errors = getErrorsFromHublValidationObject(validation);
  if (!errors.length) {
    return count;
  }
  logger.group(file);
  errors.forEach(err => {
    if (err.reason !== 'SYNTAX_ERROR') {
      return;
    }
    ++count;
    printHublValidationError(err);
  });
  logger.groupEnd();
  return count;
}
