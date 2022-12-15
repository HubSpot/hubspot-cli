const {loadAndValidateOptions} = require('../../lib/validation');
const {i18n} = require('@hubspot/cli-lib/lib/lang');
const {generateProjectPrompt} = require('../../lib/prompts/generateProjectPrompt');
const {getQuestionAnswers, copyAndParseDir} = require("../../lib/boilerplateGenerator");
const {generateQuestionPrompt} = require("../../lib/prompts/generateQuestionPrompt");

const i18nKey = 'cli.commands.project.subcommands.generate';

const choices = [{name: 'basic App', value: 'url1'}, {name: 'basic App 2', value: 'url2'}];

exports.command = 'generate';
exports.describe = i18n(`${i18nKey}.describe`);

exports.handler = async options => {
    await loadAndValidateOptions(options);

    console.log(options);

    if (!options.url) {
        const {component} = await generateProjectPrompt(choices);
        console.log(component);
    }

    const tempComponentLocation = ""; //call github n get stuff, library routine, return back temp location of the component file we stored
    const generatorObject = { questions: [], componentRoot: "" }  // Get the generate.json and return it as js object
    const answers = generateQuestionPrompt(generatorObject.questions);
    copyAndParseDir(tempComponentLocation, ".", generatorObject.componentRoot, answers);
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
