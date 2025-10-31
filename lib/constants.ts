export const HUBSPOT_PROJECT_COMPONENTS_GITHUB_PATH =
  'HubSpot/hubspot-project-components' as const;

export const DEFAULT_PROJECT_TEMPLATE_BRANCH = 'main' as const;

export const FEEDBACK_INTERVAL = 10 as const;

export const HUBSPOT_FOLDER = '@hubspot' as const;
export const MARKETPLACE_FOLDER = '@marketplace' as const;

export const DEFAULT_POLLING_DELAY = 2000;

export const PROJECT_CONFIG_FILE = 'hsproject.json' as const;

export const PROJECT_BUILD_STATES = {
  BUILDING: 'BUILDING',
  ENQUEUED: 'ENQUEUED',
  FAILURE: 'FAILURE',
  PENDING: 'PENDING',
  SUCCESS: 'SUCCESS',
} as const;

export const PROJECT_DEPLOY_STATES = {
  DEPLOYING: 'DEPLOYING',
  FAILURE: 'FAILURE',
  PENDING: 'PENDING',
  SUCCESS: 'SUCCESS',
} as const;

export const PROJECT_BUILD_TEXT = {
  STATES: { ...PROJECT_BUILD_STATES },
  STATUS_TEXT: 'Building',
  SUBTASK_KEY: 'subbuildStatuses',
  TYPE_KEY: 'buildType',
  SUBTASK_NAME_KEY: 'buildName',
} as const;

export const PROJECT_DEPLOY_TEXT = {
  STATES: { ...PROJECT_DEPLOY_STATES },
  STATUS_TEXT: 'Deploying',
  SUBTASK_KEY: 'subdeployStatuses',
  TYPE_KEY: 'deployType',
  SUBTASK_NAME_KEY: 'deployName',
} as const;

export const PROJECT_ERROR_TYPES = {
  PROJECT_LOCKED: 'BuildPipelineErrorType.PROJECT_LOCKED',
  MISSING_PROJECT_PROVISION: 'BuildPipelineErrorType.MISSING_PROJECT_PROVISION',
  BUILD_NOT_IN_PROGRESS: 'BuildPipelineErrorType.BUILD_NOT_IN_PROGRESS',
  SUBBUILD_FAILED: 'BuildPipelineErrorType.DEPENDENT_SUBBUILD_FAILED',
  SUBDEPLOY_FAILED: 'DeployPipelineErrorType.DEPENDENT_SUBDEPLOY_FAILED',
  DEPLOY_CONTAINS_REMOVALS:
    'DeployPipelineErrorType.WARNING_DEPLOY_CONTAINS_REMOVALS',
} as const;

export const PROJECT_TASK_TYPES: { [key: string]: string } = {
  PRIVATE_APP: 'private app',
  PUBLIC_APP: 'public app',
  APP_FUNCTION: 'function',
  CRM_CARD_V2: 'card',
};

export const PROJECT_COMPONENT_TYPES = {
  PROJECTS: 'projects',
  COMPONENTS: 'components',
} as const;

export const PLATFORM_VERSION_ERROR_TYPES = {
  PLATFORM_VERSION_NOT_SPECIFIED:
    'PlatformVersionErrorType.PLATFORM_VERSION_NOT_SPECIFIED',
  PLATFORM_VERSION_RETIRED: 'PlatformVersionErrorType.PLATFORM_VERSION_RETIRED',
  PLATFORM_VERSION_SPECIFIED_DOES_NOT_EXIST:
    'PlatformVersionErrorType.PLATFORM_VERSION_SPECIFIED_DOES_NOT_EXIST',
} as const;

export const IR_COMPONENT_TYPES = {
  APPLICATION: 'APPLICATION',
  CARD: 'CARD',
} as const;

export const APP_DISTRIBUTION_TYPES = {
  MARKETPLACE: 'marketplace',
  PRIVATE: 'private',
} as const;

export const APP_AUTH_TYPES = {
  OAUTH: 'oauth',
  STATIC: 'static',
} as const;

export const FEATURES = {
  UNIFIED_APPS: 'Developers:UnifiedApps:PrivateBeta',
  SANDBOXES_V2: 'sandboxes:v2:enabled',
  SANDBOXES_V2_CLI: 'sandboxes:v2:cliEnabled',
  APP_EVENTS: 'Developers:UnifiedApps:AppEventsAccess',
  APPS_HOME: 'UIE:AppHome',
  MCP_ACCESS: 'Developers:CLIMCPAccess',
  THEME_MIGRATION_2025_2: 'Developers:ProjectThemeMigrations:2025.2',
  AGENT_TOOLS: 'ThirdPartyAgentTools',
} as const;

export const LOCAL_DEV_UI_MESSAGE_SEND_TYPES = {
  UPLOAD_SUCCESS: 'server:uploadSuccess',
  UPLOAD_FAILURE: 'server:uploadFailure',
  DEPLOY_SUCCESS: 'server:deploySuccess',
  DEPLOY_FAILURE: 'server:deployFailure',
  UPDATE_PROJECT_NODES: 'server:updateProjectNodes',
  UPDATE_APP_DATA: 'server:updateAppData',
  UPDATE_PROJECT_DATA: 'server:updateProjectData',
  UPDATE_UPLOAD_WARNINGS: 'server:updateUploadWarnings',
  CLI_METADATA: 'server:cliMetadata',
  DEV_SERVERS_STARTED: 'server:devServersStarted',
};

export const LOCAL_DEV_UI_MESSAGE_RECEIVE_TYPES = {
  UPLOAD: 'client:upload',
  DEPLOY: 'client:deploy',
  VIEWED_WELCOME_SCREEN: 'client:viewedWelcomeScreen',
  APP_INSTALL_SUCCESS: 'client:installSuccess',
  APP_INSTALL_INITIATED: 'client:installInitiated',
  APP_INSTALL_FAILURE: 'client:installFailure',
};

export const APP_INSTALLATION_STATES = {
  NOT_INSTALLED: 'NOT_INSTALLED',
  INSTALLED: 'INSTALLED',
  INSTALLED_WITH_OUTDATED_SCOPES: 'INSTALLED_WITH_OUTDATED_SCOPES',
  UNKNOWN: 'UNKNOWN',
} as const;

export const staticAuth = 'static';
export const oAuth = 'oauth';
export const privateDistribution = 'private';
export const marketplaceDistribution = 'marketplace';
export const appComponent = 'app';

export const GET_STARTED_OPTIONS = {
  APP: 'APP',
  CMS: 'CMS',
} as const;

export const LOCAL_DEV_SERVER_MESSAGE_TYPES = {
  INITIAL: 'INITIAL',
  WEBSOCKET_SERVER_CONNECTED: 'WEBSOCKET_SERVER_CONNECTED',
  STATIC_AUTH_APP_INSTALL_SUCCESS: 'APP_INSTALL_SUCCESS',
  STATIC_AUTH_APP_INSTALL_FAILURE: 'APP_INSTALL_FAILURE',
  OAUTH_APP_INSTALL_INITIATED: 'APP_INSTALL_INITIATED',
} as const;

export const LOCAL_DEV_WEBSOCKET_SERVER_INSTANCE_ID =
  'local-dev-ui-websocket-server';

export const CONFIG_LOCAL_STATE_FLAGS = {
  LOCAL_DEV_UI_WELCOME: 'LOCAL_DEV_UI_WELCOME',
} as const;

export const EMPTY_PROJECT = 'empty';
export const PROJECT_WITH_APP = 'app';

export const LEGACY_SERVERLESS_FILE = 'serverless.json';
export const LEGACY_PUBLIC_APP_FILE = 'public-app.json';
export const LEGACY_PRIVATE_APP_FILE = 'app.json';
export const THEME_FILE = 'theme.json';
export const CMS_ASSETS_FILE = 'cms-assets.json';

export const LEGACY_CONFIG_FILES = [
  LEGACY_SERVERLESS_FILE,
  LEGACY_PRIVATE_APP_FILE,
  LEGACY_PUBLIC_APP_FILE,
];
