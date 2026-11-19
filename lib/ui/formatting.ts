import chalk from 'chalk';
import { supportsHyperlinkModule } from './supportHyperlinks.js';
import { isColorEnabled } from './supportsColor.js';

type TerminalSupport = {
  hyperlinks: boolean;
  color: boolean;
};

export const UI_COLORS = {
  SORBET: '#FF8F59',
  MARIGOLD: '#f5c26b',
  MARIGOLD_DARK: '#dbae60',
};

export function getTerminalUISupport(): TerminalSupport {
  return {
    hyperlinks: supportsHyperlinkModule.stdout,
    color: isColorEnabled(),
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

export function uiCommandReference(command: string, withQuotes = true): string {
  const terminalUISupport = getTerminalUISupport();

  const commandReference = withQuotes ? `\`${command}\`` : command;

  return chalk.bold(
    terminalUISupport.color
      ? chalk.hex(UI_COLORS.MARIGOLD_DARK)(commandReference)
      : commandReference
  );
}
