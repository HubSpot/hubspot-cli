"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateConfigWithPersonalAccessKey = exports.accessTokenForPersonalAccessKey = void 0;
const moment_1 = __importDefault(require("moment"));
const config_1 = require("./lib/config");
const { HubSpotAuthError } = require('./lib/models/Errors');
const { getValidEnv } = require('./lib/environment');
const { PERSONAL_ACCESS_KEY_AUTH_METHOD, ENVIRONMENTS, } = require('./lib/constants');
const { logErrorInstance } = require('./errorHandlers/standardErrors');
const { fetchAccessToken } = require('./api/localDevAuth/unauthenticated');
const refreshRequests = new Map();
function getRefreshKey(personalAccessKey = '', expiration) {
    return `${personalAccessKey}-${expiration || 'fresh'}`;
}
function getAccessToken(personalAccessKey, env = ENVIRONMENTS.PROD, accountId) {
    return __awaiter(this, void 0, void 0, function* () {
        let response;
        try {
            response = yield fetchAccessToken(personalAccessKey, env, accountId);
        }
        catch (e) {
            if (e.response) {
                const errorOutput = `Error while retrieving new access token: ${e.response.body.message}.`;
                if (e.response.statusCode === 401) {
                    throw new HubSpotAuthError(`${errorOutput} \nYour personal access key is invalid. Please run "hs auth personalaccesskey" to reauthenticate. See https://designers.hubspot.com/docs/personal-access-keys for more information.`);
                }
                else {
                    throw new HubSpotAuthError(errorOutput);
                }
            }
            else {
                throw e;
            }
        }
        return {
            portalId: response.hubId,
            accessToken: response.oauthAccessToken,
            expiresAt: moment_1.default(response.expiresAtMillis),
            scopeGroups: response.scopeGroups,
            encodedOauthRefreshToken: response.encodedOauthRefreshToken,
        };
    });
}
function refreshAccessToken(accountId, personalAccessKey, env = ENVIRONMENTS.PROD) {
    return __awaiter(this, void 0, void 0, function* () {
        const { accessToken, expiresAt } = yield getAccessToken(personalAccessKey, env, accountId);
        const config = config_1.getAccountConfig(accountId);
        config_1.updateAccountConfig(Object.assign(Object.assign({}, config), { portalId: accountId, tokenInfo: {
                accessToken,
                expiresAt: expiresAt.toISOString(),
            } }));
        config_1.writeConfig();
        return accessToken;
    });
}
function getNewAccessToken(accountId, personalAccessKey, expiresAt, env) {
    return __awaiter(this, void 0, void 0, function* () {
        const key = getRefreshKey(personalAccessKey, expiresAt);
        if (refreshRequests.has(key)) {
            return refreshRequests.get(key);
        }
        let accessToken;
        try {
            const refreshAccessPromise = refreshAccessToken(accountId, personalAccessKey, env);
            if (key) {
                refreshRequests.set(key, refreshAccessPromise);
            }
            accessToken = yield refreshAccessPromise;
        }
        catch (e) {
            if (key) {
                refreshRequests.delete(key);
            }
            throw e;
        }
        return accessToken;
    });
}
function accessTokenForPersonalAccessKey(accountId) {
    var _a, _b;
    return __awaiter(this, void 0, void 0, function* () {
        const { auth, personalAccessKey, env } = config_1.getAccountConfig(accountId) || {};
        const authTokenInfo = auth && auth.tokenInfo;
        const authDataExists = authTokenInfo && ((_a = auth === null || auth === void 0 ? void 0 : auth.tokenInfo) === null || _a === void 0 ? void 0 : _a.accessToken);
        if (!authDataExists ||
            moment_1.default()
                .add(30, 'minutes')
                .isAfter(moment_1.default(authTokenInfo === null || authTokenInfo === void 0 ? void 0 : authTokenInfo.expiresAt))) {
            return getNewAccessToken(accountId, personalAccessKey || '', authTokenInfo === null || authTokenInfo === void 0 ? void 0 : authTokenInfo.expiresAt, env);
        }
        return (_b = auth === null || auth === void 0 ? void 0 : auth.tokenInfo) === null || _b === void 0 ? void 0 : _b.accessToken;
    });
}
exports.accessTokenForPersonalAccessKey = accessTokenForPersonalAccessKey;
/**
 * Adds a account to the config using authType: personalAccessKey
 *
 * @param {object} configData Data containing personalAccessKey and name properties
 * @param {string} configData.personalAccessKey Personal access key string to place in config
 * @param {string} configData.name Unique name to identify this config entry
 * @param {boolean} makeDefault option to make the account being added to the config the default account
 */
const updateConfigWithPersonalAccessKey = (configData, makeDefault) => __awaiter(void 0, void 0, void 0, function* () {
    const { personalAccessKey, name, env } = configData;
    const accountEnv = env || config_1.getEnv(name);
    let token;
    try {
        token = yield getAccessToken(personalAccessKey, accountEnv);
    }
    catch (err) {
        logErrorInstance(err);
        return;
    }
    const { portalId, accessToken, expiresAt } = token;
    const updatedConfig = config_1.updateAccountConfig({
        portalId,
        personalAccessKey,
        name,
        environment: getValidEnv(accountEnv, true),
        authType: PERSONAL_ACCESS_KEY_AUTH_METHOD.value,
        tokenInfo: { accessToken, expiresAt },
    });
    config_1.writeConfig();
    if (makeDefault) {
        config_1.updateDefaultAccount(name);
    }
    return updatedConfig;
});
exports.updateConfigWithPersonalAccessKey = updateConfigWithPersonalAccessKey;
exports.default = {
    accessTokenForPersonalAccessKey,
    updateConfigWithPersonalAccessKey: exports.updateConfigWithPersonalAccessKey,
};
