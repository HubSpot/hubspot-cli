const { getProjectConfig, ensureProjectExists } = require('./projects');
const {
  fetchProjectComponentsMetadata,
} = require('@hubspot/local-dev-lib/api/projects');
const { i18n } = require('./lang');
const { uiLink } = require('./ui');

const i18nKey = 'commands.project.subcommands.logs';

class ProjectLogsManager {
  reset() {
    Object.keys(this).forEach(key => {
      if (Object.hasOwn(this, key)) {
        this[key] = undefined;
      }
    });
  }

  async init(accountId) {
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

  async fetchFunctionDetails() {
    if (!this.projectId) {
      throw new Error(i18n(`${i18nKey}.errors.noProjectConfig`));
    }

    const { topLevelComponentMetadata } = await fetchProjectComponentsMetadata(
      this.accountId,
      this.projectId
    );

    const apps = topLevelComponentMetadata.filter(componentMetadata => {
      const { type } = componentMetadata;
      return type && type.name === 'PRIVATE_APP';
    });

    if (!this.functions) {
      this.functions = [];
    }

    apps.forEach(app => {
      this.functions.push(
        ...app.featureComponents.filter(
          component => component.type.name === 'APP_FUNCTION'
        )
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
    if (!this.functions) {
      return [];
    }
    return this.functions.map(
      serverlessFunction => serverlessFunction.componentName
    );
  }

  setFunction(functionName) {
    if (!this.functions) {
      throw new Error(
        i18n(`${i18nKey}.errors.noFunctionsInProject`, {
          link: uiLink(
            i18n(`${i18nKey}.errors.noFunctionsLinkText`),
            'https://developers.hubspot.com/docs/platform/serverless-functions'
          ),
        }),
        {
          projectName: this.projectName,
        }
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
      this.method = this.selectedFunction.deployOutput.endpoint.method;
      this.isPublicFunction = true;
    } else {
      this.isPublicFunction = false;
    }
  }
}

module.exports = new ProjectLogsManager();
