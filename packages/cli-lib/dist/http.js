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
var __rest = (this && this.__rest) || function (s, e) {
    var t = {};
    for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
        t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getOctetStream = exports.createGetRequestStream = exports.deleteRequest = exports.patchRequest = exports.putRequest = exports.postRequest = exports.getRequest = exports.addQueryParams = exports.withAuth = exports.withPortalId = exports.withPersonalAccessKey = exports.withOauth = void 0;
const config_1 = require("./lib/config");
const requestOptions_1 = require("./http/requestOptions");
const personalAccessKey_1 = require("./personalAccessKey");
const { getOauthManager } = require('./oauth');
const { FileSystemErrorContext, logFileSystemErrorInstance, } = require('./errorHandlers/fileSystemErrors');
const request_promise_native_1 = __importDefault(require("request-promise-native"));
const fs_extra_1 = __importDefault(require("fs-extra"));
const request_1 = __importDefault(require("request"));
const logger_1 = require("./logger");
const withOauth = (accountId, requestOptions, accountConfig) => __awaiter(void 0, void 0, void 0, function* () {
    const { headers } = requestOptions;
    const oauth = getOauthManager(accountId, accountConfig);
    const accessToken = yield oauth.accessToken();
    return Object.assign(Object.assign({}, requestOptions), { headers: Object.assign(Object.assign({}, headers), { Authorization: `Bearer ${accessToken}` }) });
});
exports.withOauth = withOauth;
const withPersonalAccessKey = (accountId, requestOptions) => __awaiter(void 0, void 0, void 0, function* () {
    const { headers } = requestOptions;
    const accessToken = yield personalAccessKey_1.accessTokenForPersonalAccessKey(accountId);
    return Object.assign(Object.assign({}, requestOptions), { headers: Object.assign(Object.assign({}, headers), { Authorization: `Bearer ${accessToken}` }) });
});
exports.withPersonalAccessKey = withPersonalAccessKey;
const withPortalId = (portalId, requestOptions) => {
    const { qs } = requestOptions;
    return Object.assign(Object.assign({}, requestOptions), { qs: Object.assign(Object.assign({}, (qs || {})), { portalId }) });
};
exports.withPortalId = withPortalId;
const withAuth = (accountId, options) => __awaiter(void 0, void 0, void 0, function* () {
    const accountConfig = config_1.getAccountConfig(accountId);
    const { env, authType, apiKey } = accountConfig || {};
    const requestOptions = exports.withPortalId(accountId, requestOptions_1.getRequestOptions({ env }, options));
    if (authType === 'personalaccesskey') {
        return exports.withPersonalAccessKey(accountId, requestOptions);
    }
    if (authType === 'oauth2') {
        return exports.withOauth(accountId, requestOptions, accountConfig);
    }
    const { qs } = requestOptions;
    return Object.assign(Object.assign({}, requestOptions), { qs: Object.assign(Object.assign({}, qs), { hapikey: apiKey }) });
});
exports.withAuth = withAuth;
const addQueryParams = (requestOptions, params = {}) => {
    const { qs } = requestOptions;
    return Object.assign(Object.assign({}, requestOptions), { qs: Object.assign(Object.assign({}, qs), params) });
};
exports.addQueryParams = addQueryParams;
const getRequest = (accountId, options) => __awaiter(void 0, void 0, void 0, function* () {
    const { query } = options, rest = __rest(options, ["query"]);
    const requestOptions = exports.addQueryParams(rest, query);
    return request_promise_native_1.default.get(yield exports.withAuth(accountId, requestOptions));
});
exports.getRequest = getRequest;
const postRequest = (accountId, options) => __awaiter(void 0, void 0, void 0, function* () {
    return request_promise_native_1.default.post(yield exports.withAuth(accountId, options));
});
exports.postRequest = postRequest;
const putRequest = (accountId, options) => __awaiter(void 0, void 0, void 0, function* () {
    return request_promise_native_1.default.put(yield exports.withAuth(accountId, options));
});
exports.putRequest = putRequest;
const patchRequest = (accountId, options) => __awaiter(void 0, void 0, void 0, function* () {
    return request_promise_native_1.default.patch(yield exports.withAuth(accountId, options));
});
exports.patchRequest = patchRequest;
const deleteRequest = (accountId, options) => __awaiter(void 0, void 0, void 0, function* () {
    return request_promise_native_1.default.del(yield exports.withAuth(accountId, options));
});
exports.deleteRequest = deleteRequest;
const createGetRequestStream = ({ contentType, }) => (accountId, options, filepath) => __awaiter(void 0, void 0, void 0, function* () {
    const { query } = options, rest = __rest(options, ["query"]);
    const requestOptions = exports.addQueryParams(rest, query);
    const logFsError = (err) => {
        logFileSystemErrorInstance(err, new FileSystemErrorContext({
            filepath,
            accountId,
            write: true,
        }));
    };
    // Using `request` instead of `request-promise` per the docs so
    // the response can be piped.
    // https://github.com/request/request-promise#api-in-detail
    return new Promise((resolve, reject) => __awaiter(void 0, void 0, void 0, function* () {
        try {
            const _a = yield exports.withAuth(accountId, requestOptions), { headers } = _a, opts = __rest(_a, ["headers"]);
            const req = request_1.default.get(Object.assign(Object.assign({}, opts), { headers: Object.assign(Object.assign({}, headers), { 'content-type': contentType, accept: contentType }), json: false }));
            req.on('error', reject);
            req.on('response', res => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    try {
                        fs_extra_1.default.ensureFileSync(filepath);
                    }
                    catch (err) {
                        reject(err);
                    }
                    const writeStream = fs_extra_1.default.createWriteStream(filepath, {
                        encoding: 'binary',
                    });
                    req.pipe(writeStream);
                    writeStream.on('error', err => {
                        logFsError(err);
                        reject(err);
                    });
                    writeStream.on('close', () => __awaiter(void 0, void 0, void 0, function* () {
                        logger_1.logger.log('Wrote file "%s"', filepath);
                        resolve(res);
                    }));
                }
                else {
                    reject(res);
                }
            });
        }
        catch (err) {
            reject(err);
        }
    }));
});
exports.createGetRequestStream = createGetRequestStream;
exports.getOctetStream = exports.createGetRequestStream({
    contentType: 'application/octet-stream',
});
exports.default = {
    getRequestOptions: requestOptions_1.getRequestOptions,
    request: request_promise_native_1.default,
    get: exports.getRequest,
    post: exports.postRequest,
    put: exports.putRequest,
    patch: exports.patchRequest,
    delete: exports.deleteRequest,
    getOctetStream: exports.getOctetStream,
};
