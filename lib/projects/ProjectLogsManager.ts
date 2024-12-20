import { getProjectConfig, ensureProjectExists } from './index';
import { fetchProjectComponentsMetadata } from '@hubspot/local-dev-lib/api/projects';
import { AppFunctionComponentMetadata } from '@hubspot/local-dev-lib/types/ComponentStructure';
import { logger } from '@hubspot/local-dev-lib/logger';
import { i18n } from '../lang';
import { uiLink } from '../ui';

const i18nKey = 'commands.project.subcommands.logs';

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
      throw new Error(i18n(`${i18nKey}.errors.noProjectConfig`));
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
      throw new Error(i18n(`${i18nKey}.errors.failedToFetchProjectDetails`));
    }

    this.projectId = project.id;
    await this.fetchFunctionDetails();
  }

  async fetchFunctionDetails(): Promise<void> {
    if (!this.projectId) {
      throw new Error(i18n(`${i18nKey}.errors.noProjectConfig`));
    }

    if (!this.accountId) {
      logger.debug(i18n(`${i18nKey}.errors.projectLogsManagerNotInitialized`));
      throw new Error(i18n(`${i18nKey}.errors.generic`));
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
      throw new Error(
        i18n(`${i18nKey}.errors.noFunctionsInProject`, {
          link: uiLink(
            i18n(`${i18nKey}.errors.noFunctionsLinkText`),
            'https://developers.hubspot.com/docs/platform/serverless-functions'
          ),
        })
      );
    }
  }

  getFunctionNames() {
    return this.functions.map(
      serverlessFunction => serverlessFunction.componentName
    );
  }

  setFunction(functionName: string) {
    if (!(this.functions.length > 0)) {
      throw new Error(
        i18n(`${i18nKey}.errors.noFunctionsInProject`, {
          link: uiLink(
            i18n(`${i18nKey}.errors.noFunctionsLinkText`),
            'https://developers.hubspot.com/docs/platform/serverless-functions'
          ),
        })
      );
    }

    this.selectedFunction = this.functions.find(
      serverlessFunction => serverlessFunction.componentName === functionName
    );

    if (!this.selectedFunction) {
      throw new Error(
        i18n(`${i18nKey}.errors.noFunctionWithName`, { name: functionName })
      );
    }

    this.functionName = functionName;

    if (!this.selectedFunction.deployOutput) {
      throw new Error(
        i18n(`${i18nKey}.errors.functionNotDeployed`, { name: functionName })
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
