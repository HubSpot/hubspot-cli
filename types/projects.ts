import { Build, SubbuildStatus } from '@hubspot/local-dev-lib/types/Build';
import { Deploy, SubdeployStatus } from '@hubspot/local-dev-lib/types/Deploy';

export type ProjectTemplate = {
  name: string;
  label: string;
  path: string;
  insertPath: string;
};

export type ComponentTemplate = {
  label: string;
  path: string;
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

export type ProjectAddComponentData = {
  path: string;
  label: string;
  insertPath: string;
};

export type ProjectTemplateRepoConfig = {
  projects?: ProjectTemplate[];
  components?: ComponentTemplate[];
};
