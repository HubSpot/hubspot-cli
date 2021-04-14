"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getRequestOptions = exports.DEFAULT_USER_AGENT_HEADERS = void 0;
const { version } = require('../package.json');
const { getAndLoadConfigIfNeeded } = require('../lib/config');
const { getHubSpotApiOrigin } = require('../lib/urls');
exports.DEFAULT_USER_AGENT_HEADERS = {
    'User-Agent': `HubSpot CLI/${version}`,
};
const getRequestOptions = (options = {}, requestOptions = { url: '' }) => {
    const { env } = options;
    const { httpTimeout, httpUseLocalhost } = getAndLoadConfigIfNeeded();
    return Object.assign({ baseUrl: getHubSpotApiOrigin(env, httpUseLocalhost), headers: Object.assign({}, exports.DEFAULT_USER_AGENT_HEADERS), json: true, simple: true, timeout: httpTimeout || 15000 }, requestOptions);
};
exports.getRequestOptions = getRequestOptions;
exports.default = { getRequestOptions: exports.getRequestOptions, DEFAULT_USER_AGENT_HEADERS: exports.DEFAULT_USER_AGENT_HEADERS };
