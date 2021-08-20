const http = require('../http');
const fs = require('fs');

const DEVELOPER_FILE_SYSTEM_API_PATH = 'dfs/v1/projects';

/**
 * Fetch projects
 *
 * @async
 * @returns {Promise}
 */
async function fetchProjects(portalId) {
  return http.get(portalId, {
    uri: DEVELOPER_FILE_SYSTEM_API_PATH,
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
    uri: DEVELOPER_FILE_SYSTEM_API_PATH,
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
    uri: `${DEVELOPER_FILE_SYSTEM_API_PATH}/upload/${projectName}`,
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
    uri: `${DEVELOPER_FILE_SYSTEM_API_PATH}/${name}`,
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
    uri: `${DEVELOPER_FILE_SYSTEM_API_PATH}/${name}`,
  });
}

module.exports = {
  fetchProjects,
  createProject,
  uploadProject,
  fetchProject,
  deleteProject,
};
