import { getAccountId } from '@hubspot/local-dev-lib/config';

import SpinniesManager from '../ui/SpinniesManager';
import { appNamePrompt } from '../prompts/getStartedPrompt';
import { uiInfoSection } from '../ui';
import { logger } from '@hubspot/local-dev-lib/logger';

const { i18n } = require('../lang');

export class GetStarted {
  accountId: number | null;

  constructor() {
    SpinniesManager.init();
    this.accountId = getAccountId();
  }

  welcomePrompt(): void {
    uiInfoSection(i18n(`lib.getStarted.welcomeTitle`), () => {
      logger.log(i18n(`lib.getStarted.welcomeDescription`));
    });
  }

  // TODO: Implement app initialization
  async initializeApp(): Promise<void> {
    const { appName } = await appNamePrompt();
    SpinniesManager.add('initializeApp', {
      text: i18n('lib.getStarted.initializingApp'),
    });

    SpinniesManager.succeed('initializeApp', {
      text: i18n('lib.getStarted.appInitialized', { appName }),
      succeedColor: 'white',
    });
  }

  // TODO: Implement config check
  async checkConfig(): Promise<void> {
    SpinniesManager.add('checkConfig', {
      text: i18n('lib.getStarted.checkingConfig'),
    });

    await new Promise(resolve => setTimeout(resolve, 1000));

    SpinniesManager.succeed('checkConfig', {
      text: i18n('lib.getStarted.configValidated'),
      succeedColor: 'white',
    });
  }
}
