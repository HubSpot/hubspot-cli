import { AxiosResponse, AxiosHeaders } from 'axios';
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
export const mockHubSpotHttpResponse = (data: any): AxiosResponse => {
  return {
    data,
    status: 200,
    statusText: 'OK',
    headers: {},
    config: {
      headers: new AxiosHeaders(),
    },
  };
};

export const mockHubSpotHttpError = (
  message: string,
  response: MockErrorResponse
): HubSpotHttpError => {
  return new HubSpotHttpError(message, {
    cause: { isAxiosError: true, response },
  });
};
