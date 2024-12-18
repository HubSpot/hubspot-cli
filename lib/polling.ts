import { HubSpotPromise } from '@hubspot/local-dev-lib/types/Http';
import { ValueOf } from '@hubspot/local-dev-lib/types/Utils';
import { POLLING_DELAY, POLLING_STATUS } from './constants';

type GenericPollingResponse = {
  status: ValueOf<typeof POLLING_STATUS>;
};

type PollingCallback<T extends GenericPollingResponse> = (
  accountId: number,
  taskId: number | string
) => HubSpotPromise<T>;

export function poll<T extends GenericPollingResponse>(
  callback: PollingCallback<T>,
  accountId: number,
  taskId: number | string
): Promise<T> {
  return new Promise((resolve, reject) => {
    const pollInterval = setInterval(async () => {
      try {
        const { data: pollResp } = await callback(accountId, taskId);
        const { status } = pollResp;

        if (status === POLLING_STATUS.SUCCESS) {
          clearInterval(pollInterval);
          resolve(pollResp);
        } else if (
          status === POLLING_STATUS.ERROR ||
          status === POLLING_STATUS.REVERTED ||
          status === POLLING_STATUS.FAILURE
        ) {
          clearInterval(pollInterval);
          reject(pollResp);
        }
      } catch (error) {
        clearInterval(pollInterval);
        reject(error);
      }
    }, POLLING_DELAY);
  });
}
