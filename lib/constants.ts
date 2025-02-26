export const HUBSPOT_PROJECT_COMPONENTS_GITHUB_PATH =
  'HubSpot/hubspot-project-components' as const;
export const DEFAULT_PROJECT_TEMPLATE_BRANCH = 'main' as const;

export const FEEDBACK_INTERVAL = 10 as const;

export const HUBSPOT_FOLDER = '@hubspot' as const;
export const MARKETPLACE_FOLDER = '@marketplace' as const;

export const CONFIG_FLAGS = {
  USE_CUSTOM_OBJECT_HUBFILE: 'useCustomObjectHubfile',
} as const;

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
