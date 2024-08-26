const { getProjectConfig, ensureProjectExists } = require('./projects');
const {
  fetchProjectComponentsMetadata,
} = require('../../../../hubspot-local-dev-lib/dist/api/projects');

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
      //TODO Proper error message
      throw new Error('Project config missing');
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
      //TODO Proper error message
      throw new Error('Failed to fetch project');
    }

    this.projectId = project.id;
    await this.fetchFunctionDetails();
  }

  async fetchFunctionDetails() {
    if (!this.projectId) {
      //TODO Proper error message
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
      throw new Error('Unable to set function, no functions to choose from');
    }

    this.selectedFunction = this.functions.find(
      serverlessFunction => serverlessFunction.componentName === functionName
    );

    if (!this.selectedFunction) {
      throw new Error(`No function with name ${functionName}`);
    }

    this.functionName = functionName;

    if (!this.selectedFunction.deployOutput) {
      // TODO[JOE] Error message
      throw new Error(`No function with name ${functionName}`);
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

  async tailCall() {
    // TODO: Wire this up when the backend is ready
    return {};
  }

  async fetchLatest() {
    // TODO: Wire this up when the backend is ready
    return {};
  }
}

module.exports = new ProjectLogsManager();
