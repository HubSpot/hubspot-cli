const http = require('../http');
const fs = require('fs');

const PROJECTS_API_PATH = 'dfs/v1/projects';
const PROJECTS_DEPLOY_API_PATH = 'dfs/deploy/v1';

/**
 * Fetch projects
 *
 * @async
 * @returns {Promise}
 */
async function fetchProjects(portalId) {
  return http.get(portalId, {
    uri: PROJECTS_API_PATH,
  });
}

/**
 * Create project
 *
 * @async
 * @param {string} name
 * @returns {Promise}
 */
async function createProject(portalId, name) {
  return http.post(portalId, {
    uri: PROJECTS_API_PATH,
    body: {
      name,
    },
  });
}

/**
 * Upload project
 *
 * @async
 * @param {string} projectName
 * @param {string} projectFile
 * @returns {Promise}
 */
async function uploadProject(accountId, projectName, projectFile) {
  return http.post(accountId, {
    uri: `${PROJECTS_API_PATH}/upload/${projectName}`,
    timeout: 60000,
    formData: {
      file: fs.createReadStream(projectFile),
    },
  });
}

/**
 * Fetch project
 *
 * @async
 * @param {string} name
 * @returns {Promise}
 */
async function fetchProject(portalId, name) {
  return http.get(portalId, {
    uri: `${PROJECTS_API_PATH}/${name}`,
  });
}

/**
 * Delete project
 *
 * @async
 * @param {string} name
 * @returns {Promise}
 */
async function deleteProject(portalId, name) {
  return http.delete(portalId, {
    uri: `${PROJECTS_API_PATH}/${name}`,
  });
}

/**
 * Get project build status
 *
 * @async
 * @param {string} projectName
 * @param {number} buildId
 * @returns {Promise}
 */
async function getBuildStatus(portalId, projectName, buildId) {
  return http.get(portalId, {
    uri: `${PROJECTS_API_PATH}/${projectName}/builds/${buildId}/status`,
  });
}

/**
 * Deploy project
 *
 * @async
 * @param {string} projectName
 * @param {number} buildId
 * @returns {Promise}
 */
async function deployProject(portalId, projectName, buildId) {
  return http.post(portalId, {
    uri: `${PROJECTS_DEPLOY_API_PATH}/deploys/queue/async`,
    body: {
      projectName,
      buildId,
    },
  });
}

/**
 * Get project deploy status
 *
 * @async
 * @param {string} projectName
 * @param {number} deployId
 * @returns {Promise}
 */
async function getDeployStatus(portalId, projectName, deployId) {
  return http.get(portalId, {
    uri: `${PROJECTS_DEPLOY_API_PATH}/deploy-status/projects/${projectName}/deploys/${deployId}`,
  });
}

module.exports = {
  fetchProjects,
  createProject,
  uploadProject,
  fetchProject,
  deleteProject,
  getBuildStatus,
  deployProject,
  getDeployStatus,
};
