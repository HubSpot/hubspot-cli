export const ENVIRONMENTS = {
  PROD: 'prod',
  QA: 'qa',
};

export const ALLOWED_EXTENSIONS = new Set([
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
  'graphql',
]);

export const HUBL_EXTENSIONS = new Set(['css', 'html', 'js']);
export const MODULE_EXTENSION = 'module';
export const FUNCTIONS_EXTENSION = 'functions';

// `draft` for buffer APIs.
export enum Mode {
  draft = 'draft',
  publish = 'publish',
}

export const DEFAULT_MODE = Mode.publish;

export const DEFAULT_HUBSPOT_CONFIG_YAML_FILE_NAME = 'hubspot.config.yml';

export const EMPTY_CONFIG_FILE_CONTENTS = '';

export const API_KEY_AUTH_METHOD = {
  value: 'apikey',
  name: 'API Key',
};

export const OAUTH_AUTH_METHOD = {
  value: 'oauth2',
  name: 'OAuth2',
};

export const PERSONAL_ACCESS_KEY_AUTH_METHOD = {
  value: 'personalaccesskey',
  name: 'Personal Access Key',
};

export const AUTH_METHODS = {
  api: API_KEY_AUTH_METHOD,
  oauth: OAUTH_AUTH_METHOD,
};

export const DEFAULT_OAUTH_SCOPES = ['content'];

export const OAUTH_SCOPES = [
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

export const ENVIRONMENT_VARIABLES = {
  HUBSPOT_API_KEY: 'HUBSPOT_API_KEY',
  HUBSPOT_CLIENT_ID: 'HUBSPOT_CLIENT_ID',
  HUBSPOT_CLIENT_SECRET: 'HUBSPOT_CLIENT_SECRET',
  HUBSPOT_PERSONAL_ACCESS_KEY: 'HUBSPOT_PERSONAL_ACCESS_KEY',
  HUBSPOT_PORTAL_ID: 'HUBSPOT_PORTAL_ID',
  HUBSPOT_REFRESH_TOKEN: 'HUBSPOT_REFRESH_TOKEN',
  HUBSPOT_ENVIRONMENT: 'HUBSPOT_ENVIRONMENT',
};

export const SCOPE_GROUPS = {
  functions: 'cms.functions.read_write',
};

export const HUBSPOT_FOLDER = '@hubspot';
export const MARKETPLACE_FOLDER = '@marketplace';

export const FOLDER_DOT_EXTENSIONS = ['functions', 'module'];

export const POLLING_DELAY = 5000;

export const GITHUB_RELEASE_TYPES = {
  RELEASE: 'release',
  REPOSITORY: 'repository',
};

export const ConfigFlags = {
  USE_CUSTOM_OBJECT_HUBFILE: 'useCustomObjectHubfile',
};
