import chalk from 'chalk';
import {
  getAccountConfig,
  configFileExists,
} from '@hubspot/local-dev-lib/config';
import { uiLogger } from './logger.js';
import { supportsHyperlinkModule } from './supportHyperlinks.js';
import { supportsColor } from './supportsColor.js';
import { uiMessages } from './uiMessages.js';

import { HUBSPOT_ACCOUNT_TYPE_STRINGS } from '@hubspot/local-dev-lib/constants/config';

type TerminalSupport = {
  hyperlinks: boolean;
  color: boolean;
};

export const UI_COLORS = {
  SORBET: '#FF8F59',
  MARIGOLD: '#f5c26b',
  MARIGOLD_DARK: '#dbae60',
};

export function uiLine(): void {
  uiLogger.log('-'.repeat(50));
}

export function getTerminalUISupport(): TerminalSupport {
  return {
    hyperlinks: supportsHyperlinkModule.stdout,
    color: supportsColor.stdout.hasBasic,
  };
}

export function uiLink(linkText: string, url: string): string {
  const terminalUISupport = getTerminalUISupport();
  const encodedUrl = encodeURI(url);

  if (terminalUISupport.hyperlinks) {
    const CLOSE_SEQUENCE = '\u001B]8;;\u0007';

    const result = [
      '\u001B]8;;',
      encodedUrl,
      '\u0007',
      linkText,
      CLOSE_SEQUENCE,
    ].join('');

    return terminalUISupport.color ? chalk.cyan(result) : result;
  }

  return terminalUISupport.color
    ? `${linkText}: ${chalk.reset.cyan(encodedUrl)}`
    : `${linkText}: ${encodedUrl}`;
}

export function uiAccountDescription(
  accountId?: number | null,
  bold = true
): string {
  const account = getAccountConfig(accountId || undefined);
  let message;
  if (account && account.accountType) {
    message = `${account.name ? `${account.name} ` : ''}[${
      HUBSPOT_ACCOUNT_TYPE_STRINGS[account.accountType]
    }] (${accountId})`;
  } else {
    message = accountId ? accountId.toString() : '';
  }
  return bold ? chalk.bold(message) : message;
}

export function uiInfoSection(title: string, logContent: () => void): void {
  uiLine();
  uiLogger.log(chalk.bold(title));
  uiLogger.log('');
  logContent();
  uiLogger.log('');
  uiLine();
}

export function uiCommandReference(command: string, withQuotes = true): string {
  const terminalUISupport = getTerminalUISupport();

  const commandReference = withQuotes ? `\`${command}\`` : command;

  return chalk.bold(
    terminalUISupport.color
      ? chalk.hex(UI_COLORS.MARIGOLD_DARK)(commandReference)
      : commandReference
  );
}

export function uiAuthCommandReference({
  accountId,
  qa,
}: {
  accountId?: number | string;
  qa?: boolean;
} = {}) {
  const userIsUsingGlobalConfig = configFileExists(true);
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

export function uiFeatureHighlight(features: string[], title?: string): void {
  uiInfoSection(
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

// export function uiBetaTag(message: string, log?: true): undefined;
// export function uiBetaTag(message: string, log: false): string;
// export function uiBetaTag(message: string, log = true): string | undefined {
//   const terminalUISupport = getTerminalUISupport();
//   const tag = i18n(`lib.ui.betaTag`);

//   const result = `${
//     terminalUISupport.color ? chalk.hex(UI_COLORS.SORBET)(tag) : tag
//   } ${message}`;

//   if (log) {
//     logger.log(result);
//     return;
//   }
//   return result;
// }

// Replace this with the above code once we've upgraded to yargs 18.0.0
export function uiBetaTag(message: string, log?: true): undefined;
export function uiBetaTag(message: string, log: false): string;
export function uiBetaTag(message: string, log = true): string | undefined {
  const tag = uiMessages.betaTag;

  const result = `${tag} ${message}`;

  if (log) {
    uiLogger.log(result);
    return;
  }
  return result;
}

// export function uiDeprecatedTag(message: string, log?: true): undefined;
// export function uiDeprecatedTag(message: string, log: false): string;
// export function uiDeprecatedTag(
//   message: string,
//   log = true
// ): string | undefined {
//   const terminalUISupport = getTerminalUISupport();
//   const tag = i18n(`lib.ui.deprecatedTag`);

//   const result = `${
//     terminalUISupport.color ? chalk.yellow(tag) : tag
//   } ${message}`;

//   if (log) {
//     logger.log(result);
//     return;
//   }
//   return result;
// }

// Replace this with the above code once we've upgraded to yargs 18.0.0
export function uiDeprecatedTag(message: string, log?: true): undefined;
export function uiDeprecatedTag(message: string, log: false): string;
export function uiDeprecatedTag(
  message: string,
  log = true
): string | undefined {
  const tag = uiMessages.deprecatedTag;

  const result = `${tag} ${message}`;

  if (log) {
    uiLogger.log(result);
    return;
  }
  return result;
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
  uiLine();
  uiLogger.error(tag);
  uiLine();
  uiLogger.log('');
}

export function uiDeprecatedDescription(
  message: string,
  command: string,
  url?: string
) {
  const tag = message || uiMessages.disabledMessage(command, url);

  return uiDeprecatedTag(tag);
}

export function uiCommandRenamedDescription(
  describe: string | false | undefined,
  newCommand: string
): string | undefined {
  return uiDeprecatedTag(
    `${describe} ${uiMessages.commandRenamedMessage(newCommand)}`,
    false
  );
}

export function uiDeprecatedMessage(
  command: string,
  url?: string,
  message?: string
): void {
  const tag = uiMessages.deprecatedDescription(message || '', command, url);

  uiLogger.log('');
  uiDeprecatedTag(tag);
  uiLogger.log('');
}

export function uiCommandRelocatedMessage(newCommand: string): void {
  uiLogger.log('');
  uiDeprecatedTag(uiMessages.commandRenamedMessage(newCommand));
  uiLogger.log('');
}

export function indent(level: number): string {
  const indentation = '  ';
  return indentation.repeat(level);
}
