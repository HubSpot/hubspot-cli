const readline = require('readline');
const chalk = require('chalk');
const { i18n } = require('../lang');

const i18nKey = 'lib.prompts.localDevUploadPrompt';

// This prompt needs to be cancelable, which is not supported by our current version
// of inquirer. To enable this, we build a prompt from scratch using readline
const makeUploadPrompt = message => {
  return () => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    const formattedMessage = `${chalk.green('?')} ${chalk.bold(
      message
    )} ${chalk.dim('(Y/n)')} `;

    let promiseResolve;

    const promptPromise = new Promise(resolve => {
      promiseResolve = resolve;
      rl.question(formattedMessage, answer => {
        if (answer === 'y' || answer === 'Y') {
          resolve(true);
        } else {
          resolve(false);
        }
        rl.close();
      });
    });

    const cancel = () => {
      rl.close();
      process.stdout.moveCursor(0, -1);
      process.stdout.clearLine(1);
      promiseResolve(false);
    };

    return { promptPromise, cancel };
  };
};

const publicAppUploadPrompt = makeUploadPrompt(i18n(`${i18nKey}.publicApp`));
const privateAppUploadPrompt = makeUploadPrompt(i18n(`${i18nKey}.privateApp`));

module.exports = {
  privateAppUploadPrompt,
  publicAppUploadPrompt,
};