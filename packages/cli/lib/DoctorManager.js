const { execSync } = require('child_process');
const path = require('path');
const { logger } = require('@hubspot/local-dev-lib/logger');
const { fetchProject } = require('@hubspot/local-dev-lib/api/projects');
const { getAccountId } = require('./commonOpts');

class DoctorManager {
  constructor() {
    this.accountId = getAccountId();
  }

  getNpmVersion() {
    try {
      return execSync('npm --version')
        .toString()
        .trim();
    } catch (e) {
      return null;
    }
  }

  shouldIncludeFile(file) {
    try {
      const ignoredDirs = ['node_modules'];
      for (const ignoredDir of ignoredDirs) {
        if (path.dirname(file).includes(path.join(path.sep, ignoredDir))) {
          return false;
        }
      }
    } catch (e) {
      logger.debug(e);
    }
    return true;
  }
  async fetchProjectDetails(accountId, projectConfig) {
    let projectDetails;
    try {
      projectDetails = await fetchProject(
        accountId,
        projectConfig.projectConfig.name
      );
      delete projectDetails.deployedBuild;
      delete projectDetails.latestBuild;
      delete projectDetails.portalId;
    } catch (e) {
      logger.debug(e);
    }
    return projectDetails;
  }
}

module.exports = DoctorManager;
