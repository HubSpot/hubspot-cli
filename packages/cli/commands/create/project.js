const path = require('path');
const {
  createProjectConfig,
  createProjectTemplateFiles,
} = require('@hubspot/cli-lib/projects');
const { logger } = require('@hubspot/cli-lib/logger');
const { createProjectPrompt } = require('../../lib/prompts/projects');

module.exports = {
  hidden: true,
  dest: ({ name, dest }) => path.join(dest || './', name),
  execute: async ({ dest, name }) => {
    const { label, description, template } = await createProjectPrompt({
      label: name,
    });

    createProjectConfig(dest, {
      label,
      description,
    });
    createProjectTemplateFiles(dest, template);

    logger.success(`Project created in ${dest}`);
  },
};
