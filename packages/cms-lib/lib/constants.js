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

const API_KEY_AUTH_METHOD = {
  value: 'apikey',
  name: 'API Key',
};

const OAUTH_AUTH_METHOD = {
  value: 'oauth2',
  name: 'OAuth2',
};

const PERSONAL_ACCESS_KEY_AUTH_METHOD = {
  value: 'personalaccesskey',
  name: 'Personal Access Key',
};

const AUTH_METHODS = {
  api: API_KEY_AUTH_METHOD,
  oauth: OAUTH_AUTH_METHOD,
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

const HUBSPOT_API_KEY = 'HUBSPOT_API_KEY';
const HUBSPOT_CLIENT_ID = 'HUBSPOT_CLIENT_ID';
const HUBSPOT_CLIENT_SECRET = 'HUBSPOT_CLIENT_SECRET';
const HUBSPOT_PERSONAL_ACCESS_KEY = 'HUBSPOT_PERSONAL_ACCESS_KEY';
const HUBSPOT_PORTAL_ID = 'HUBSPOT_PORTAL_ID';
const HUBSPOT_REFRESH_TOKEN = 'HUBSPOT_REFRESH_TOKEN';
const ENVIRONMENT_VARIABLES_DEFAULT_PORTAL_NAME =
  'ENVIRONMENT_VARIABLES_DEFAULT_PORTAL';

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
  API_KEY_AUTH_METHOD,
  OAUTH_AUTH_METHOD,
  PERSONAL_ACCESS_KEY_AUTH_METHOD,
  HUBSPOT_API_KEY,
  HUBSPOT_CLIENT_ID,
  HUBSPOT_CLIENT_SECRET,
  HUBSPOT_PERSONAL_ACCESS_KEY,
  HUBSPOT_PORTAL_ID,
  HUBSPOT_REFRESH_TOKEN,
  ENVIRONMENT_VARIABLES_DEFAULT_PORTAL_NAME,
};
