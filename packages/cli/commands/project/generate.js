const {loadAndValidateOptions} = require('../../lib/validation');
const {i18n} = require('@hubspot/cli-lib/lib/lang');
const {generateProjectPrompt} = require('../../lib/prompts/generateProjectPrompt');
const {copyAndParseDir, readGeneratorFile, downloadGithubRepo, cleanUpTempDir} = require("../../lib/boilerplateGenerator");
const {generateQuestionPrompt} = require("../../lib/prompts/generateQuestionPrompt");

const i18nKey = 'cli.commands.project.subcommands.generate';

const choices = [
    {name: 'Basic App', value: 'https://github.com/camden11/hs-generate-templates/tree/main/basic-app'},
    {name: 'App With Form', value: 'https://github.com/camden11/hs-generate-templates/tree/main/app-with-form'}
];

exports.command = 'generate';
exports.describe = i18n(`${i18nKey}.describe`);

exports.handler = async options => {
    await loadAndValidateOptions(options);

    let url;
    if (!options.url) {
        const {component} = await generateProjectPrompt(choices);
        url = component;
    } else {
        url = options.url;
    }

    const tempComponentLocation = await downloadGithubRepo(url);
    const generatorObject = readGeneratorFile(tempComponentLocation); // TODO need file validation
    const answers = await generateQuestionPrompt(generatorObject.questions);
    console.log(tempComponentLocation)
    copyAndParseDir(tempComponentLocation, "../test-component-boilerplate", generatorObject.componentRoot, answers);
    cleanUpTempDir(tempComponentLocation);
}

exports.builder = yargs => {
    yargs.options({
        url: {
            describe: 'url for custom template',
            type: 'string',
        },
    });

    return yargs;
};
