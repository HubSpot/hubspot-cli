import { logger as logger } from '@hubspot/local-dev-lib/logger';

export const log = (message: string) => logger.log(message);
export const error = (message: string) => logger.error(message);
export const warn = (message: string) => logger.warn(message);
export const success = (message: string) => logger.success(message);
export const info = (message: string) => logger.info(message);
export const debug = logger.debug;
export const group = (message: string) => logger.group(message);
export const groupEnd = () => logger.groupEnd();
