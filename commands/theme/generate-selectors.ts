import fs from 'fs';
import { Argv, ArgumentsCamelCase } from 'yargs';
import { commands } from '../../lang/en.js';
import {
  findFieldsJsonPath,
  combineThemeCss,
  setPreviewSelectors,
  generateInheritedSelectors,
  generateSelectorsMap,
  getMaxFieldsDepth,
} from '../../lib/generateSelectors.js';
import { EXIT_CODES } from '../../lib/enums/exitCodes.js';
import { CommonArgs, YargsCommandModule } from '../../types/Yargs.js';
import { makeYargsBuilder } from '../../lib/yargsUtils.js';
import { uiLogger } from '../../lib/ui/logger.js';

const HUBL_EXPRESSION_REGEX = new RegExp(/{%\s*(.*)\s*%}/, 'g');
const HUBL_VARIABLE_NAME_REGEX = new RegExp(/{%\s*set\s*(\w*)/, 'i');
const HUBL_STATEMENT_REGEX = new RegExp(/{{\s*[\w.(,\d\-\s)|/~]*.*}}/, 'g');
const HUBL_STATEMENT_PLACEHOLDER_REGEX = new RegExp(/hubl_statement_\d*/, 'g');

const CSS_VARS_REGEX = new RegExp(/--([\w.(,\d\-)]*):(.*);/, 'g');
const CSS_VARS_NAME_REGEX = new RegExp(/(--[\w.(,\d\-)]*)/, 'g');
const CSS_SELECTORS_REGEX = new RegExp(/([\s\w:.,\0-[\]]*){/, 'i');
const CSS_EXPRESSION_REGEX = new RegExp(/(?!\s)([^}])*(?![.#\s,>])[^}]*}/, 'g');
const THEME_PATH_REGEX = new RegExp(/=\s*.*(theme\.(\w|\.)*)/, 'i');

const command = 'generate-selectors <path>';
const describe = commands.theme.subcommands.generateSelectors.describe;

type ThemeSelectorArgs = CommonArgs & { path: string };

async function handler(
  args: ArgumentsCamelCase<ThemeSelectorArgs>
): Promise<void> {
  const { path } = args;

  const fieldsJsonPath = findFieldsJsonPath(path);
  if (!fieldsJsonPath) {
    uiLogger.error(
      commands.theme.subcommands.generateSelectors.errors.fieldsNotFound
    );
    process.exit(EXIT_CODES.ERROR);
  }

  let fieldsJson = JSON.parse(fs.readFileSync(fieldsJsonPath, 'utf-8'));
  let cssString = combineThemeCss(path) ?? '';

  /**
   * Creates map of HubL variable names to theme field paths
   */
  const HubLExpressions = cssString.match(HUBL_EXPRESSION_REGEX);
  const hublVariableMap = HubLExpressions
    ? HubLExpressions.reduce(
        (_hublVariableMap: { [key: string]: string }, expression) => {
          const variableName = expression.match(HUBL_VARIABLE_NAME_REGEX);
          const themeFieldKey = expression.match(THEME_PATH_REGEX);

          if (!themeFieldKey || !variableName) return _hublVariableMap;

          _hublVariableMap[variableName[1]] = themeFieldKey[1];
          return _hublVariableMap;
        },
        {}
      )
    : {};

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
  const hublStatementsMap: { [key: string]: string } = {};
  hublStatements.forEach((statement, index) => {
    const statementKey = `hubl_statement_${index}`;
    hublStatementsMap[statementKey] = statement;
    cssString = cssString.replace(statement, statementKey);
  });

  /**
   * Matchs all css variables and determines if there are hubl within those vars.
   */
  const cssVars = cssString.match(CSS_VARS_REGEX) || [];
  const cssVarsMap: { [key: string]: string[] } = cssVars.reduce(
    (acc, expression) => {
      const cssVarName = expression.match(CSS_VARS_NAME_REGEX);
      const hublVariables = expression.match(HUBL_STATEMENT_PLACEHOLDER_REGEX);

      if (!cssVarName || !hublVariables) return acc;

      cssString = cssString.replace(expression, '');
      return { ...acc, [cssVarName[0]]: hublVariables };
    },
    {}
  );

  // replace all css variable references with corresponding hubl placeholder
  Object.keys(cssVarsMap).forEach(cssVarName => {
    const hublPlaceholders = cssVarsMap[cssVarName];
    cssString = cssString.replace(cssVarName, hublPlaceholders.join('  '));
  });

  /**
   * Parses each css string for a HubL statement and tries to map theme field paths to CSS selectors
   */
  const cssExpressions = (cssString.match(CSS_EXPRESSION_REGEX) || []).map(
    exp => exp.replace(/\r?\n/g, ' ')
  );

  const finalMap = cssExpressions.reduce(
    (themeFieldsSelectorMap: { [key: string]: string[] }, cssExpression) => {
      const hublStatementsPlaceholderKey =
        cssExpression.match(HUBL_STATEMENT_PLACEHOLDER_REGEX) || [];

      hublStatementsPlaceholderKey.forEach(placeholderKey => {
        let hublStatement;
        let themeFieldPath;
        if (placeholderKey in hublStatementsMap) {
          hublStatement =
            hublStatementsMap[placeholderKey].match(HUBL_EXPRESSIONS);

          themeFieldPath =
            hublStatementsMap[placeholderKey].match(/theme\.[\w|.]*/);
        }
        const cssSelectors = cssExpression.match(CSS_SELECTORS_REGEX);

        /**
         * Try to match a HubL statement to any HubL Variables being used
         */
        if (cssSelectors && themeFieldPath) {
          const cssSelector = cssSelectors[1].replace(/\n/g, ' ');
          const hublThemePath = themeFieldPath?.[0] ?? '';

          if (!themeFieldsSelectorMap[hublThemePath]) {
            themeFieldsSelectorMap[hublThemePath] = [];
          }

          if (!themeFieldsSelectorMap[hublThemePath].includes(cssSelector)) {
            themeFieldsSelectorMap[hublThemePath] =
              themeFieldsSelectorMap[hublThemePath].concat(cssSelector);
          }
        }

        if (cssSelectors && hublStatement) {
          const cssSelector = cssSelectors?.[1]?.replace(/\n/g, ' ') ?? '';
          const hublVariableName =
            Object.keys(hublVariableMap).find(_hubl => {
              return hublStatement && hublStatement[0].includes(_hubl);
            }) || '';

          const themeFieldKey = hublVariableName
            ? hublVariableMap[hublVariableName]
            : undefined;

          /**
           * If the theme path is referenced directly add selectors
           */
          if (themeFieldKey) {
            if (!themeFieldsSelectorMap[themeFieldKey]) {
              themeFieldsSelectorMap[themeFieldKey] = [];
            }

            if (!themeFieldsSelectorMap[themeFieldKey].includes(cssSelector)) {
              themeFieldsSelectorMap[themeFieldKey] =
                themeFieldsSelectorMap[themeFieldKey].concat(cssSelector);
            }
          }
        }
      });

      return themeFieldsSelectorMap;
    },
    {}
  );

  if (!Object.keys(finalMap).length) {
    uiLogger.error(
      commands.theme.subcommands.generateSelectors.errors.noSelectorsFound
    );
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
    fieldsJson = generateInheritedSelectors(fieldsJson);
  }

  const selectorsMap = generateSelectorsMap(fieldsJson);
  const selectorsPath = `${path}/editor-preview.json`;

  fs.writeFileSync(
    selectorsPath,
    `${JSON.stringify({ selectors: selectorsMap }, null, 2)}\n`
  );

  uiLogger.success(
    commands.theme.subcommands.generateSelectors.success(path, selectorsPath)
  );
}

function themeSelectorBuilder(yargs: Argv): Argv<ThemeSelectorArgs> {
  yargs.positional('path', {
    describe: commands.theme.subcommands.generateSelectors.positionals.path,
    type: 'string',
    required: true,
  });

  return yargs as Argv<ThemeSelectorArgs>;
}

const builder = makeYargsBuilder<ThemeSelectorArgs>(
  themeSelectorBuilder,
  command,
  describe,
  {
    useGlobalOptions: true,
  }
);

const themeSelectorsCommand: YargsCommandModule<unknown, ThemeSelectorArgs> = {
  command,
  describe,
  handler,
  builder,
};

export default themeSelectorsCommand;
