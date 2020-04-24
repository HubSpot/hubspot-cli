import request from 'request-promise-native';
import { getRequestOptions } from '../http/requestOptions';

export async function fetchAccessToken(
  personalAccessKey,
  env = 'PROD',
  portalId
) {
  const query = portalId ? { portalId } : {};
  const requestOptions = getRequestOptions(
    { env },
    {
      uri: `localdevauth/v1/auth/refresh`,
      body: {
        encodedOAuthRefreshToken: personalAccessKey,
      },
      qs: query,
    }
  );

  return request.post(requestOptions);
}
