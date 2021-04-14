"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.logger = exports.setLogLevel = exports.setLogger = exports.Styles = exports.LOG_LEVEL = void 0;
const chalk_1 = __importDefault(require("chalk"));
const types_1 = require("./types");
Object.defineProperty(exports, "LOG_LEVEL", { enumerable: true, get: function () { return types_1.LOG_LEVEL; } });
const Styles = {
    debug: chalk_1.default.reset.blue,
    log: chalk_1.default.reset,
    success: chalk_1.default.reset.green,
    info: chalk_1.default.reset.white,
    warn: chalk_1.default.reset.yellow,
    error: chalk_1.default.reset.red,
};
exports.Styles = Styles;
const stylize = (label, style, args) => {
    const styledLabel = style(label);
    const [firstArg, ...rest] = args;
    if (typeof firstArg === 'string') {
        return [`${styledLabel} ${firstArg}`, ...rest];
    }
    return [styledLabel, ...args];
};
class Logger {
    error(...args) {
        console.error(...stylize('[ERROR]', Styles.error, args));
    }
    warn(...args) {
        console.warn(...stylize('[WARNING]', Styles.warn, args));
    }
    log(...args) {
        console.log(...args);
    }
    success(...args) {
        console.log(...stylize('[SUCCESS]', Styles.success, args));
    }
    info(...args) {
        console.info(...stylize('[INFO]', Styles.info, args));
    }
    debug(...args) {
        console.debug(...stylize('[DEBUG]', Styles.log, args));
    }
    group(...args) {
        console.group(...args);
    }
    groupEnd() {
        console.groupEnd();
    }
}
let currentLogger = new Logger();
let currentLogLevel = types_1.LOG_LEVEL.ERROR;
const setLogger = (logger) => {
    currentLogger = logger;
};
exports.setLogger = setLogger;
const setLogLevel = (level) => {
    switch (level) {
        case types_1.LOG_LEVEL.DEBUG:
            currentLogLevel =
                types_1.LOG_LEVEL.DEBUG | types_1.LOG_LEVEL.LOG | types_1.LOG_LEVEL.WARN | types_1.LOG_LEVEL.ERROR;
            break;
        case types_1.LOG_LEVEL.LOG:
            currentLogLevel = types_1.LOG_LEVEL.LOG | types_1.LOG_LEVEL.WARN | types_1.LOG_LEVEL.ERROR;
            break;
        case types_1.LOG_LEVEL.WARN:
            currentLogLevel = types_1.LOG_LEVEL.WARN | types_1.LOG_LEVEL.ERROR;
            break;
        case types_1.LOG_LEVEL.ERROR:
            currentLogLevel = types_1.LOG_LEVEL.ERROR;
            break;
        case types_1.LOG_LEVEL.NONE:
        default:
            currentLogLevel = types_1.LOG_LEVEL.NONE;
    }
};
exports.setLogLevel = setLogLevel;
const shouldLog = (level) => {
    return currentLogLevel & level;
};
const logger = {
    error(...args) {
        if (shouldLog(types_1.LOG_LEVEL.ERROR)) {
            currentLogger.error(...args);
        }
    },
    warn(...args) {
        if (shouldLog(types_1.LOG_LEVEL.WARN)) {
            currentLogger.warn(...args);
        }
    },
    log(...args) {
        if (shouldLog(types_1.LOG_LEVEL.LOG)) {
            currentLogger.log(...args);
        }
    },
    success(...args) {
        if (shouldLog(types_1.LOG_LEVEL.LOG)) {
            currentLogger.success(...args);
        }
    },
    info(...args) {
        if (shouldLog(types_1.LOG_LEVEL.LOG)) {
            currentLogger.info(...args);
        }
    },
    debug(...args) {
        if (shouldLog(types_1.LOG_LEVEL.DEBUG)) {
            currentLogger.debug(...args);
        }
    },
    group(...args) {
        currentLogger.group(...args);
    },
    groupEnd() {
        currentLogger.groupEnd();
    },
};
exports.logger = logger;
