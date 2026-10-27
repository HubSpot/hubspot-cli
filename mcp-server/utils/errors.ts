import { isHubSpotHttpError } from '@hubspot/local-dev-lib/errors/index';
import { getErrorMessage } from '../../lib/errorHandlers/index.js';
import { getConfigCredentials } from '../../lib/accountCredentials.js';

export function getToolErrorMessage(error: unknown): string {
  const message = isHubSpotHttpError(error)
    ? error.toString()
    : getErrorMessage(error);

  return getConfigCredentials().reduce(
    (redactedMessage, credential) =>
      redactedMessage.replaceAll(credential, '[redacted]'),
    message
  );
}
