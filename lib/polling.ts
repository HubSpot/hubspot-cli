import { HubSpotPromise } from '@hubspot/local-dev-lib/types/Http';
import { DEFAULT_POLLING_DELAY } from './constants.js';
import { lib } from '../lang/en.js';

export const DEFAULT_POLLING_STATES = {
  STARTED: 'STARTED',
  SUCCESS: 'SUCCESS',
  ERROR: 'ERROR',
  REVERTED: 'REVERTED',
  FAILURE: 'FAILURE',
} as const;

export const DEFAULT_POLLING_STATUS_LOOKUP = {
  successStates: [DEFAULT_POLLING_STATES.SUCCESS],
  errorStates: [
    DEFAULT_POLLING_STATES.ERROR,
    DEFAULT_POLLING_STATES.REVERTED,
    DEFAULT_POLLING_STATES.FAILURE,
  ],
};

type GenericPollingResponse = {
  status: string;
};

type PollingCallback<T extends GenericPollingResponse> =
  () => HubSpotPromise<T>;

export function poll<T extends GenericPollingResponse>(
  callback: PollingCallback<T>,
  statusLookup: {
    successStates: string[];
    errorStates: string[];
  } = DEFAULT_POLLING_STATUS_LOOKUP,
  timeoutMs: number = 60000 // Default 60 second timeout
): Promise<T> {
  return new Promise((resolve, reject) => {
    const pollInterval = setInterval(async () => {
      try {
        const { data: pollResp } = await callback();
        const { status } = pollResp;

        if (statusLookup.successStates.includes(status)) {
          clearInterval(pollInterval);
          clearTimeout(timeoutId);
          resolve(pollResp);
        } else if (statusLookup.errorStates.includes(status)) {
          clearInterval(pollInterval);
          clearTimeout(timeoutId);
          reject(pollResp);
        }
      } catch (error) {
        clearInterval(pollInterval);
        clearTimeout(timeoutId);
        reject(error);
      }
    }, DEFAULT_POLLING_DELAY);

    // Set a timeout to stop polling after specified duration
    const timeoutId = setTimeout(() => {
      clearInterval(pollInterval);
      reject(new Error(lib.polling.timeoutError(timeoutMs)));
    }, timeoutMs);
  });
}
