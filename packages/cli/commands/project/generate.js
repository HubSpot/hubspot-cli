const {loadAndValidateOptions} = require('../../lib/validation');
const {i18n} = require('@hubspot/cli-lib/lib/lang');
const {generateProjectPrompt} = require('../../lib/prompts/generateProjectPrompt');

const i18nKey = 'cli.commands.project.subcommands.generate';

const choices = [{name: 'basic App', value: 'url1'}, {name: 'basic App 2', value: 'url2'}];

exports.command = 'generate';
exports.describe = i18n(`${i18nKey}.describe`);

exports.handler = async options => {
    await loadAndValidateOptions(options);

    console.log(options);

    if (!options.url) {
        //fetch choices from github
        const {component} = await generateProjectPrompt(choices);
        console.log(component);
    }

    //call github n get stuff, library routine, return back temp location of the component file we stored
    //call another lib routine see generator json, return the answers back to me
    //in rhis location, we run thru prompt again to answer all questions we see in the generator, in this file
    //temp parsing...
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
