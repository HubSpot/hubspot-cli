import { IntermediateRepresentationNodeLocalDev } from '@hubspot/project-parsing-lib/src/lib/types';
import { Build } from '@hubspot/local-dev-lib/types/Build';
import { Environment } from '@hubspot/local-dev-lib/types/Config';
import { ProjectConfig } from './Projects';

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
