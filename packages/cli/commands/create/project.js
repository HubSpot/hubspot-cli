const path = require('path');
const { createProjectConfig } = require('@hubspot/cli-lib/projects');
const { createProjectPrompt } = require('../../lib/prompts/projects');

module.exports = {
  hidden: true,
  dest: ({ name, dest }) => path.join(dest || './', name),
  execute: async ({ dest, name }) => {
    const {
      name: projectName,
      description,
      // TODO - Use `template` value to generate any additional files
      // template,
    } = await createProjectPrompt({ name });

    createProjectConfig(dest, {
      label: projectName,
      description,
    });
  },
};
