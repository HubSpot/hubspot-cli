//HACK so we can keep this util file next to the tests that use it
test.skip('skip', () => null);

const THEME_PATH = '/path/to/a/theme';

const makeFindError = baseKey => (errors, errorKey) =>
  errors.find(error => error.key === `${baseKey}.${errorKey}`);

const generateModulesList = numFiles => {
  const files = [];
  for (let i = 0; i < numFiles; i++) {
    const base = `module-${i}.module`;
    files.push(`${base}/meta.json`);
    files.push(`${base}/fields.json`);
    files.push(`${base}/module.html`);
    files.push(`${base}/module.js`);
  }
  return files;
};

const generateTemplatesList = numFiles => {
  const files = [];
  for (let i = 0; i < numFiles; i++) {
    files.push(`template-${i}.html`);
  }
  return files;
};

module.exports = {
  generateModulesList,
  generateTemplatesList,
  makeFindError,
  THEME_PATH,
};
