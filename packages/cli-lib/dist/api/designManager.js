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
exports.fetchRawAssetByPath = exports.fetchMenus = exports.fetchBuiltinMapping = void 0;
const http_1 = __importDefault(require("../http"));
const DESIGN_MANAGER_API_PATH = 'designmanager/v1';
function fetchMenus(accountId, query = {}) {
    return __awaiter(this, void 0, void 0, function* () {
        return http_1.default.get(accountId, {
            uri: `${DESIGN_MANAGER_API_PATH}/menus`,
            query,
        });
    });
}
exports.fetchMenus = fetchMenus;
function fetchBuiltinMapping(accountId) {
    return __awaiter(this, void 0, void 0, function* () {
        return http_1.default.get(accountId, {
            uri: `${DESIGN_MANAGER_API_PATH}/widgets/builtin-mapping`,
        });
    });
}
exports.fetchBuiltinMapping = fetchBuiltinMapping;
function fetchRawAssetByPath(accountId, path) {
    return __awaiter(this, void 0, void 0, function* () {
        return http_1.default.get(accountId, {
            uri: `${DESIGN_MANAGER_API_PATH}/raw-assets/by-path/${path}?portalId=${accountId}`,
        });
    });
}
exports.fetchRawAssetByPath = fetchRawAssetByPath;
