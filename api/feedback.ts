import { http } from '@hubspot/local-dev-lib/http';
import { HubSpotPromise } from '@hubspot/local-dev-lib/types/Http';

const FEEDBACK_API_PATH = 'local/dev/tools/proxy/v1/feedback';

export const FEEDBACK_SOURCES = ['user', 'agent'] as const;

export type FeedbackSource = (typeof FEEDBACK_SOURCES)[number];

type FeedbackRequest = {
  feedback: string;
  source: FeedbackSource;
  cliVersion: string;
};

export function sendFeedback(
  accountId: number,
  request: FeedbackRequest
): HubSpotPromise<void> {
  return http.post(accountId, {
    url: FEEDBACK_API_PATH,
    data: request,
  });
}
