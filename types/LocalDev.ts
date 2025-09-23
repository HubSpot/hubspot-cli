import {
  HSProfileVariables,
  IntermediateRepresentationNodeLocalDev,
} from '@hubspot/project-parsing-lib/src/lib/types.js';
import { Environment } from '@hubspot/local-dev-lib/types/Config';
import { ValueOf } from '@hubspot/local-dev-lib/types/Utils';
import { Project } from '@hubspot/local-dev-lib/types/Project';
import { ProjectConfig } from './Projects.js';
import LocalDevState from '../lib/projects/localDev/LocalDevState.js';
import {
  APP_INSTALLATION_STATES,
  LOCAL_DEV_UI_MESSAGE_RECEIVE_TYPES,
  LOCAL_DEV_SERVER_MESSAGE_TYPES,
} from '../lib/constants.js';

export type LocalDevStateConstructorOptions = {
  targetProjectAccountId: number;
  targetTestingAccountId: number;
  profile?: string;
  projectConfig: ProjectConfig;
  projectDir: string;
  projectData: Project;
  debug?: boolean;
  initialProjectNodes: {
    [key: string]: IntermediateRepresentationNodeLocalDev;
  };
  initialProjectProfileData: HSProfileVariables;
  env: Environment;
};

export type LocalDevWebsocketMessage = {
  type: string;
  data?: unknown;
};

export type LocalDevDeployWebsocketMessage = {
  type: typeof LOCAL_DEV_UI_MESSAGE_RECEIVE_TYPES.DEPLOY;
  data: {
    force: boolean;
  };
};

export type LocalDevStateListener<K extends keyof LocalDevState> = (
  value: LocalDevState[K]
) => void;

export type AppLocalDevData = {
  id: number;
  clientId: string;
  name: string;
  installationState: ValueOf<typeof APP_INSTALLATION_STATES>;
  scopeGroupIds: number[];
};

export type LocalDevServerMessage = ValueOf<
  typeof LOCAL_DEV_SERVER_MESSAGE_TYPES
>;

export type LocalDevProjectUploadResult = {
  uploadSuccess: boolean;
  buildSuccess: boolean;
  deploySuccess?: boolean;
  deployId?: number;
};

export type LocalDevProjectDeployResult = {
  success: boolean;
  deployId?: number;
};
