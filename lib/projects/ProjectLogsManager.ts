import { getProjectConfig } from './config';
import { ensureProjectExists } from './ensureProjectExists';
import { fetchProjectComponentsMetadata } from '@hubspot/local-dev-lib/api/projects';
import { AppFunctionComponentMetadata } from '@hubspot/local-dev-lib/types/ComponentStructure';
import { uiLogger } from '../ui/logger';
import { commands } from '../../lang/en';

class _ProjectLogsManager {
  projectName: string | undefined;
  projectId: number | undefined;
  accountId: number | undefined;
  functions: AppFunctionComponentMetadata[];
  selectedFunction: AppFunctionComponentMetadata | undefined;
  functionName: string | undefined;
  appId: number | undefined;
  isPublicFunction: boolean | undefined;
  endpointName: string | undefined;

  reset(): void {
    this.projectName = undefined;
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

    const { name: projectName } = projectConfig;

    this.projectName = projectName;
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
    await this.fetchFunctionDetails();
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
      this.functions.push(
        // If component type is APP_FUNCTION, we can safely cast as AppFunctionComponentMetadata
        ...(app.featureComponents.filter(
          component => component.type.name === 'APP_FUNCTION'
        ) as AppFunctionComponentMetadata[])
      );
    });

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
    if (!functionName || this.functions.length === 0) {
      throw new Error(commands.project.logs.errors.noFunctionsInProject);
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

    if (!this.selectedFunction.deployOutput) {
      throw new Error(
        commands.project.logs.errors.functionNotDeployed(functionName)
      );
    }
    this.appId = this.selectedFunction.deployOutput.appId;

    if (this.selectedFunction.deployOutput.endpoint) {
      this.endpointName = this.selectedFunction.deployOutput.endpoint.path;
      this.isPublicFunction = true;
    } else {
      this.isPublicFunction = false;
    }
  }
}

export const ProjectLogsManager = new _ProjectLogsManager();
