import { Build, SubbuildStatus } from '@hubspot/local-dev-lib/types/Build';
import { Deploy, SubdeployStatus } from '@hubspot/local-dev-lib/types/Deploy';

export type ProjectTemplate = {
  name: string;
  label: string;
  path: string;
  insertPath: string;
};

export type ComponentTemplate = {
  path: string;
  label: string;
  insertPath: string;
};

export type ProjectConfig = {
  name: string;
  srcDir: string;
  platformVersion: string;
};

export type ProjectTaskStates = {
  BUILDING?: string;
  ENQUEUED?: string;
  DEPLOYING?: string;
  FAILURE: string;
  PENDING: string;
  SUCCESS: string;
};

export type ProjectTask = Build | Deploy;
export type ProjectSubtask = SubbuildStatus | SubdeployStatus;

export type ProjectPollStatusFunctionText = {
  STATES: ProjectTaskStates;
  STATUS_TEXT: string;
  TYPE_KEY: string;
  SUBTASK_NAME_KEY: string;
};

export type ProjectTemplateRepoConfig = {
  projects?: ProjectTemplate[];
  components?: ComponentTemplate[];
};

export type ProjectPollResult = {
  succeeded: boolean;
  buildId: number;
  buildResult: Build;
  deployResult: Deploy | null;
};

export type PrivateAppComponentConfig = {
  name: string;
  description: string;
  uid: string;
  scopes: Array<string>;
  public: boolean;
  extensions?: {
    crm: {
      cards: Array<{ file: string }>;
    };
  };
};

export type PublicAppComponentConfig = {
  name: string;
  uid: string;
  description: string;
  allowedUrls: Array<string>;
  auth: {
    redirectUrls: Array<string>;
    requiredScopes: Array<string>;
    optionalScopes: Array<string>;
    conditionallyRequiredScopes: Array<string>;
  };
  support: {
    supportEmail: string;
    documentationUrl: string;
    supportUrl: string;
    supportPhone: string;
  };
  extensions?: {
    crm: {
      cards: Array<{ file: string }>;
    };
  };
  webhooks?: {
    file: string;
  };
};

export type AppCardComponentConfig = {
  type: 'crm-card';
  data: {
    title: string;
    uid: string;
    location: string;
    module: {
      file: string;
    };
    objectTypes: Array<{ name: string }>;
  };
};

export type GenericComponentConfig =
  | PublicAppComponentConfig
  | PrivateAppComponentConfig
  | AppCardComponentConfig;

export enum ComponentTypes {
  PrivateApp = 'private-app',
  PublicApp = 'public-app',
  HublTheme = 'hubl-theme',
}

export type Component<T = GenericComponentConfig> = {
  type: ComponentTypes;
  config: T;
  runnable: boolean;
  path: string;
};
