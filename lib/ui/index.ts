import chalk from 'chalk';
import { getAccountConfig } from '@hubspot/local-dev-lib/config';
import { logger } from '@hubspot/local-dev-lib/logger';
import { supportsHyperlinkModule } from './supportHyperlinks';
import { supportsColor } from './supportsColor';
import { i18n } from '../lang';

const {
  HUBSPOT_ACCOUNT_TYPE_STRINGS,
} = require('@hubspot/local-dev-lib/constants/config');

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

function getTerminalUISupport(): TerminalSupport {
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
    message = `${account.name} [${
      HUBSPOT_ACCOUNT_TYPE_STRINGS[account.accountType]
    }] (${accountId})`;
  }
  return bold ? chalk.bold(message) : message || '';
}

export function uiInfoSection(title: string, logContent: () => void): void {
  uiLine();
  logger.log(chalk.bold(title));
  logger.log('');
  logContent();
  logger.log('');
  uiLine();
}

export function uiCommandReference(command: string): string {
  const terminalUISupport = getTerminalUISupport();

  const commandReference = `\`${command}\``;

  return chalk.bold(
    terminalUISupport.color
      ? chalk.hex(UI_COLORS.MARIGOLD_DARK)(commandReference)
      : commandReference
  );
}

export function uiFeatureHighlight(commands: string[], title?: string): void {
  const i18nKey = 'lib.ui.featureHighlight';

  uiInfoSection(title ? title : i18n(`${i18nKey}.defaultTitle`), () => {
    commands.forEach((c, i) => {
      const commandKey = `${i18nKey}.commandKeys.${c}`;
      const message = i18n(`${commandKey}.message`, {
        command: uiCommandReference(i18n(`${commandKey}.command`)),
        link: uiLink(i18n(`${commandKey}.linkText`), i18n(`${commandKey}.url`)),
      });
      if (i !== 0) {
        logger.log('');
      }
      logger.log(message);
    });
  });
}

export function uiBetaTag(message: string, log = true): void | string {
  const i18nKey = 'lib.ui';

  const terminalUISupport = getTerminalUISupport();
  const tag = i18n(`${i18nKey}.betaTag`);

  const result = `${
    terminalUISupport.color ? chalk.hex(UI_COLORS.SORBET)(tag) : tag
  } ${message}`;

  if (log) {
    logger.log(result);
  } else {
    return result;
  }
}

export function uiDeprecatedTag(message: string): void {
  const i18nKey = 'lib.ui';

  const terminalUISupport = getTerminalUISupport();
  const tag = i18n(`${i18nKey}.deprecatedTag`);

  const result = `${
    terminalUISupport.color ? chalk.yellow(tag) : tag
  } ${message}`;

  logger.log(result);
}

export function uiCommandDisabledBanner(
  command: string,
  url?: string,
  message?: string
): void {
  const i18nKey = 'lib.ui';

  const tag =
    message ||
    i18n(`${i18nKey}.disabledMessage`, {
      command: uiCommandReference(command),
      url: url ? uiLink(i18n(`${i18nKey}.disabledUrlText`), url) : '',
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
  const i18nKey = 'lib.ui';

  const tag = i18n(`${i18nKey}.deprecatedDescription`, {
    message,
    command: uiCommandReference(command),
    url: url ? uiLink(i18n(`${i18nKey}.deprecatedUrlText`), url) : '',
  });
  return uiDeprecatedTag(tag);
}

export function uiDeprecatedMessage(
  command: string,
  url?: string,
  message?: string
): void {
  const i18nKey = 'lib.ui';

  const tag =
    message ||
    i18n(`${i18nKey}.deprecatedMessage`, {
      command: uiCommandReference(command),
      url: url ? uiLink(i18n(`${i18nKey}.deprecatedUrlText`), url) : '',
    });

  logger.log();
  uiDeprecatedTag(tag);
  logger.log();
}

export function indent(level: number): string {
  const indentation = '  ';
  return indentation.repeat(level);
}
