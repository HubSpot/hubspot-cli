import { FeedbackSource, sendFeedback } from '../api/feedback.js';
import { getConfigCredentials } from './accountCredentials.js';
import { pkg } from './jsonLoader.js';

export function containsAccountCredentials(feedback: string): boolean {
  return getConfigCredentials().some(credential =>
    feedback.includes(credential)
  );
}

export async function submitFeedback(
  accountId: number,
  feedback: string,
  source: FeedbackSource
): Promise<void> {
  await sendFeedback(accountId, {
    feedback,
    source,
    cliVersion: pkg.version,
  });
}
