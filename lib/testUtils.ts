import { HubSpotHttpError } from '@hubspot/local-dev-lib/models/HubSpotHttpError';

type MockResponse = {
  status: number;
  data: {
    message?: string;
    errorType?: string;
    category?: string;
    subCategory?: string;
  };
};

export const makeHubSpotHttpError = (
  message: string,
  response: MockResponse
): HubSpotHttpError => {
  return new HubSpotHttpError(message, {
    cause: { isAxiosError: true, response },
  });
};
