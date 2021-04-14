"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.logErrorInstance = exports.isSystemError = exports.isFatalError = exports.debugErrorAndContext = void 0;
const { HubSpotAuthError } = require('../lib/models/Errors');
const logger_1 = require("../logger");
const isSystemError = (err) => err.errno != null && err.code != null && err.syscall != null;
exports.isSystemError = isSystemError;
const isFatalError = (err) => err instanceof HubSpotAuthError;
exports.isFatalError = isFatalError;
function debugErrorAndContext(error, context) {
    if (error.name === 'StatusCodeError') {
        const { statusCode, message, response } = error;
        logger_1.logger.debug('Error: %o', {
            statusCode,
            message,
            url: response.request.href,
            method: response.request.method,
            response: response.body,
            headers: response.headers,
        });
    }
    else {
        logger_1.logger.debug('Error: %o', error);
    }
    logger_1.logger.debug('Context: %o', context);
}
exports.debugErrorAndContext = debugErrorAndContext;
function logSystemError(error, context) {
    logger_1.logger.error(`A system error has occurred: ${error.message}`);
    debugErrorAndContext(error, context);
}
function logErrorInstance(error, context) {
    // SystemError
    if (isSystemError(error)) {
        logSystemError(error, context);
        return;
    }
    if (error instanceof Error || error.message || error.reason) {
        // Error or Error subclass
        const name = error.name || 'Error';
        const message = [`A ${name} has occurred.`];
        [error.message, error.reason].forEach(msg => {
            if (msg) {
                message.push(msg);
            }
        });
        logger_1.logger.error(message.join(' '));
    }
    else {
        // Unknown errors
        logger_1.logger.error(`An unknown error has occurred.`);
    }
    debugErrorAndContext(error, context);
}
exports.logErrorInstance = logErrorInstance;
