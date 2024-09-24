import { ENTER } from './cmd';

export function getInitPromptSequence(pak: string, accountName?: string) {
  const sequence = [ENTER, pak, ENTER];
  if (accountName) {
    sequence.push(accountName);
  }
  sequence.push(ENTER);
  return sequence;
}
