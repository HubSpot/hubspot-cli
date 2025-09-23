import chalk from 'chalk';
import { getAccountConfig } from '@hubspot/local-dev-lib/config';
import { logger } from '@hubspot/local-dev-lib/logger';
import { supportsHyperlinkModule } from './supportHyperlinks.js';
import { supportsColor } from './supportsColor.js';
import { i18n } from '../lang.js';

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
  logger.log('-'.repeat(50));
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
  logger.log(chalk.bold(title));
  logger.log('');
  logContent();
  logger.log('');
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

export function uiFeatureHighlight(features: string[], title?: string): void {
  uiInfoSection(
    title ? title : i18n(`lib.ui.featureHighlight.defaultTitle`),
    () => {
      features.forEach(feature => {
        const featureKey = `lib.ui.featureHighlight.featureKeys.${feature}`;
        const message = i18n(`${featureKey}.message`, {
          command: uiCommandReference(i18n(`${featureKey}.command`)),
          link: uiLink(
            i18n(`${featureKey}.linkText`),
            i18n(`${featureKey}.url`)
          ),
        });
        logger.log(`  - ${message}`);
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
  const tag = i18n(`lib.ui.betaTag`);

  const result = `${tag} ${message}`;

  if (log) {
    logger.log(result);
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
  const tag = i18n(`lib.ui.deprecatedTag`);

  const result = `${tag} ${message}`;

  if (log) {
    logger.log(result);
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
    i18n(`lib.ui.disabledMessage`, {
      command: uiCommandReference(command),
      url: url ? uiLink(i18n(`lib.ui.disabledUrlText`), url) : '',
      npmCommand: uiCommandReference('npm i -g @hubspot/cli@latest'),
    });

  logger.log();
  uiLine();
  logger.error(tag);
  uiLine();
  logger.log();
}

export function uiDeprecatedDescription(
  message: string,
  command: string,
  url?: string
) {
  const tag = i18n(`lib.ui.deprecatedDescription`, {
    message,
    command: uiCommandReference(command),
    url: url ? uiLink(i18n(`lib.ui.deprecatedUrlText`), url) : '',
  });
  return uiDeprecatedTag(tag);
}

export function uiDeprecatedMessage(
  command: string,
  url?: string,
  message?: string
): void {
  const tag =
    message ||
    i18n(`lib.ui.deprecatedMessage`, {
      command: uiCommandReference(command),
      url: url ? uiLink(i18n(`lib.ui.deprecatedUrlText`), url) : '',
    });

  logger.log();
  uiDeprecatedTag(tag);
  logger.log();
}

export function indent(level: number): string {
  const indentation = '  ';
  return indentation.repeat(level);
}
