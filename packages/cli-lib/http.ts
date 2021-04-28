import { getAccountConfig } from './lib/config';
import { getRequestOptions } from './http/requestOptions';
import { accessTokenForPersonalAccessKey } from './personalAccessKey';
const { getOauthManager } = require('./oauth');
const {
  FileSystemErrorContext,
  logFileSystemErrorInstance,
} = require('./errorHandlers/fileSystemErrors');
import { Account, RequestOptions } from './types';
import requestPN from 'request-promise-native';
import fs from 'fs-extra';
import request from 'request';
import { logger } from './logger';

export const withOauth = async (
  accountId: number,
  requestOptions: RequestOptions,
  accountConfig?: Account
): Promise<RequestOptions> => {
  const { headers } = requestOptions;
  const oauth = getOauthManager(accountId, accountConfig);
  const accessToken = await oauth.accessToken();
  return {
    ...requestOptions,
    headers: {
      ...headers,
      Authorization: `Bearer ${accessToken}`,
    },
  };
};

export const withPersonalAccessKey = async (
  accountId: number,
  requestOptions: RequestOptions
): Promise<RequestOptions> => {
  const { headers } = requestOptions;
  const accessToken = await accessTokenForPersonalAccessKey(accountId);
  return {
    ...requestOptions,
    headers: {
      ...headers,
      Authorization: `Bearer ${accessToken}`,
    },
  };
};

export const withPortalId = (
  portalId: number,
  requestOptions: RequestOptions
): RequestOptions => {
  const { qs } = requestOptions;

  return {
    ...requestOptions,
    qs: {
      ...(qs || {}),
      portalId,
    },
  };
};

export const withAuth = async (
  accountId: number,
  options: RequestOptions
): Promise<RequestOptions> => {
  const accountConfig = getAccountConfig(accountId);
  const { env, authType, apiKey } = accountConfig || {};
  const requestOptions = withPortalId(
    accountId,
    getRequestOptions({ env }, options)
  );

  if (authType === 'personalaccesskey') {
    return withPersonalAccessKey(accountId, requestOptions);
  }

  if (authType === 'oauth2') {
    return withOauth(accountId, requestOptions, accountConfig);
  }
  const { qs } = requestOptions;

  return {
    ...requestOptions,
    qs: {
      ...qs,
      hapikey: apiKey,
    },
  };
};

export const addQueryParams = (
  requestOptions: RequestOptions,
  params = {}
): RequestOptions => {
  const { qs } = requestOptions;
  return {
    ...requestOptions,
    qs: {
      ...qs,
      ...params,
    },
  };
};

export const getRequest = async (
  accountId: number,
  options: RequestOptions & { query?: { [key: string]: any } }
) => {
  const { query, ...rest } = options;
  const requestOptions = addQueryParams(rest, query);
  return requestPN.get(await withAuth(accountId, requestOptions));
};

export const postRequest = async (
  accountId: number,
  options: RequestOptions
) => {
  return requestPN.post(await withAuth(accountId, options));
};

export const putRequest = async (
  accountId: number,
  options: RequestOptions
) => {
  return requestPN.put(await withAuth(accountId, options));
};

export const patchRequest = async (
  accountId: number,
  options: RequestOptions
) => {
  return requestPN.patch(await withAuth(accountId, options));
};

export const deleteRequest = async (
  accountId: number,
  options: RequestOptions
) => {
  return requestPN.del(await withAuth(accountId, options));
};

export const createGetRequestStream = ({
  contentType,
}: {
  contentType: string;
}) => async (
  accountId: number,
  options: RequestOptions & { query: { [key: string]: any } },
  filepath: string
) => {
  const { query, ...rest } = options;
  const requestOptions = addQueryParams(rest, query);

  const logFsError = (err: Error) => {
    logFileSystemErrorInstance(
      err,
      new FileSystemErrorContext({
        filepath,
        accountId,
        write: true,
      })
    );
  };

  // Using `request` instead of `request-promise` per the docs so
  // the response can be piped.
  // https://github.com/request/request-promise#api-in-detail
  return new Promise(async (resolve, reject) => {
    try {
      const { headers, ...opts } = await withAuth(accountId, requestOptions);
      const req = request.get({
        ...opts,
        headers: {
          ...headers,
          'content-type': contentType,
          accept: contentType,
        },
        json: false,
      });
      req.on('error', reject);
      req.on('response', res => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            fs.ensureFileSync(filepath);
          } catch (err) {
            reject(err);
          }
          const writeStream = fs.createWriteStream(filepath, {
            encoding: 'binary',
          });
          req.pipe(writeStream);

          writeStream.on('error', err => {
            logFsError(err);
            reject(err);
          });
          writeStream.on('close', async () => {
            logger.log('Wrote file "%s"', filepath);
            resolve(res);
          });
        } else {
          reject(res);
        }
      });
    } catch (err) {
      reject(err);
    }
  });
};

export const getOctetStream = createGetRequestStream({
  contentType: 'application/octet-stream',
});

export default {
  getRequestOptions,
  request: requestPN,
  get: getRequest,
  post: postRequest,
  put: putRequest,
  patch: patchRequest,
  delete: deleteRequest,
  getOctetStream,
};
