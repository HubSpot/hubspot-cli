const http = require('../http');

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
// TODO: paging?

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
  fetchProject,
  deleteProject,
};
