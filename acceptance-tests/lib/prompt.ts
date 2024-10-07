export const DOWN = '\x1B\x5B\x42';
export const UP = '\x1B\x5B\x41';
export const ENTER = '\x0D';
export const SPACE = '\x20';

export function getInitPromptSequence(pak: string, accountName?: string) {
  const sequence = [ENTER, pak, ENTER];
  if (accountName) {
    sequence.push(accountName);
  }
  sequence.push(ENTER);
  return sequence;
}
