import chalk from 'chalk';
import {
  getConfigAccountIfExists,
  globalConfigFileExists,
} from '@hubspot/local-dev-lib/config';
import { uiLogger } from './logger.js';
import { uiMessages } from './uiMessages.js';
import { uiCommandReference, uiLink } from './formatting.js';

import { HUBSPOT_ACCOUNT_TYPE_STRINGS } from '@hubspot/local-dev-lib/constants/config';

export {
  getTerminalUISupport,
  UI_COLORS,
  uiCommandReference,
  uiLink,
} from './formatting.js';

export function logUiLine(): void {
  uiLogger.log('-'.repeat(50));
}

export function uiAccountDescription(
  accountId?: number | null,
  bold = true
): string {
  const account = accountId ? getConfigAccountIfExists(accountId) : undefined;
  let message;
  if (account && account.accountType) {
    message = `${account.name ? `${account.name} ` : ''}[${
      HUBSPOT_ACCOUNT_TYPE_STRINGS[account.accountType]
    }] (${accountId})`;
  } else {
    message = accountId ? accountId.toString() : '';
  }

  if (message.trim().length === 0) {
    return 'unknown account';
  }

  return bold ? chalk.bold(message) : message;
}

export function logUiInfoSection(title: string, logContent: () => void): void {
  logUiLine();
  uiLogger.log(chalk.bold(title));
  uiLogger.log('');
  logContent();
  uiLogger.log('');
  logUiLine();
}

export function uiAuthCommandReference({
  accountId,
  qa,
}: {
  accountId?: number | string;
  qa?: boolean;
} = {}) {
  const userIsUsingGlobalConfig = globalConfigFileExists();
  let command = 'hs auth';

  if (userIsUsingGlobalConfig) {
    command = 'hs account auth';
  }
  return uiCommandReference(
    `${command}${accountId ? ` --account=${accountId}` : ''}${
      qa ? ' --qa' : ''
    }`
  );
}

export function logUiFeatureHighlight(
  features: string[],
  title?: string
): void {
  logUiInfoSection(
    title ? title : uiMessages.featureHighlight.defaultTitle,
    () => {
      features.forEach(feature => {
        const featureConfig =
          uiMessages.featureHighlight.featureKeys[
            feature as keyof typeof uiMessages.featureHighlight.featureKeys
          ];

        if (!featureConfig) {
          uiLogger.debug(`Feature config not found for: ${feature}`);
          return;
        }

        let message: string;
        if ('linkText' in featureConfig && 'url' in featureConfig) {
          // linkText + url (for sampleProjects)
          message = featureConfig.message(
            uiLink(featureConfig.linkText, featureConfig.url)
          );
        } else if ('command' in featureConfig && 'message' in featureConfig) {
          // Command + Message function (most cases)
          message = featureConfig.message(
            uiCommandReference(featureConfig.command)
          );
        } else {
          // Message only (for projectCommandTip)
          message = featureConfig.message;
        }

        uiLogger.log(`  - ${message}`);
      });
    }
  );
}

// export function uiBetaTag(message: string): string {
//   const terminalUISupport = getTerminalUISupport();
//   const tag = i18n(`lib.ui.betaTag`);

//   return `${
//     terminalUISupport.color ? chalk.hex(UI_COLORS.SORBET)(tag) : tag
//   } ${message}`;
// }

// Replace this with the above code once we've upgraded to yargs 18.0.0
export function uiBetaTag(message: string): string {
  const tag = uiMessages.betaTag;

  return `${tag} ${message}`;
}

// export function uiDeprecatedTag(message: string): string {
//   const terminalUISupport = getTerminalUISupport();
//   const tag = i18n(`lib.ui.deprecatedTag`);

//   return `${terminalUISupport.color ? chalk.yellow(tag) : tag} ${message}`;
// }

// Replace this with the above code once we've upgraded to yargs 18.0.0
export function uiDeprecatedTag(message: string): string {
  const tag = uiMessages.deprecatedTag;

  return `${tag} ${message}`;
}

export function uiCommandDisabledBanner(
  command: string,
  url?: string,
  message?: string
): void {
  const tag =
    message ||
    `The ${uiCommandReference(command)} command is disabled. Run ${uiCommandReference('npm i -g @hubspot/cli@latest')} to update to the latest HubSpot CLI version. ${url ? uiLink('See all HubSpot CLI commands here.', url) : ''}`;

  uiLogger.log('');
  logUiLine();
  uiLogger.error(tag);
  logUiLine();
  uiLogger.log('');
}

export function logUiDeprecatedDescription(
  message: string,
  command: string,
  url?: string
) {
  const tag = message || uiMessages.disabledMessage(command, url);

  uiLogger.log(uiDeprecatedTag(tag));
}

// export function uiCommandRenamedDescription(
//   describe: string | false | undefined,
//   newCommand: string
// ): string | undefined {
//   return uiDeprecatedTag(
//     `${describe} ${uiMessages.commandRenamedMessage(newCommand)}`
//   );
// }

// Replace this with the above code once we've upgraded to yargs 18.0.0
export function uiCommandRenamedDescription(
  describe: string | false | undefined,
  newCommand: string
): string | undefined {
  return uiDeprecatedTag(
    `${describe} ${uiMessages.commandRenamedPlainMessage(newCommand)}`
  );
}

export function logUiDeprecatedMessage(
  command: string,
  url?: string,
  message?: string
): void {
  const tag = uiMessages.deprecatedDescription(message || '', command, url);

  uiLogger.log('');
  uiLogger.log(uiDeprecatedTag(tag));
  uiLogger.log('');
}

export function logUiCommandRelocatedMessage(newCommand: string): void {
  uiLogger.log('');
  uiLogger.log(uiDeprecatedTag(uiMessages.commandRenamedMessage(newCommand)));
  uiLogger.log('');
}

export function indent(level: number): string {
  const indentation = '  ';
  return indentation.repeat(level);
}
