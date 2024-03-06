const HUBSPOT_PROJECT_COMPONENTS_GITHUB_PATH =
  'HubSpot/hubspot-project-components';
const DEFAULT_PROJECT_TEMPLATE_BRANCH = 'main';

const FEEDBACK_OPTIONS = {
  BUG: 'bug',
  GENERAL: 'general',
};
const FEEDBACK_URLS = {
  BUG: 'https://github.com/HubSpot/hubspot-cli/issues/new',
  GENERAL:
    'https://docs.google.com/forms/d/e/1FAIpQLSejZZewYzuH3oKBU01tseX-cSWOUsTHLTr-YsiMGpzwcvgIMg/viewform?usp=sf_link',
};
const FEEDBACK_INTERVAL = 10;

const HUBSPOT_FOLDER = '@hubspot';
const MARKETPLACE_FOLDER = '@marketplace';

const CONFIG_FLAGS = {
  USE_CUSTOM_OBJECT_HUBFILE: 'useCustomObjectHubfile',
};

const POLLING_DELAY = 2000;

module.exports = {
  HUBSPOT_PROJECT_COMPONENTS_GITHUB_PATH,
  DEFAULT_PROJECT_TEMPLATE_BRANCH,
  FEEDBACK_OPTIONS,
  FEEDBACK_URLS,
  FEEDBACK_INTERVAL,
  HUBSPOT_FOLDER,
  MARKETPLACE_FOLDER,
  CONFIG_FLAGS,
  POLLING_DELAY,
};
