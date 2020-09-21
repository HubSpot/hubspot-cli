const fs = require('fs-extra');
const http = require('../http');

const CUSTOM_OBJECTS_API_PATH = 'crm/v3/objects';

const createObject = (portalId, objectTypeId, filePath) =>
  http.post(portalId, {
    uri: `${CUSTOM_OBJECTS_API_PATH}/${objectTypeId}`,
    body: JSON.parse(fs.readFileSync(filePath, 'utf-8')),
  });

const updateObject = async (portalId, objectTypeId, filePath) =>
  http.post(portalId, {
    uri: `${CUSTOM_OBJECTS_API_PATH}/${objectTypeId}`,
    body: JSON.parse(fs.readFileSync(filePath, 'utf-8')),
  });

const fetchObject = async (portalId, objectTypeId, instanceId) =>
  http.get(portalId, {
    uri: `${CUSTOM_OBJECTS_API_PATH}/${objectTypeId}/${instanceId}`,
  });

const fetchObjects = async (portalId, objectTypeId) =>
  http.get(portalId, {
    uri: `${CUSTOM_OBJECTS_API_PATH}/${objectTypeId}`,
  });

const archiveObject = async (portalId, objectTypeId, instanceId) =>
  http.delete(portalId, {
    uri: `${CUSTOM_OBJECTS_API_PATH}/${objectTypeId}/${instanceId}`,
  });

const searchObjects = async (portalId, objectTypeId, filePath) =>
  http.post(portalId, {
    uri: `${CUSTOM_OBJECTS_API_PATH}/${objectTypeId}/search`,
    body: JSON.parse(fs.readFileSync(filePath, 'utf-8')),
  });

const batchCreateObjects = (portalId, objectTypeId, filePath) =>
  http.post(portalId, {
    uri: `${CUSTOM_OBJECTS_API_PATH}/${objectTypeId}/batch/create`,
    body: JSON.parse(fs.readFileSync(filePath, 'utf-8')),
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
