import { logger as _logger } from '@hubspot/local-dev-lib/logger';

// Wrapper around LDL logger to provide type checking
export const uiLogger = {
  log: (message: string) => _logger.log(message),
  error: (message: string) => _logger.error(message),
  warn: (message: string) => _logger.warn(message),
  success: (message: string) => _logger.success(message),
  info: (message: string) => _logger.info(message),
  debug: _logger.debug,
  group: (message: string) => _logger.group(message),
  groupEnd: () => _logger.groupEnd(),
};
