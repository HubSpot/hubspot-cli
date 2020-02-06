const request = require('request');
const requestPN = require('request-promise-native');
const { getPortalConfig } = require('./lib/config');
const { getRequestOptions } = require('./http/requestOptions');
const { accessTokenForUserToken } = require('./userToken');
const { getOauthManager } = require('./oauth');

const withOauth = async (portalId, portalConfig, requestOptions) => {
  const { headers } = requestOptions;
  const oauth = getOauthManager(portalId, portalConfig);
  const accessToken = await oauth.accessToken();
  return {
    ...requestOptions,
    headers: {
      ...headers,
      Authorization: `Bearer ${accessToken}`,
    },
  };
};

const withUserToken = async (portalId, portalConfig, requestOptions) => {
  const { headers } = requestOptions;
  const accessToken = await accessTokenForUserToken(portalId);
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

const withAuth = async (portalId, options) => {
  const portalConfig = getPortalConfig(portalId);
  const { env, authType, apiKey } = portalConfig;
  const requestOptions = withPortalId(
    portalId,
    getRequestOptions({ env }, options)
  );

  if (authType === 'usertoken') {
    return withUserToken(portalId, portalConfig, requestOptions);
  }

  if (authType === 'oauth2') {
    return withOauth(portalId, portalConfig, requestOptions);
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

const getRequest = async (portalId, options) => {
  const { query, ...rest } = options;
  const requestOptions = addQueryParams(rest, query);
  return requestPN.get(await withAuth(portalId, requestOptions));
};

const postRequest = async (portalId, options) => {
  return requestPN.post(await withAuth(portalId, options));
};

const putRequest = async (portalId, options) => {
  return requestPN.put(await withAuth(portalId, options));
};

const deleteRequest = async (portalId, options) => {
  return requestPN.del(await withAuth(portalId, options));
};

const createGetRequestStream = ({ contentType }) => async (
  portalId,
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
      const { headers, ...opts } = await withAuth(portalId, requestOptions);
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
  delete: deleteRequest,
};
