const { promptUser } = require('./promptUtils');
const { i18n } = require('../lang');

const i18nKey = 'cli.lib.prompts.createApiSamplePrompt';

const getSampleTypesPrompt = choices => ({
  type: 'rawlist',
  name: 'sampleType',
  message: i18n(`${i18nKey}.selectApiSampleApp`),
  choices: choices.map(choice => ({
    name: `${choice.name} - ${choice.description}`,
    value: choice.id,
  })),
  validate: input => {
    return new Promise(function(resolve, reject) {
      if (input.length > 0) {
        resolve(true);
      }
      reject(i18n(`${i18nKey}.errors.apiSampleAppRequired`));
    });
  },
});

const getLanguagesPrompt = choices => ({
  type: 'rawlist',
  name: 'sampleLanguage',
  message: i18n(`${i18nKey}.selectLanguage`),
  choices: choices.map(choice => ({
    name: choice,
    value: choice,
  })),
  validate: input => {
    return new Promise(function(resolve, reject) {
      if (input.length > 0) {
        resolve(true);
      }
      reject(i18n(`${i18nKey}.errors.languageRequired`));
    });
  },
});

const createApiSamplePrompt = async samplesConfig => {
  try {
    const { samples } = samplesConfig;
    const sampleTypeAnswer = await promptUser(getSampleTypesPrompt(samples));
    const chosenSample = samples.find(
      sample => sample.id === sampleTypeAnswer.sampleType
    );
    const { languages } = chosenSample;
    const languagesAnswer = await promptUser(getLanguagesPrompt(languages));
    return {
      ...sampleTypeAnswer,
      ...languagesAnswer,
    };
  } catch (e) {
    return {};
  }
};

module.exports = {
  createApiSamplePrompt,
};
