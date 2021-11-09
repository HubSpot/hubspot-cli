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
    uri: `${PROJECTS_API_PATH}/upload/${encodeURIComponent(projectName)}`,
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
 * @param {string} projectName
 * @returns {Promise}
 */
async function fetchProject(portalId, projectName) {
  return http.get(portalId, {
    uri: `${PROJECTS_API_PATH}/${encodeURIComponent(projectName)}`,
  });
}

/**
 * Delete project
 *
 * @async
 * @param {string} projectName
 * @returns {Promise}
 */
async function deleteProject(portalId, projectName) {
  return http.delete(portalId, {
    uri: `${PROJECTS_API_PATH}/${encodeURIComponent(projectName)}`,
  });
}

/**
 * Fetch list of project builds
 *
 * @async
 * @param {string} projectName
 * @returns {Promise}
 */
async function fetchProjectBuilds(portalId, projectName, query) {
  return http.get(portalId, {
    uri: `${PROJECTS_API_PATH}/${encodeURIComponent(projectName)}/builds`,
    query,
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
    uri: `${PROJECTS_API_PATH}/${encodeURIComponent(
      projectName
    )}/builds/${buildId}/status`,
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
    uri: `${PROJECTS_DEPLOY_API_PATH}/deploy-status/projects/${encodeURIComponent(
      projectName
    )}/deploys/${deployId}`,
  });
}

/**
 * Get project settings
 *
 * @async
 * @param {string} projectName
 * @returns {Promise}
 */
async function fetchProjectSettings(portalId, projectName) {
  return http.get(portalId, {
    uri: `${PROJECTS_API_PATH}/${encodeURIComponent(projectName)}/settings`,
  });
}

module.exports = {
  fetchProjects,
  createProject,
  uploadProject,
  fetchProject,
  deleteProject,
  fetchProjectBuilds,
  getBuildStatus,
  deployProject,
  getDeployStatus,
  fetchProjectSettings,
};
