import { getHsSettingsFilePath } from '@hubspot/local-dev-lib/config/hsSettings';
import { uiLogger } from '../ui/logger.js';
import { lib } from '../../lang/en.js';

export function warnIfLinkedDirectory(args: (string | number)[]): void {
  if (getHsSettingsFilePath() === null) {
    return;
  }

  uiLogger.warn(
    lib.linkedDirectory.warning(
      `hs ${args.join(' ')}`,
      getHsSettingsFilePath()!
    )
  );
}
