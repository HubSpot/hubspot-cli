"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const logger_1 = require("../logger");
const standardErrors_1 = require("./standardErrors");
class FileSystemErrorContext {
    constructor(props = {}) {
        this.filepath = props.filepath || '';
        this.read = !!props.read;
        this.write = !!props.write;
    }
}
function logFileSystemErrorInstance(error, context) {
    let fileAction = '';
    if (context.read) {
        fileAction = 'reading from';
    }
    else if (context.write) {
        fileAction = 'writing to';
    }
    else {
        fileAction = 'accessing';
    }
    const filepath = context.filepath
        ? `"${context.filepath}"`
        : 'a file or folder';
    const message = [`An error occurred while ${fileAction} ${filepath}.`];
    // Many `fs` errors will be `SystemError`s
    if (standardErrors_1.isSystemError(error)) {
        message.push(`This is the result of a system error: ${error.message}`);
    }
    logger_1.logger.error(message.join(' '));
    standardErrors_1.debugErrorAndContext(error, context);
}
module.exports = {
    FileSystemErrorContext,
    logFileSystemErrorInstance,
};
