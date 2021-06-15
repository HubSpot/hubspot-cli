const ENVIRONMENTS = {
  PROD: 'prod',
  QA: 'qa',
};

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
  'eot',
  'ttf',
  'woff',
  'woff2',
  'graphql',
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

const ENVIRONMENT_VARIABLES = {
  HUBSPOT_API_KEY: 'HUBSPOT_API_KEY',
  HUBSPOT_CLIENT_ID: 'HUBSPOT_CLIENT_ID',
  HUBSPOT_CLIENT_SECRET: 'HUBSPOT_CLIENT_SECRET',
  HUBSPOT_PERSONAL_ACCESS_KEY: 'HUBSPOT_PERSONAL_ACCESS_KEY',
  HUBSPOT_PORTAL_ID: 'HUBSPOT_PORTAL_ID',
  HUBSPOT_REFRESH_TOKEN: 'HUBSPOT_REFRESH_TOKEN',
  HUBSPOT_ENVIRONMENT: 'HUBSPOT_ENVIRONMENT',
};

const SCOPE_GROUPS = {
  functions: 'cms.functions.read_write',
};

const HUBSPOT_FOLDER = '@hubspot';
const MARKETPLACE_FOLDER = '@marketplace';

const FOLDER_DOT_EXTENSIONS = ['functions', 'module'];

const POLLING_DELAY = 5000;

const GITHUB_RELEASE_TYPES = {
  RELEASE: 'release',
  REPOSITORY: 'repository',
};

const ConfigFlags = {
  USE_CUSTOM_OBJECT_HUBFILE: 'useCustomObjectHubfile',
};

const MIN_HTTP_TIMEOUT = 3000;

module.exports = {
  ConfigFlags,
  Mode,
  ALLOWED_EXTENSIONS,
  API_KEY_AUTH_METHOD,
  AUTH_METHODS,
  DEFAULT_HUBSPOT_CONFIG_YAML_FILE_NAME,
  DEFAULT_MODE,
  DEFAULT_OAUTH_SCOPES,
  ENVIRONMENT_VARIABLES,
  ENVIRONMENTS,
  EMPTY_CONFIG_FILE_CONTENTS,
  FOLDER_DOT_EXTENSIONS,
  FUNCTIONS_EXTENSION,
  GITHUB_RELEASE_TYPES,
  HUBL_EXTENSIONS,
  HUBSPOT_FOLDER,
  MARKETPLACE_FOLDER,
  MIN_HTTP_TIMEOUT,
  MODULE_EXTENSION,
  OAUTH_SCOPES,
  OAUTH_AUTH_METHOD,
  PERSONAL_ACCESS_KEY_AUTH_METHOD,
  POLLING_DELAY,
  SCOPE_GROUPS,
};
