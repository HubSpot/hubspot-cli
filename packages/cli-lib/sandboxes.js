/* eslint-disable no-useless-catch */
const {
  createSandbox: _createSandbox,
  deleteSandbox: _deleteSandbox,
  getSandboxUsageLimits: _getSandboxUsageLimits,
} = require('./api/sandbox-hubs');
const {
  initiateSync: _initiateSync,
  fetchTaskStatus: _fetchTaskStatus,
  fetchTypes: _fetchTypes,
} = require('./api/sandboxes-sync');

async function createSandbox(accountId, name, type) {
  let resp;

  try {
    resp = await _createSandbox(accountId, name, type);
  } catch (err) {
    throw err;
  }

  return {
    name,
    ...resp,
  };
}

async function deleteSandbox(parentAccountId, sandboxAccountId) {
  let resp;

  try {
    resp = await _deleteSandbox(parentAccountId, sandboxAccountId);
  } catch (err) {
    throw err;
  }

  return {
    parentAccountId,
    sandboxAccountId,
    ...resp,
  };
}

async function getSandboxUsageLimits(parentAccountId, sandboxAccountId) {
  let resp;

  try {
    resp = await _getSandboxUsageLimits(parentAccountId, sandboxAccountId);
  } catch (err) {
    throw err;
  }

  return resp && resp.usage;
}

async function initiateSync(fromHubId, toHubId, tasks, sandboxHubId) {
  let resp;

  try {
    resp = await _initiateSync(fromHubId, toHubId, tasks, sandboxHubId);
  } catch (err) {
    throw err;
  }

  return resp;
}

async function fetchTaskStatus(accountId, taskId) {
  let resp;

  try {
    resp = await _fetchTaskStatus(accountId, taskId);
  } catch (err) {
    throw err;
  }

  return resp;
}

async function fetchTypes(accountId, toHubId) {
  let resp;

  try {
    resp = await _fetchTypes(accountId, toHubId);
  } catch (err) {
    throw err;
  }

  return resp && resp.results;
}

module.exports = {
  createSandbox,
  deleteSandbox,
  getSandboxUsageLimits,
  initiateSync,
  fetchTaskStatus,
  fetchTypes,
};
