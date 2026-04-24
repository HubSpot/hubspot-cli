import { getProjectConfig } from './config.js';
import { ensureProjectExists } from './ensureProjectExists.js';
import { fetchProjectComponentsMetadata } from '@hubspot/local-dev-lib/api/projects';
import { fetchAppMetadataBySourceId } from '@hubspot/local-dev-lib/api/appsDev';
import { AppFunctionComponentMetadata } from '@hubspot/local-dev-lib/types/ComponentStructure';
import { uiLogger } from '../ui/logger.js';
import { commands } from '../../lang/en.js';
import { isLegacyProject } from '@hubspot/project-parsing-lib/projects';
import { getDeployedProjectNodes } from './localDev/helpers/project.js';
import { ProjectConfig } from '../../types/Projects.js';
import { debugError } from '../errorHandlers/index.js';

type FunctionInfo = {
  componentName: string;
  appId: number;
  endpoint?: { path: string };
};

class _ProjectLogsManager {
  projectName: string | undefined;
  projectConfig: ProjectConfig | undefined;
  projectId: number | undefined;
  accountId: number | undefined;
  functions: FunctionInfo[];
  selectedFunction: FunctionInfo | undefined;
  functionName: string | undefined;
  appId: number | undefined;
  isPublicFunction: boolean | undefined;
  endpointName: string | undefined;

  reset(): void {
    this.projectName = undefined;
    this.projectConfig = undefined;
    this.projectId = undefined;
    this.accountId = undefined;
    this.functions = [];
    this.selectedFunction = undefined;
    this.functionName = undefined;
    this.appId = undefined;
    this.isPublicFunction = undefined;
    this.endpointName = undefined;
  }

  constructor() {
    this.functions = [];
  }

  async init(accountId: number): Promise<void> {
    const { projectConfig } = await getProjectConfig();

    if (!projectConfig || !projectConfig.name) {
      throw new Error(commands.project.logs.errors.noProjectConfig);
    }

    this.projectConfig = projectConfig;
    this.projectName = projectConfig.name;
    this.accountId = accountId;
    this.functions = [];

    const { project } = await ensureProjectExists(
      this.accountId,
      this.projectName,
      {
        allowCreate: false,
      }
    );

    if (
      !project ||
      !project.deployedBuild ||
      !project.deployedBuild.subbuildStatuses
    ) {
      throw new Error(commands.project.logs.errors.failedToFetchProjectDetails);
    }

    this.projectId = project.id;

    if (!isLegacyProject(projectConfig.platformVersion)) {
      const deployedBuildId = project.deployedBuild.buildId;
      if (!deployedBuildId) {
        throw new Error(commands.project.logs.errors.noDeployedBuild);
      }
      await this.fetchFunctionDetailsV2(deployedBuildId);
    } else {
      await this.fetchFunctionDetails();
    }
  }

  async fetchFunctionDetails(): Promise<void> {
    if (!this.projectId) {
      throw new Error(commands.project.logs.errors.noProjectConfig);
    }

    if (!this.accountId) {
      uiLogger.debug(
        commands.project.logs.errors.projectLogsManagerNotInitialized
      );
      throw new Error(commands.project.logs.errors.generic);
    }

    const {
      data: { topLevelComponentMetadata },
    } = await fetchProjectComponentsMetadata(this.accountId, this.projectId);

    const apps = topLevelComponentMetadata.filter(componentMetadata => {
      const { type } = componentMetadata;
      return type && type.name === 'PRIVATE_APP';
    });

    apps.forEach(app => {
      const appFunctions = app.featureComponents.filter(
        component => component.type.name === 'APP_FUNCTION'
      ) as AppFunctionComponentMetadata[];

      appFunctions.forEach(fn => {
        if (fn.deployOutput) {
          this.functions.push({
            componentName: fn.componentName,
            appId: fn.deployOutput.appId,
            endpoint: fn.deployOutput.endpoint,
          });
        }
      });
    });

    if (this.functions.length === 0) {
      throw new Error(commands.project.logs.errors.noFunctionsInProject);
    }
  }

  async fetchFunctionDetailsV2(deployedBuildId: number): Promise<void> {
    if (!this.projectId || !this.accountId || !this.projectConfig) {
      uiLogger.debug(
        commands.project.logs.errors.projectLogsManagerNotInitialized
      );
      throw new Error(commands.project.logs.errors.generic);
    }

    let deployedNodes;
    try {
      deployedNodes = await getDeployedProjectNodes(
        this.projectConfig,
        this.accountId,
        deployedBuildId
      );
    } catch (err) {
      debugError(err);
      throw new Error(commands.project.logs.errors.failedToFetchProjectDetails);
    }

    const appNode = Object.values(deployedNodes).find(
      node => node.componentType === 'APPLICATION'
    );

    if (!appNode) {
      throw new Error(commands.project.logs.errors.noFunctionsInProject);
    }

    let appId: number;
    try {
      const { data: appMetadata } = await fetchAppMetadataBySourceId(
        this.projectId,
        appNode.uid,
        this.accountId
      );
      appId = appMetadata.id;
    } catch (err) {
      debugError(err);
      throw new Error(commands.project.logs.errors.failedToFetchProjectDetails);
    }

    const functionNodes = Object.values(deployedNodes).filter(
      node => node.componentType === 'APP_FUNCTION'
    );

    for (const fnNode of functionNodes) {
      const config = fnNode.config as {
        endpoint?: { path: string };
      };

      this.functions.push({
        componentName: fnNode.uid,
        appId,
        endpoint: config.endpoint,
      });
    }

    if (this.functions.length === 0) {
      throw new Error(commands.project.logs.errors.noFunctionsInProject);
    }
  }

  getFunctionNames() {
    return this.functions.map(
      serverlessFunction => serverlessFunction.componentName
    );
  }

  setFunction(functionName?: string) {
    if (this.functions.length === 0) {
      throw new Error(commands.project.logs.errors.noFunctionsInProject);
    }

    if (!functionName) {
      throw new Error(commands.project.logs.errors.functionNameRequired);
    }

    this.selectedFunction = this.functions.find(
      serverlessFunction => serverlessFunction.componentName === functionName
    );

    if (!this.selectedFunction) {
      throw new Error(
        commands.project.logs.errors.noFunctionWithName(functionName)
      );
    }

    this.functionName = functionName;
    this.appId = this.selectedFunction.appId;

    if (this.selectedFunction.endpoint) {
      this.endpointName = this.selectedFunction.endpoint.path;
      this.isPublicFunction = true;
    } else {
      this.isPublicFunction = false;
    }
  }
}

export const ProjectLogsManager = new _ProjectLogsManager();
