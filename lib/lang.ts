import util from 'util';
import path, { dirname } from 'path';
import fs from 'fs-extra';
import yaml from 'js-yaml';
import { uiLogger } from './ui/logger.js';
import { interpolate, InterpolationData } from './interpolation.js';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
export const MISSING_LANGUAGE_DATA_PREFIX = '[Missing language data]';

type LanguageObject = { [key: string]: string | LanguageObject };

let locale: string;
let languageObj: LanguageObject;

function loadLanguageFromYaml(): void {
  if (languageObj) return;

  try {
    const nodeLocale = Intl.DateTimeFormat()
      .resolvedOptions()
      .locale.split('-')[0];
    const languageFilePath = path.join(
      __dirname,
      `../lang/${nodeLocale}.lyaml`
    );
    const languageFileExists = fs.existsSync(languageFilePath);

    // Fall back to using the default language file
    locale = languageFileExists ? nodeLocale : 'en';
    languageObj = yaml.load(
      fs.readFileSync(path.join(__dirname, `../lang/${locale}.lyaml`), 'utf8')
    ) as LanguageObject;

    uiLogger.debug(
      'Loaded language data: ' + util.inspect(languageObj, true, 999, true)
    );
  } catch (e) {
    uiLogger.error(
      'Error loading language data: ' +
        (e instanceof Error ? e.message : String(e))
    );
  }
}

function getTextValue(lookupDotNotation: string): string {
  const lookupProps = [locale, ...lookupDotNotation.split('.')];
  const missingTextData = `${MISSING_LANGUAGE_DATA_PREFIX}: ${lookupProps.join(
    '.'
  )}`;
  let textValue: string | LanguageObject | undefined = languageObj;
  let previouslyCheckedProp = lookupProps[0];

  try {
    lookupProps.forEach(prop => {
      if (textValue && typeof textValue === 'object') {
        textValue = textValue[prop];
      }
      previouslyCheckedProp = prop;
    });
  } catch (e) {
    uiLogger.debug(
      `Unable to access language property: ${lookupProps.join(
        '.'
      )}. Failed to access prop "${previouslyCheckedProp}".`
    );
    uiLogger.error('Unable to access language property.');
    return missingTextData;
  }

  if (!textValue) {
    return missingTextData;
  }

  if (typeof textValue !== 'string') {
    return missingTextData;
  }

  return textValue;
}

export function i18n(
  lookupDotNotation: string,
  options: InterpolationData = {}
): string {
  if (!languageObj) {
    loadLanguageFromYaml();
  }

  if (typeof lookupDotNotation !== 'string') {
    throw new Error(
      `i18n must be passed a string value for lookupDotNotation, received ${typeof lookupDotNotation}`
    );
  }

  const textValue = getTextValue(lookupDotNotation);
  const shouldInterpolate = !textValue.startsWith(MISSING_LANGUAGE_DATA_PREFIX);

  return shouldInterpolate ? interpolate(textValue, options) : textValue;
}

export function setLangData(
  newLocale: string,
  newLangObj: LanguageObject
): void {
  locale = newLocale;
  languageObj = newLangObj;
}
