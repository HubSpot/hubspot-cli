const { getAccountConfig } = require('./lib/config');
const { getRequestOptions } = require('./http/requestOptions');
const { accessTokenForPersonalAccessKey } = require('./personalAccessKey');
const { getOauthManager } = require('./oauth');
const {
  FileSystemErrorContext,
  logFileSystemErrorInstance,
} = require('./errorHandlers/fileSystemErrors');
import { AccountConfig, RequestOptions } from './types';
import requestPN from 'request-promise-native';
import fs from 'fs-extra';
import request from 'request';
import { logger } from './logger';

const withOauth = async (
  accountId: number,
  accountConfig: AccountConfig,
  requestOptions: RequestOptions
) => {
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

const withPersonalAccessKey = async (
  accountId: number,
  accountConfig: AccountConfig,
  requestOptions: RequestOptions
) => {
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

const withPortalId = (portalId: number, requestOptions: RequestOptions) => {
  const { qs } = requestOptions;

  return {
    ...requestOptions,
    qs: {
      ...qs,
      portalId,
    },
  };
};

const withAuth = async (accountId: number, options: RequestOptions) => {
  const accountConfig = getAccountConfig(accountId);
  const { env, authType, apiKey } = accountConfig;
  const requestOptions = withPortalId(
    accountId,
    getRequestOptions({ env }, options)
  );

  if (authType === 'personalaccesskey') {
    return withPersonalAccessKey(accountId, accountConfig, requestOptions);
  }

  if (authType === 'oauth2') {
    return withOauth(accountId, accountConfig, requestOptions);
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

const addQueryParams = (requestOptions: RequestOptions, params = {}) => {
  const { qs } = requestOptions;
  return {
    ...requestOptions,
    qs: {
      ...qs,
      ...params,
    },
  };
};

const getRequest = async (accountId: number, options: RequestOptions) => {
  const { query, ...rest } = options;
  const requestOptions = addQueryParams(rest, query);
  return requestPN.get(await withAuth(accountId, requestOptions));
};

const postRequest = async (accountId: number, options: RequestOptions) => {
  return requestPN.post(await withAuth(accountId, options));
};

const putRequest = async (accountId: number, options: RequestOptions) => {
  return requestPN.put(await withAuth(accountId, options));
};

const patchRequest = async (accountId: number, options: RequestOptions) => {
  return requestPN.patch(await withAuth(accountId, options));
};

const deleteRequest = async (accountId: number, options: RequestOptions) => {
  return requestPN.del(await withAuth(accountId, options));
};

const createGetRequestStream = ({
  contentType,
}: {
  contentType: string;
}) => async (accountId: number, options: RequestOptions, filepath: string) => {
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
  //
  // eslint-disable-next-line no-async-promise-executor
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

const getOctetStream = createGetRequestStream({
  contentType: 'application/octet-stream',
});

export {
  getRequestOptions,
  requestPN as request,
  getRequest as get,
  postRequest as post,
  putRequest as put,
  patchRequest as patch,
  deleteRequest as delete,
  getOctetStream,
};
