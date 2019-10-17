const validateProjectName = require('validate-npm-package-name');
const chalk = require('chalk');

/**
 *
 * @param {Array} results
 * @returns {Undefined}
 */
function printValidationResults(results) {
  if (results == null) return;
  results.forEach(error => {
    console.error(chalk.red(`  *  ${error}`));
  });
}

/**
 *
 * @param {String} name
 * @returns {Undefined}
 */
function checkProjectName(name) {
  const validationResult = validateProjectName(name);
  if (validationResult.validForNewPackages) return;
  console.error(
    `Could not create a project called ${chalk.red(
      `"${name}"`
    )} because of npm naming restrictions:`
  );
  printValidationResults(validationResult.errors);
  printValidationResults(validationResult.warnings);
  process.exit(1);
}

exports = module.exports = checkProjectName;
exports.printValidationResults = printValidationResults;
