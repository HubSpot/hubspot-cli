const ALLOWED_EXTENSIONS = new Set([
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
const HUBL_EXTENSIONS = new Set(['css', 'html', 'js']);
const MODULE_EXTENSION = 'module';
const FUNCTIONS_EXTENSION = 'functions';

/**
 * `draft` for buffer APIs.
 *
 * @enum {string}
 */
const Mode = {
  draft: 'draft',
  publish: 'publish',
};

const DEFAULT_MODE = Mode.publish;

const DEFAULT_HUBSPOT_CONFIG_YAML_FILE_NAME = 'hubspot.config.yml';

const EMPTY_CONFIG_FILE_CONTENTS = '';

const AUTH_METHODS = {
  api: {
    value: 'apiKey',
    name: 'API Key',
  },
  oauth: {
    value: 'oauth2',
    name: 'OAuth2',
  },
};

const USER_TOKEN_AUTH_METHOD = {
  value: 'userToken',
  name: 'User Token',
};

const DEFAULT_OAUTH_SCOPES = ['content'];

const OAUTH_SCOPES = [
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

module.exports = {
  Mode,
  ALLOWED_EXTENSIONS,
  HUBL_EXTENSIONS,
  MODULE_EXTENSION,
  FUNCTIONS_EXTENSION,
  DEFAULT_MODE,
  DEFAULT_HUBSPOT_CONFIG_YAML_FILE_NAME,
  EMPTY_CONFIG_FILE_CONTENTS,
  AUTH_METHODS,
  DEFAULT_OAUTH_SCOPES,
  OAUTH_SCOPES,
  USER_TOKEN_AUTH_METHOD,
};
