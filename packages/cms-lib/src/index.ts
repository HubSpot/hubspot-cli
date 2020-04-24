import { ALLOWED_EXTENSIONS, Mode, DEFAULT_MODE } from './lib/constants';
import {
  checkAndWarnGitInclusion,
  getAndLoadConfigIfNeeded,
  getConfig,
  getPortalId,
  getPortalConfig,
  loadConfig,
  loadConfigFromEnvironment,
  updatePortalConfig,
  validateConfig,
} from './lib/config';
import { uploadFolder } from './lib/uploadFolder';
import { watch } from './lib/watch';
import { walk } from './lib/walk';

module.exports = {
  ALLOWED_EXTENSIONS,
  DEFAULT_MODE,
  Mode,
  checkAndWarnGitInclusion,
  getAndLoadConfigIfNeeded,
  getConfig,
  loadConfig,
  loadConfigFromEnvironment,
  getPortalConfig,
  getPortalId,
  updatePortalConfig,
  uploadFolder,
  validateConfig,
  watch,
  walk,
};
