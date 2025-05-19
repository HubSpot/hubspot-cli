import { AxiosHeaders } from 'axios';
import { HubSpotPromise } from '@hubspot/local-dev-lib/types/Http';
import { HubSpotHttpError } from '@hubspot/local-dev-lib/models/HubSpotHttpError';

type MockErrorResponse = {
  status: number;
  data: {
    message?: string;
    errorType?: string;
    category?: string;
    subCategory?: string;
  };
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mockHubSpotHttpResponse<T>(data?: any): HubSpotPromise<T> {
  return Promise.resolve({
    data,
    status: 200,
    statusText: 'OK',
    headers: {},
    config: {
      headers: new AxiosHeaders(),
    },
  });
}

export function mockHubSpotHttpError(
  message: string,
  response: MockErrorResponse
): HubSpotHttpError {
  return new HubSpotHttpError(message, {
    cause: { isAxiosError: true, response },
  });
}
