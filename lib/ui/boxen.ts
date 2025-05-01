import { Options } from 'boxen';
import { uiLogger } from './logger';
import { UI_COLORS } from './index';
import { logger } from '@hubspot/local-dev-lib/logger';
import { lib } from '../../lang/en';

const defaultOptions: Options = {
  titleAlignment: 'left',
  borderColor: UI_COLORS.MARIGOLD,
  margin: 1,
  padding: 1,
  textAlignment: 'left',
  borderStyle: 'round',
};

export async function logInBox({
  contents,
  options,
  fallBackToNoBox = false,
}: {
  contents: string;
  options?: Options;
  fallBackToNoBox?: boolean;
}) {
  try {
    const boxen = (await import('boxen')).default;
    uiLogger.log(boxen(contents, { ...defaultOptions, ...options }));
  } catch (error) {
    logger.debug(lib.boxen.failedToLoad);
    if (!fallBackToNoBox) {
      return;
    }
    if (options?.title) {
      uiLogger.log(options.title);
      uiLogger.log('');
    }
    uiLogger.log(contents);
  }
}
