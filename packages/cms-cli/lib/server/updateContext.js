const path = require('path');
const fs = require('fs-extra');
const { logger } = require('@hubspot/cms-lib/logger');
const {
  logErrorInstance,
  ApiErrorContext,
} = require('@hubspot/cms-lib/errorHandlers');
const { fetchContent } = require('@hubspot/cms-lib/api/content');
const { fetchBlogs } = require('@hubspot/cms-lib/api/blogs');
const { fetchMenus } = require('@hubspot/cms-lib/api/designManager');

async function writeObjects(portalId, contextPath, objectType, objects) {
  const dest = path.join(contextPath, objectType, portalId.toString());
  logger.debug('Writing %s data to %s', objectType, dest);
  fs.mkdirpSync(dest);
  return Promise.all(
    objects.map(async object => {
      const filepath = path.join(dest, `${object.id}.json`);
      return fs.writeJson(filepath, object);
    })
  );
}

async function fetchAll(portalId, apiHelper, params) {
  let objects = [];
  let count = 0;
  let totalObjects = null;
  let offset = 0;

  while (totalObjects === null || count < totalObjects) {
    const response = await apiHelper(portalId, { ...params, offset });
    if (totalObjects === null) {
      totalObjects = response.total;
    }

    logger.debug(`Fetched ${response.objects.length} objects`);
    count += response.objects.length;
    offset += response.objects.length;
    objects = objects.concat(response.objects);
  }
  return Promise.resolve(objects);
}

function copyDefaultContext(contextPath) {
  const defaultContextPath = path.resolve(__dirname, '../../defaults/context');
  const files = fs.readdirSync(defaultContextPath);
  files.forEach(file => {
    if (path.extname(file) !== '.json') {
      return;
    }
    const destPath = path.join(contextPath, file);
    if (!fs.existsSync(destPath)) {
      logger.debug(`Copying context file "${file}" to "${destPath}"`);
      fs.copySync(path.resolve(defaultContextPath, file), destPath);
    }
  });
}

async function updateServerContext(portalId, contextPath) {
  copyDefaultContext(contextPath);

  try {
    const blogs = await fetchAll(portalId, fetchBlogs, { casing: 'snake_r' });
    await writeObjects(portalId, contextPath, 'blogs', blogs);
  } catch (e) {
    logErrorInstance(
      e,
      new ApiErrorContext({
        portalId,
      })
    );
  }
  try {
    const contentObjects = await fetchAll(portalId, fetchContent, {
      casing: 'snake_r',
    });
    await writeObjects(portalId, contextPath, 'content', contentObjects);
  } catch (e) {
    logErrorInstance(
      e,
      new ApiErrorContext({
        portalId,
      })
    );
  }
  try {
    const menus = await fetchAll(portalId, fetchMenus, {
      casing: 'snake_r',
    });
    await writeObjects(portalId, contextPath, 'menus', menus);
  } catch (e) {
    logErrorInstance(
      e,
      new ApiErrorContext({
        portalId,
      })
    );
  }

  return Promise.resolve();
}

module.exports = {
  updateServerContext,
};
