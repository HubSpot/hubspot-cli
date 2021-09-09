const path = require('path');
const { https } = require('follow-redirects');
const FormData = require('form-data');
const request = require('request');
const requestPN = require('request-promise-native');
const fs = require('fs-extra');
const contentDisposition = require('content-disposition');

const { getAccountConfig } = require('./lib/config');
const { getRequestOptions } = require('./http/requestOptions');
const { accessTokenForPersonalAccessKey } = require('./personalAccessKey');
const { getOauthManager } = require('./oauth');
const { logger } = require('./logger');
const {
  FileSystemErrorContext,
  logFileSystemErrorInstance,
} = require('./errorHandlers/fileSystemErrors');

const withOauth = async (accountId, accountConfig, requestOptions) => {
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
  accountId,
  accountConfig,
  requestOptions
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

const withPortalId = (portalId, requestOptions) => {
  const { qs } = requestOptions;

  return {
    ...requestOptions,
    qs: {
      ...qs,
      portalId,
    },
  };
};

const withAuth = async (accountId, options) => {
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

const addQueryParams = (requestOptions, params = {}) => {
  const { qs } = requestOptions;
  return {
    ...requestOptions,
    qs: {
      ...qs,
      ...params,
    },
  };
};

const getRequest = async (accountId, options) => {
  const { query, ...rest } = options;
  const requestOptions = addQueryParams(rest, query);
  return requestPN.get(await withAuth(accountId, requestOptions));
};

const postRequest = async (accountId, options) => {
  return requestPN.post(await withAuth(accountId, options));
};

const postStream = async (accountId, options, filePath) => {
  const { baseUrl, uri, headers } = await withAuth(accountId, options);

  const form = new FormData();
  form.append('file', fs.createReadStream(filePath));

  const opts = {
    method: 'POST',
    headers: {
      ...form.getHeaders(),
      ...headers,
    },
  };

  const fullUrl = baseUrl + '/' + uri;

  return new Promise((resolve, reject) => {
    const req = https.request(fullUrl, opts);
    req.on('response', res => {
      resolve(res);
    });

    req.on('socket', s => {
      s.on('drain', () => {
        logger.log('drain event - socket bytes written:', s.bytesWritten);
      });
    });

    req.on('error', error => {
      reject(error);
    });

    form.pipe(req);
  });
};

const putRequest = async (accountId, options) => {
  return requestPN.put(await withAuth(accountId, options));
};

const patchRequest = async (accountId, options) => {
  return requestPN.patch(await withAuth(accountId, options));
};

const deleteRequest = async (accountId, options) => {
  return requestPN.del(await withAuth(accountId, options));
};

const createGetRequestStream = ({ contentType }) => async (
  accountId,
  options,
  destPath
) => {
  const { query, ...rest } = options;
  const requestOptions = addQueryParams(rest, query);

  const logFsError = err => {
    logFileSystemErrorInstance(
      err,
      new FileSystemErrorContext({
        destPath,
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
          let filepath = destPath;

          if (fs.existsSync(destPath)) {
            const stat = fs.statSync(destPath);
            if (stat.isDirectory()) {
              const { parameters } = contentDisposition.parse(
                res.headers['content-disposition']
              );
              filepath = path.join(destPath, parameters.filename);
            }
          }
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

module.exports = {
  getRequestOptions,
  request: requestPN,
  get: getRequest,
  getOctetStream: createGetRequestStream({
    contentType: 'application/octet-stream',
  }),
  post: postRequest,
  postStream: postStream,
  put: putRequest,
  patch: patchRequest,
  delete: deleteRequest,
};
