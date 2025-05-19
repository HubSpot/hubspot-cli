import { IntermediateRepresentationNodeLocalDev } from '@hubspot/project-parsing-lib/src/lib/types';
import { Build } from '@hubspot/local-dev-lib/types/Build';
import { Environment } from '@hubspot/local-dev-lib/types/Config';
import { ProjectConfig } from './Projects';
import LocalDevState from '../lib/projects/localDev/LocalDevState';

export type LocalDevStateConstructorOptions = {
  targetProjectAccountId: number;
  targetTestingAccountId: number;
  projectConfig: ProjectConfig;
  projectDir: string;
  projectId: number;
  debug?: boolean;
  deployedBuild?: Build;
  isGithubLinked: boolean;
  initialProjectNodes: {
    [key: string]: IntermediateRepresentationNodeLocalDev;
  };
  env: Environment;
};

export type LocalDevWebsocketMessage = {
  type: string;
  data: unknown;
};

export type LocalDevStateListener<K extends keyof LocalDevState> = (
  value: LocalDevState[K]
) => void;
