const fs = require('fs');
const { i18n } = require('../../lib/lang');
const { logger } = require('@hubspot/cli-lib/logger');
const {
  findFieldsJsonPath,
  combineThemeCss,
  setPreviewSelectors,
  generateInheritedSelectors,
  generateSelectorsMap,
  getMaxFieldsDepth,
} = require('../../lib/generate-selectors');
const { EXIT_CODES } = require('../../lib/enums/exitCodes');

const HUBL_EXPRESSION_REGEX = new RegExp(/{%\s*(.*)\s*%}/, 'g');
const HUBL_VARIABLE_NAME_REGEX = new RegExp(/{%\s*set\s*(\w*)/, 'i');
const HUBL_STATEMENT_REGEX = new RegExp(/{{\s*[\w.(,\d\-\s)|/~]*.*}}/, 'g');
const HUBL_STATEMENT_PLACEHOLDER_REGEX = new RegExp(/hubl_statement_\d*/, 'g');

const CSS_VARS_REGEX = new RegExp(/--([\w.(,\d\-)]*):(.*);/, 'g');
const CSS_VARS_NAME_REGEX = new RegExp(/(--[\w.(,\d\-)]*)/, 'g');
const CSS_SELECTORS_REGEX = new RegExp(/([\s\w:.,\0-[\]]*){/, 'i');
const CSS_EXPRESSION_REGEX = new RegExp(/(?!\s)([^}])*(?![.#\s,>])[^}]*}/, 'g');
const THEME_PATH_REGEX = new RegExp(/=\s*.*(theme\.(\w|\.)*)/, 'i');

const i18nKey = 'cli.commands.theme.subcommands.generateSelectors';

exports.command = 'generate-selectors <themePath>';
exports.describe = i18n(`${i18nKey}.describe`);

exports.handler = options => {
  const { themePath } = options;

  const fieldsJsonPath = findFieldsJsonPath(themePath);
  if (!fieldsJsonPath) {
    logger.error(i18n(`${i18nKey}.errors.fieldsNotFound`));
    process.exit(EXIT_CODES.ERROR);
  }

  let fieldsJson = JSON.parse(fs.readFileSync(fieldsJsonPath));
  let cssString = combineThemeCss(themePath);

  /**
   * Creates map of HubL variable names to theme field paths
   */
  const HubLExpressions = cssString.match(HUBL_EXPRESSION_REGEX) || [];
  const hublVariableMap = HubLExpressions.reduce(
    (_hublVariableMap, expression) => {
      const variableName = expression.match(HUBL_VARIABLE_NAME_REGEX);
      const themeFieldKey = expression.match(THEME_PATH_REGEX);

      if (!themeFieldKey || !variableName) return _hublVariableMap;

      _hublVariableMap[variableName[1]] = themeFieldKey[1];
      return _hublVariableMap;
    },
    {}
  );

  /**
   * Removes HubL variable expressions
   */
  cssString = cssString.replace(HUBL_EXPRESSION_REGEX, '');

  /**
   * Regex for HubL variable names
   */
  const HUBL_EXPRESSIONS = new RegExp(
    `.*(${Object.keys(hublVariableMap).join('|')}).*`,
    'g'
  );

  /**
   * Matches all HubL statements in the CSS and replaces them with a placeholder string
   * This is to prevent the the css expression regex from capturing all the HubL as well
   */
  const hublStatements = cssString.match(HUBL_STATEMENT_REGEX) || [];
  const hublStatementsMap = {};
  hublStatements.forEach((statement, index) => {
    const statementKey = `hubl_statement_${index}`;
    hublStatementsMap[statementKey] = statement;
    cssString = cssString.replace(statement, statementKey);
  });

  /**
   * Matchs all css variables and determines if there are hubl within those vars.
   */
  const cssVars = cssString.match(CSS_VARS_REGEX) || [];
  const cssVarsMap = cssVars.reduce((acc, expression) => {
    const cssVarName = expression.match(CSS_VARS_NAME_REGEX);
    const hublVariables = expression.match(HUBL_STATEMENT_PLACEHOLDER_REGEX);

    if (!cssVarName || !hublVariables) return acc;

    cssString = cssString.replace(expression, '');
    return { ...acc, [cssVarName[0]]: hublVariables };
  }, {});

  // replace all css variable references with corresponding hubl placeholder
  Object.keys(cssVarsMap).forEach(cssVarName => {
    const hublPlaceholders = cssVarsMap[cssVarName];
    cssString = cssString.replace(cssVarName, hublPlaceholders.join('  '));
  });

  /**
   * Parses each css string for a HubL statement and tries to map theme field paths to CSS selectors
   */
  const cssExpressions = (
    cssString.match(CSS_EXPRESSION_REGEX) || []
  ).map(exp => exp.replace(/\r?\n/g, ' '));

  const finalMap = cssExpressions.reduce(
    (themeFieldsSelectorMap, cssExpression) => {
      const hublStatementsPlaceholderKey =
        cssExpression.match(HUBL_STATEMENT_PLACEHOLDER_REGEX) || [];

      hublStatementsPlaceholderKey.forEach(placeholderKey => {
        const hublStatement = hublStatementsMap[placeholderKey].match(
          HUBL_EXPRESSIONS
        );
        const themeFieldPath = hublStatementsMap[placeholderKey].match(
          /theme\.[\w|.]*/,
          'g'
        );
        const cssSelectors = cssExpression.match(CSS_SELECTORS_REGEX);

        /**
         * Try to match a HubL statement to any HubL Variables being used
         */
        if (cssSelectors && themeFieldPath) {
          const cssSelector = cssSelectors[1].replace(/\n/g, ' ');
          const hublThemePath = themeFieldPath[0];

          if (!themeFieldsSelectorMap[hublThemePath]) {
            themeFieldsSelectorMap[hublThemePath] = [];
          }

          if (!themeFieldsSelectorMap[hublThemePath].includes(cssSelector)) {
            themeFieldsSelectorMap[hublThemePath] = themeFieldsSelectorMap[
              hublThemePath
            ].concat(cssSelector);
          }
        }

        if (cssSelectors && hublStatement) {
          const cssSelector = cssSelectors[1].replace(/\n/g, ' ');
          const hublVariableName = Object.keys(hublVariableMap).find(_hubl => {
            return hublStatement[0].includes(_hubl);
          });

          const themeFieldKey = hublVariableMap[hublVariableName];

          /**
           * If the theme path is referenced directly add selectors
           */
          if (themeFieldKey) {
            if (!themeFieldsSelectorMap[themeFieldKey]) {
              themeFieldsSelectorMap[themeFieldKey] = [];
            }

            if (!themeFieldsSelectorMap[themeFieldKey].includes(cssSelector)) {
              themeFieldsSelectorMap[themeFieldKey] = themeFieldsSelectorMap[
                themeFieldKey
              ].concat(cssSelector);
            }
          }
        }
      });

      return themeFieldsSelectorMap;
    },
    {}
  );

  if (!Object.keys(finalMap).length) {
    logger.error(i18n(`${i18nKey}.errors.noSelectorsFound`));
    process.exit(EXIT_CODES.ERROR);
  }
  Object.keys(finalMap).forEach(themeFieldKey => {
    const fieldKey = themeFieldKey.split('.');
    const selectors = finalMap[themeFieldKey];
    fieldsJson = setPreviewSelectors(fieldsJson, fieldKey.splice(1), selectors);
  });

  // Because fields can have nested inheritance we generated inherited selectors
  // multiple times to make sure all inherted selectors are bubbled up.
  const maxFieldsDepth = getMaxFieldsDepth();
  for (let i = 0; i < maxFieldsDepth; i += 1) {
    fieldsJson = generateInheritedSelectors(fieldsJson, fieldsJson);
  }

  const selectorsMap = generateSelectorsMap(fieldsJson);
  const selectorsPath = `${themePath}/editor-preview.json`;

  fs.writeFileSync(
    selectorsPath,
    `${JSON.stringify({ selectors: selectorsMap }, null, 2)}\n`
  );

  logger.success(
    i18n(`${i18nKey}.success`, {
      themePath,
      selectorsPath,
    })
  );
};

exports.builder = yargs => {
  yargs.positional('themePath', {
    describe: i18n(`${i18nKey}.positionals.themePath.describe`),
    type: 'string',
  });

  return yargs;
};
