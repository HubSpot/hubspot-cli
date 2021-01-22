const inquirer = require('inquirer');

const getSampleTypesPrompt = choices => ({
  type: 'rawlist',
  name: 'sampleType',
  message: 'Please, select API sample app',
  choices: choices.map(choice => ({
    name: `${choice.name} - ${choice.description}`,
    value: choice.id,
  })),
  validate: input => {
    return new Promise(function(resolve, reject) {
      if (input.length > 0) {
        resolve(true);
      }
      reject('Please select API sample app');
    });
  },
});

const getLanguagesPrompt = choices => ({
  type: 'rawlist',
  name: 'sampleLanguage',
  message: "Please, select sample app's language",
  choices: choices.map(choice => ({
    name: choice,
    value: choice,
  })),
  validate: input => {
    return new Promise(function(resolve, reject) {
      if (input.length > 0) {
        resolve(true);
      }
      reject("Please select API sample app's language");
    });
  },
});

const createApiSamplePrompt = async samplesConfig => {
  try {
    const { samples } = samplesConfig;
    const sampleTypeAnswer = await inquirer.prompt(
      getSampleTypesPrompt(samples)
    );
    const chosenSample = samples.find(
      sample => sample.id === sampleTypeAnswer.sampleType
    );
    const { languages } = chosenSample;
    const languagesAnswer = await inquirer.prompt(
      getLanguagesPrompt(languages)
    );
    return {
      ...sampleTypeAnswer,
      ...languagesAnswer,
    };
  } catch (e) {
    return {};
  }
};

const overwriteSamplePrompt = folderName => {
  return inquirer.prompt({
    type: 'confirm',
    name: 'overwrite',
    message: `The folder with name '${folderName}' already exists. Overwrite?`,
    default: false,
  });
};

module.exports = {
  createApiSamplePrompt,
  overwriteSamplePrompt,
};
