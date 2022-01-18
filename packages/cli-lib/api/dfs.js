const http = require('../http');
const fs = require('fs');

const PROJECTS_API_PATH = 'dfs/v1/projects';
const PROJECTS_DEPLOY_API_PATH = 'dfs/deploy/v1';

/**
 * Fetch projects
 *
 * @async
 * @param {number} accountId
 * @returns {Promise}
 */
async function fetchProjects(accountId) {
  return http.get(accountId, {
    uri: PROJECTS_API_PATH,
  });
}

/**
 * Create project
 *
 * @async
 * @param {number} accountId
 * @param {string} name
 * @returns {Promise}
 */
async function createProject(accountId, name) {
  return http.post(accountId, {
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
 * @param {number} accountId
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
 * @param {number} accountId
 * @param {string} projectName
 * @returns {Promise}
 */
async function fetchProject(accountId, projectName) {
  return http.get(accountId, {
    uri: `${PROJECTS_API_PATH}/${encodeURIComponent(projectName)}`,
  });
}

/**
 * Delete project
 *
 * @async
 * @param {number} accountId
 * @param {string} projectName
 * @returns {Promise}
 */
async function deleteProject(accountId, projectName) {
  return http.delete(accountId, {
    uri: `${PROJECTS_API_PATH}/${encodeURIComponent(projectName)}`,
  });
}

/**
 * Fetch list of project builds
 *
 * @async
 * @param {number} accountId
 * @param {string} projectName
 * @param {object} query
 * @returns {Promise}
 */
async function fetchProjectBuilds(accountId, projectName, query) {
  return http.get(accountId, {
    uri: `${PROJECTS_API_PATH}/${encodeURIComponent(projectName)}/builds`,
    query,
  });
}

/**
 * Get project build status
 *
 * @async
 * @param {number} accountId
 * @param {string} projectName
 * @param {number} buildId
 * @returns {Promise}
 */
async function getBuildStatus(accountId, projectName, buildId) {
  return http.get(accountId, {
    uri: `${PROJECTS_API_PATH}/${encodeURIComponent(
      projectName
    )}/builds/${buildId}/status`,
  });
}

/**
 * Deploy project
 *
 * @async
 * @param {number} accountId
 * @param {string} projectName
 * @param {number} buildId
 * @returns {Promise}
 */
async function deployProject(accountId, projectName, buildId) {
  return http.post(accountId, {
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
 * @param {number} accountId
 * @param {string} projectName
 * @param {number} deployId
 * @returns {Promise}
 */
async function getDeployStatus(accountId, projectName, deployId) {
  return http.get(accountId, {
    uri: `${PROJECTS_DEPLOY_API_PATH}/deploy-status/projects/${encodeURIComponent(
      projectName
    )}/deploys/${deployId}`,
  });
}

/**
 * Get project settings
 *
 * @async
 * @param {number} accountId
 * @param {string} projectName
 * @returns {Promise}
 */
async function fetchProjectSettings(accountId, projectName) {
  return http.get(accountId, {
    uri: `${PROJECTS_API_PATH}/${encodeURIComponent(projectName)}/settings`,
  });
}

/**
 * Provision new project build
 *
 * @async
 * @param {number} accountId
 * @param {string} projectName
 * @returns {Promise}
 */
async function provisionBuild(accountId, projectName) {
  return http.post(accountId, {
    uri: `${PROJECTS_API_PATH}/${encodeURIComponent(
      projectName
    )}/builds/staged/provision`,
    timeout: 50000,
  });
}

/**
 * Queue build
 *
 * @async
 * @param {number} accountId
 * @param {string} projectName
 * @returns {Promise}
 */
async function queueBuild(accountId, projectName) {
  return http.post(accountId, {
    uri: `${PROJECTS_API_PATH}/${encodeURIComponent(
      projectName
    )}/builds/staged/queue`,
  });
}

/**
 * Upload file to staged build (watch)
 *
 * @async
 * @param {number} accountId
 * @param {string} projectName
 * @param {string} filePath
 * @param {string} path
 * @returns {Promise}
 */
async function uploadFileToBuild(accountId, projectName, filePath, path) {
  return http.put(accountId, {
    uri: `${PROJECTS_API_PATH}/${encodeURIComponent(
      projectName
    )}/builds/staged/files/${encodeURIComponent(path)}`,
    formData: {
      file: fs.createReadStream(filePath),
    },
  });
}

/**
 * Delete file from staged build (watch)
 *
 * @async
 * @param {number} accountId
 * @param {string} projectName
 * @param {string} path
 * @returns {Promise}
 */
async function deleteFileFromBuild(accountId, projectName, path) {
  return http.delete(accountId, {
    uri: `${PROJECTS_API_PATH}/${encodeURIComponent(
      projectName
    )}/builds/staged/files/${encodeURIComponent(path)}`,
  });
}

/**
 * Cancel staged build
 *
 * @async
 * @param {number} accountId
 * @param {string} projectName
 * @returns {Promise}
 */
async function cancelStagedBuild(accountId, projectName) {
  return http.post(accountId, {
    uri: `${PROJECTS_API_PATH}/${encodeURIComponent(
      projectName
    )}/builds/staged/cancel`,
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
  provisionBuild,
  queueBuild,
  uploadFileToBuild,
  deleteFileFromBuild,
  cancelStagedBuild,
};
