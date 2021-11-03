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

const PROJECT_TEMPLATE_TYPES = {
  blank: {
    files: {},
  },
};

const PROJECT_TEMPLATES = [
  {
    name: 'getting-started',
    label: 'Getting Started',
    repo: 'getting-started-project-template',
  },
];

const TEMPLATE_TYPES = {
  unmapped: 0,
  email_base_template: 1,
  email: 2,
  landing_page_base_template: 3,
  landing_page: 4,
  blog_base: 5,
  blog: 6,
  blog_listing: 42,
  site_page: 8,
  blog_listing_context: 9,
  blog_post_context: 10,
  error_page: 11,
  subscription_preferences: 12,
  unsubscribe_confirmation: 13,
  unsubscribe_simple: 14,
  optin_email: 15,
  optin_followup_email: 16,
  optin_confirmation_page: 17,
  global_group: 18,
  password_prompt_page: 19,
  resubscribe_email: 20,
  unsubscribe_confirmation_email: 21,
  resubscribe_confirmation_email: 22,
  custom_module: 23,
  css: 24,
  js: 25,
  search_results: 27,
  membership_login: 29,
  membership_register: 30,
  membership_reset: 31,
  membership_reset_request: 32,
  drag_drop_email: 34,
  knowledge_article: 35,
  membership_email: 36,
  section: 37,
  global_content_partial: 38,
  simple_landing_page_template: 39,
  proposal: 40,
  blog_post: 41,
  quote: 43,
};

const PROJECT_BUILD_STATUS = {
  BUILDING: 'BUILDING',
  ENQUEUED: 'ENQUEUED',
  FAILURE: 'FAILURE',
  PENDING: 'PENDING',
  SUCCESS: 'SUCCESS',
};

const PROJECT_BUILD_STATUS_TEXT = {
  [PROJECT_BUILD_STATUS.BUILDING]: 'is building',
  [PROJECT_BUILD_STATUS.ENQUEUED]: 'is queued',
  [PROJECT_BUILD_STATUS.FAILURE]: 'failed to build',
  [PROJECT_BUILD_STATUS.PENDING]: 'is pending',
  [PROJECT_BUILD_STATUS.SUCCESS]: 'built successfully',
};

const PROJECT_DEPLOY_STATUS = {
  DEPLOYING: 'DEPLOYING',
  FAILURE: 'FAILURE',
  PENDING: 'PENDING',
  SUCCESS: 'SUCCESS',
};

const PROJECT_DEPLOY_STATUS_TEXT = {
  [PROJECT_DEPLOY_STATUS.BUILDING]: 'is deploying',
  [PROJECT_DEPLOY_STATUS.FAILURE]: 'failed to deploy',
  [PROJECT_DEPLOY_STATUS.PENDING]: 'is pending',
  [PROJECT_DEPLOY_STATUS.SUCCESS]: 'deployed successfully',
};

const PROJECT_TEXT = {
  BUILD: {
    STATES: { ...PROJECT_BUILD_STATUS },
    STATUS_TEXT: { ...PROJECT_BUILD_STATUS_TEXT },
    SUBTASK_KEY: 'subbuildStatuses',
    SUBTASK_NAME_KEY: 'buildName',
  },
  DEPLOY: {
    STATES: { ...PROJECT_DEPLOY_STATUS },
    STATUS_TEXT: { ...PROJECT_DEPLOY_STATUS_TEXT },
    SUBTASK_KEY: 'subdeployStatuses',
    SUBTASK_NAME_KEY: 'deployName',
  },
};

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
  PROJECT_BUILD_STATUS,
  PROJECT_BUILD_STATUS_TEXT,
  PROJECT_DEPLOY_STATUS,
  PROJECT_DEPLOY_STATUS_TEXT,
  PROJECT_TEMPLATES,
  PROJECT_TEMPLATE_TYPES,
  PROJECT_TEXT,
  SCOPE_GROUPS,
  TEMPLATE_TYPES,
};
