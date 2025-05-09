import util from 'util';
import path from 'path';
import fs from 'fs-extra';
import yaml from 'js-yaml';
import { logger } from '@hubspot/local-dev-lib/logger';
import { interpolate } from './interpolation';

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

    logger.debug(
      'Loaded language data: ',
      util.inspect(languageObj, true, 999, true)
    );
  } catch (e) {
    logger.error('Error loading language data: ', e);
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
    logger.debug(
      `Unable to access language property: ${lookupProps.join(
        '.'
      )}. Failed to access prop "${previouslyCheckedProp}".`
    );
    logger.error('Unable to access language property.');
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
  options: { [identifier: string]: unknown } = {}
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
