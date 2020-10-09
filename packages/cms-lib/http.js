const request = require('request');
const requestPN = require('request-promise-native');
const { getAccountConfig } = require('./lib/config');
const { getRequestOptions } = require('./http/requestOptions');
const { accessTokenForPersonalAccessKey } = require('./personalAccessKey');
const { getOauthManager } = require('./oauth');

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

const withaccountId = (accountId, requestOptions) => {
  const { qs } = requestOptions;

  return {
    ...requestOptions,
    qs: {
      ...qs,
      accountId,
    },
  };
};

const withAuth = async (accountId, options) => {
  const accountConfig = getAccountConfig(accountId);
  const { env, authType, apiKey } = accountConfig;
  const requestOptions = withaccountId(
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
  destination
) => {
  const { query, ...rest } = options;
  const requestOptions = addQueryParams(rest, query);
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
      let response;
      req
        .on('error', reject)
        .on('response', r => {
          if (r.statusCode >= 200 && r.statusCode < 300) {
            response = r;
          } else {
            reject(r);
          }
        })
        .on('end', () => resolve(response))
        .pipe(destination);
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
  put: putRequest,
  patch: patchRequest,
  delete: deleteRequest,
};
