"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GITHUB_RELEASE_TYPES = exports.POLLING_DELAY = exports.FOLDER_DOT_EXTENSIONS = exports.MARKETPLACE_FOLDER = exports.HUBSPOT_FOLDER = exports.SCOPE_GROUPS = exports.ENVIRONMENT_VARIABLES = exports.OAUTH_SCOPES = exports.DEFAULT_OAUTH_SCOPES = exports.AUTH_METHODS = exports.PERSONAL_ACCESS_KEY_AUTH_METHOD = exports.OAUTH_AUTH_METHOD = exports.API_KEY_AUTH_METHOD = exports.EMPTY_CONFIG_FILE_CONTENTS = exports.DEFAULT_HUBSPOT_CONFIG_YAML_FILE_NAME = exports.DEFAULT_MODE = exports.Mode = exports.FUNCTIONS_EXTENSION = exports.MODULE_EXTENSION = exports.HUBL_EXTENSIONS = exports.ALLOWED_EXTENSIONS = exports.ENVIRONMENTS = void 0;
exports.ENVIRONMENTS = {
    PROD: 'prod',
    QA: 'qa',
};
exports.ALLOWED_EXTENSIONS = new Set([
    'css',
    'js',
    'json',
    'html',
    'txt',
    'md',
    'jpg',
    'jpeg',
    'png',
    'gif',
    'map',
    'svg',
    'ttf',
    'woff',
    'woff2',
]);
exports.HUBL_EXTENSIONS = new Set(['css', 'html', 'js']);
exports.MODULE_EXTENSION = 'module';
exports.FUNCTIONS_EXTENSION = 'functions';
// `draft` for buffer APIs.
var Mode;
(function (Mode) {
    Mode["draft"] = "draft";
    Mode["publish"] = "publish";
})(Mode = exports.Mode || (exports.Mode = {}));
exports.DEFAULT_MODE = Mode.publish;
exports.DEFAULT_HUBSPOT_CONFIG_YAML_FILE_NAME = 'hubspot.config.yml';
exports.EMPTY_CONFIG_FILE_CONTENTS = '';
exports.API_KEY_AUTH_METHOD = {
    value: 'apikey',
    name: 'API Key',
};
exports.OAUTH_AUTH_METHOD = {
    value: 'oauth2',
    name: 'OAuth2',
};
exports.PERSONAL_ACCESS_KEY_AUTH_METHOD = {
    value: 'personalaccesskey',
    name: 'Personal Access Key',
};
exports.AUTH_METHODS = {
    api: exports.API_KEY_AUTH_METHOD,
    oauth: exports.OAUTH_AUTH_METHOD,
};
exports.DEFAULT_OAUTH_SCOPES = ['content'];
exports.OAUTH_SCOPES = [
    {
        name: 'All CMS APIs, Calendar API, Email and Email Events APIs',
        value: 'content',
        checked: true,
    },
    {
        name: 'HubDB API',
        value: 'hubdb',
    },
    {
        name: 'File Manager API',
        value: 'files',
    },
];
exports.ENVIRONMENT_VARIABLES = {
    HUBSPOT_API_KEY: 'HUBSPOT_API_KEY',
    HUBSPOT_CLIENT_ID: 'HUBSPOT_CLIENT_ID',
    HUBSPOT_CLIENT_SECRET: 'HUBSPOT_CLIENT_SECRET',
    HUBSPOT_PERSONAL_ACCESS_KEY: 'HUBSPOT_PERSONAL_ACCESS_KEY',
    HUBSPOT_PORTAL_ID: 'HUBSPOT_PORTAL_ID',
    HUBSPOT_REFRESH_TOKEN: 'HUBSPOT_REFRESH_TOKEN',
    HUBSPOT_ENVIRONMENT: 'HUBSPOT_ENVIRONMENT',
};
exports.SCOPE_GROUPS = {
    functions: 'cms.functions.read_write',
};
exports.HUBSPOT_FOLDER = '@hubspot';
exports.MARKETPLACE_FOLDER = '@marketplace';
exports.FOLDER_DOT_EXTENSIONS = ['functions', 'module'];
exports.POLLING_DELAY = 5000;
exports.GITHUB_RELEASE_TYPES = {
    RELEASE: 'release',
    REPOSITORY: 'repository',
};
