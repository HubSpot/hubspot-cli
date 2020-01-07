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
  oauth: {
    value: 'oauth2',
    name: 'OAuth2',
  },
  api: {
    value: 'apiKey',
    name: 'API Key',
  },
};

const DEFAULT_OAUTH_SCOPES = ['content'];

const OAUTH_SCOPES = [
  {
    name: 'Some description for content',
    value: 'content',
  },
  {
    name: 'Some description for hubdb',
    value: 'hubdb',
  },
  {
    name: 'Some description for filemanager',
    value: 'filemanager',
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
};
