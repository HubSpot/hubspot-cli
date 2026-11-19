import os from 'os';
import { checkGitInclusion } from '@hubspot/local-dev-lib/gitignore';
import { uiLogger } from './logger.js';
import { lib } from '../../lang/en.js';
import { logUiLine } from './index.js';

export function checkAndWarnGitInclusion(configPath: string): void {
  try {
    const { inGit, configIgnored } = checkGitInclusion(configPath);

    if (!inGit || configIgnored) return;
    logUiLine();
    uiLogger.warn(lib.ui.git.securityIssue);
    uiLogger.log(lib.ui.git.configFileTracked);
    uiLogger.log(lib.ui.git.fileName(configPath));
    uiLogger.log('');
    uiLogger.log(lib.ui.git.moveConfig(os.homedir()));
    uiLogger.log(lib.ui.git.addGitignore(configPath));
    uiLogger.log(lib.ui.git.noRemote);
    logUiLine();
  } catch (e) {
    // fail silently
    uiLogger.debug(lib.ui.git.checkFailed);
  }
}
