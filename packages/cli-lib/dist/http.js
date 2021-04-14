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
exports.getOctetStream = exports.delete = exports.patch = exports.put = exports.post = exports.get = exports.request = exports.getRequestOptions = void 0;
const { getAccountConfig } = require('./lib/config');
const { getRequestOptions } = require('./http/requestOptions');
exports.getRequestOptions = getRequestOptions;
const { accessTokenForPersonalAccessKey } = require('./personalAccessKey');
const { getOauthManager } = require('./oauth');
const { FileSystemErrorContext, logFileSystemErrorInstance, } = require('./errorHandlers/fileSystemErrors');
const request_promise_native_1 = __importDefault(require("request-promise-native"));
exports.request = request_promise_native_1.default;
const fs_extra_1 = __importDefault(require("fs-extra"));
const request_1 = __importDefault(require("request"));
const logger_1 = require("./logger");
const withOauth = (accountId, accountConfig, requestOptions) => __awaiter(void 0, void 0, void 0, function* () {
    const { headers } = requestOptions;
    const oauth = getOauthManager(accountId, accountConfig);
    const accessToken = yield oauth.accessToken();
    return Object.assign(Object.assign({}, requestOptions), { headers: Object.assign(Object.assign({}, headers), { Authorization: `Bearer ${accessToken}` }) });
});
const withPersonalAccessKey = (accountId, accountConfig, requestOptions) => __awaiter(void 0, void 0, void 0, function* () {
    const { headers } = requestOptions;
    const accessToken = yield accessTokenForPersonalAccessKey(accountId);
    return Object.assign(Object.assign({}, requestOptions), { headers: Object.assign(Object.assign({}, headers), { Authorization: `Bearer ${accessToken}` }) });
});
const withPortalId = (portalId, requestOptions) => {
    const { qs } = requestOptions;
    return Object.assign(Object.assign({}, requestOptions), { qs: Object.assign(Object.assign({}, qs), { portalId }) });
};
const withAuth = (accountId, options) => __awaiter(void 0, void 0, void 0, function* () {
    const accountConfig = getAccountConfig(accountId);
    const { env, authType, apiKey } = accountConfig;
    const requestOptions = withPortalId(accountId, getRequestOptions({ env }, options));
    if (authType === 'personalaccesskey') {
        return withPersonalAccessKey(accountId, accountConfig, requestOptions);
    }
    if (authType === 'oauth2') {
        return withOauth(accountId, accountConfig, requestOptions);
    }
    const { qs } = requestOptions;
    return Object.assign(Object.assign({}, requestOptions), { qs: Object.assign(Object.assign({}, qs), { hapikey: apiKey }) });
});
const addQueryParams = (requestOptions, params = {}) => {
    const { qs } = requestOptions;
    return Object.assign(Object.assign({}, requestOptions), { qs: Object.assign(Object.assign({}, qs), params) });
};
const getRequest = (accountId, options) => __awaiter(void 0, void 0, void 0, function* () {
    const { query } = options, rest = __rest(options, ["query"]);
    const requestOptions = addQueryParams(rest, query);
    return request_promise_native_1.default.get(yield withAuth(accountId, requestOptions));
});
exports.get = getRequest;
const postRequest = (accountId, options) => __awaiter(void 0, void 0, void 0, function* () {
    return request_promise_native_1.default.post(yield withAuth(accountId, options));
});
exports.post = postRequest;
const putRequest = (accountId, options) => __awaiter(void 0, void 0, void 0, function* () {
    return request_promise_native_1.default.put(yield withAuth(accountId, options));
});
exports.put = putRequest;
const patchRequest = (accountId, options) => __awaiter(void 0, void 0, void 0, function* () {
    return request_promise_native_1.default.patch(yield withAuth(accountId, options));
});
exports.patch = patchRequest;
const deleteRequest = (accountId, options) => __awaiter(void 0, void 0, void 0, function* () {
    return request_promise_native_1.default.del(yield withAuth(accountId, options));
});
exports.delete = deleteRequest;
const createGetRequestStream = ({ contentType, }) => (accountId, options, filepath) => __awaiter(void 0, void 0, void 0, function* () {
    const { query } = options, rest = __rest(options, ["query"]);
    const requestOptions = addQueryParams(rest, query);
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
    //
    // eslint-disable-next-line no-async-promise-executor
    return new Promise((resolve, reject) => __awaiter(void 0, void 0, void 0, function* () {
        try {
            const _a = yield withAuth(accountId, requestOptions), { headers } = _a, opts = __rest(_a, ["headers"]);
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
const getOctetStream = createGetRequestStream({
    contentType: 'application/octet-stream',
});
exports.getOctetStream = getOctetStream;
