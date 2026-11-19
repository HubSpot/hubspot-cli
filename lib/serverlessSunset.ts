import moment from 'moment';
import { lib } from '../lang/en.js';
import { SERVERLESS_SUNSET_EDITING_DISABLED_DATE } from './constants.js';
import { uiCommandDisabledBanner, uiDeprecatedTag } from './ui/index.js';
import { uiLogger } from './ui/logger.js';

export function isServerlessEditingDisabled(): boolean {
  return moment
    .utc()
    .isSameOrAfter(moment.utc(SERVERLESS_SUNSET_EDITING_DISABLED_DATE));
}

const SERVERLESS_FOLDER_SEGMENT = /\.functions(\/|$)/;

export function isServerlessFunctionPath(path: string): boolean {
  return SERVERLESS_FOLDER_SEGMENT.test(path.replace(/\\/g, '/'));
}

export function logServerlessDeprecation(command: string): void {
  uiLogger.log('');
  uiLogger.log(
    uiDeprecatedTag(lib.serverlessSunset.deprecationNotice(command))
  );
  uiLogger.log('');
}

export function logServerlessCreationBlocked(command: string): void {
  uiCommandDisabledBanner(
    command,
    undefined,
    lib.serverlessSunset.creationBlocked(command)
  );
}

export function logServerlessEditingDisabled(command: string): void {
  uiCommandDisabledBanner(
    command,
    undefined,
    lib.serverlessSunset.editingDisabled(command)
  );
}

export function logServerlessUploadBlockedHint(paths: string[]): void {
  if (paths.some(isServerlessFunctionPath)) {
    uiLogger.info(
      isServerlessEditingDisabled()
        ? lib.serverlessSunset.uploadEditingBlockedHint
        : lib.serverlessSunset.uploadBlockedHint
    );
  }
}
