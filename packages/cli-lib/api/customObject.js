const fs = require('fs-extra');
const http = require('../http');

const CUSTOM_OBJECTS_API_PATH = 'crm/v3/objects';

const createObject = (accountId, objectTypeId, filePath) =>
  http.post(accountId, {
    url: `${CUSTOM_OBJECTS_API_PATH}/${objectTypeId}`,
    data: JSON.parse(fs.readFileSync(filePath, 'utf-8')),
  });

const updateObject = async (accountId, objectTypeId, filePath) =>
  http.post(accountId, {
    url: `${CUSTOM_OBJECTS_API_PATH}/${objectTypeId}`,
    data: JSON.parse(fs.readFileSync(filePath, 'utf-8')),
  });

const fetchObject = async (accountId, objectTypeId, instanceId) =>
  http.get(accountId, {
    url: `${CUSTOM_OBJECTS_API_PATH}/${objectTypeId}/${instanceId}`,
  });

const fetchObjects = async (accountId, objectTypeId) =>
  http.get(accountId, {
    url: `${CUSTOM_OBJECTS_API_PATH}/${objectTypeId}`,
  });

const archiveObject = async (accountId, objectTypeId, instanceId) =>
  http.delete(accountId, {
    url: `${CUSTOM_OBJECTS_API_PATH}/${objectTypeId}/${instanceId}`,
  });

const searchObjects = async (accountId, objectTypeId, filePath) =>
  http.post(accountId, {
    url: `${CUSTOM_OBJECTS_API_PATH}/${objectTypeId}/search`,
    data: JSON.parse(fs.readFileSync(filePath, 'utf-8')),
  });

const batchCreateObjects = (accountId, objectTypeId, filePath) =>
  http.post(accountId, {
    url: `${CUSTOM_OBJECTS_API_PATH}/${objectTypeId}/batch/create`,
    data: JSON.parse(fs.readFileSync(filePath, 'utf-8')),
  });

module.exports = {
  createObject,
  updateObject,
  fetchObject,
  fetchObjects,
  archiveObject,
  searchObjects,
  batchCreateObjects,
};
