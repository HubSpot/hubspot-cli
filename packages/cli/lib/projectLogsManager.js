const { getProjectConfig, ensureProjectExists } = require('./projects');
const { logger } = require('../../../../hubspot-local-dev-lib/dist/lib/logger');
const {
  fetchProjectComponentsMetadata,
} = require('../../../../hubspot-local-dev-lib/dist/api/projects');

class ProjectLogsManager {
  static isPublicFunction = false;
  static isAppFunction = false;
  static functions = [];
  static selectedFunction = [];

  static async init(accountId) {
    const { projectConfig } = await getProjectConfig();

    if (!projectConfig || !projectConfig.name) {
      //TODO[JOE] Proper error message
      throw new Error('Project config missing');
    }

    const { name: projectName } = projectConfig;

    this.projectName = projectName;
    this.accountId = accountId;

    const { project } = await ensureProjectExists(
      this.accountId,
      this.projectName,
      {
        allowCreate: false,
      }
    );

    if (!(project.deployedBuild && project.deployedBuild.subbuildStatuses)) {
      logger.debug('Failed to fetch project');
      throw new Error('Failed to fetch project');
    }

    this.projectId = project.id;
    await this.fetchFunctionDetails();
  }

  static async fetchFunctionDetails() {
    if (!this.projectId) {
      throw new Error('Project not initialized');
    }

    const { topLevelComponentMetadata } = await fetchProjectComponentsMetadata(
      this.accountId,
      this.projectId
    );

    const apps = topLevelComponentMetadata.filter(componentMetadata => {
      const { type } = componentMetadata;
      return type && type.name === 'PRIVATE_APP';
    });

    apps.forEach(app => {
      this.appId = app.deployOutput.appId;
      this.functions.push(
        ...app.featureComponents.filter(
          component => component.type.name === 'APP_FUNCTION'
        )
      );
    });

    if (!this.appId) {
      logger.error(`App id missing, we won't be able to fetch the logs`);
      throw new Error('App id missing');
    }
  }

  static getFunctionNames() {
    if (!this.functions) {
      return [];
    }
    return this.functions.map(
      serverlessFunction => serverlessFunction.componentName
    );
  }

  static setFunction(functionName) {
    this.functionName = functionName;
    const functions = this.functions.filter(
      serverlessFunction => serverlessFunction.componentName === functionName
    );
    this.selectedFunction = functions[0];
    if (this.selectedFunction.deployOutput.endpoint) {
      this.endpointName = this.selectedFunction.deployOutput.endpoint.path;
      this.isPublicFunction = true;
    } else {
      this.isAppFunction = true;
    }
  }
}

module.exports = ProjectLogsManager;
