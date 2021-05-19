const ModuleCountValidator = require('../marketplaceValidators/theme/ModuleCountValidator');
const ValidatorStore = require('../ValidatorStore');
const { VALIDATION_RESULT } = require('../constants');

const makeFilesList = numFiles => {
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

describe('validators/marketplaceValidators/theme/ModuleCountValidator', () => {
  beforeEach(() => {
    ValidatorStore.clear();
  });

  it('returns error if module limit is exceeded', async () => {
    const validationErrors = ModuleCountValidator.validate(
      'dirName',
      makeFilesList(51)
    );
    expect(validationErrors.length).toBe(1);
    expect(validationErrors[0].result).toBe(VALIDATION_RESULT.FATAL);
  });

  it('returns no errors if module limit is not exceeded', async () => {
    const validationErrors = ModuleCountValidator.validate(
      'dirName',
      makeFilesList(50)
    );
    expect(validationErrors.length).toBe(0);
  });
});
