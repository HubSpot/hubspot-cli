const inquirer = require('inquirer');
const open = require('open');
const { getHubSpotWebsiteOrigin } = require('@hubspot/cms-lib/lib/urls');

const promptUser = async promptConfig => {
  const prompt = inquirer.createPromptModule();
  return prompt(promptConfig);
};

/**
 * Displays notification to user that we are about to open the browser,
 * then opens their browser to the personal-access-key shortlink
 */
const personalAccessKeyPrompt = async ({ env } = {}) => {
  await promptUser([PERSONAL_ACCESS_KEY_BROWSER_OPEN_PREP]);
  const websiteOrigin = getHubSpotWebsiteOrigin(env);
  open(`${websiteOrigin}/l/personal-access-key`, { url: true });
  const { personalAccessKey } = await promptUser(PERSONAL_ACCESS_KEY);

  return {
    personalAccessKey,
    env,
  };
};

const PERSONAL_ACCESS_KEY_BROWSER_OPEN_PREP = {
  name: 'personalAcessKeyBrowserOpenPrep',
  message:
    "When you're ready, we'll open a secure page in your default browser where you can view and copy your personal CMS access key, which you'll need to complete the next step.\n<Press enter when you are ready to continue>",
};

const PERSONAL_ACCESS_KEY = {
  name: 'personalAccessKey',
  message: 'Enter your personal CMS access key:',
  validate(val) {
    if (typeof val !== 'string') {
      return 'You did not enter a valid access key. Please try again.';
    } else if (val[0] === '•') {
      return 'Please copy the actual access key rather than the bullets that mask it.';
    }
    return true;
  },
};

module.exports = {
  promptUser,
  personalAccessKeyPrompt,
  PERSONAL_ACCESS_KEY,
};
