const templateLimitValidator = require('../../validators/marketplaceValidators/templateLimitValidator');
const { VALIDATION_RESULT } = require('../../validators/constants');

const makeFilesList = (numFiles, ext = '.html') => {
  const files = [];
  for (let i = 0; i < numFiles; i++) {
    files.push(`file-${i}${ext}`);
  }
  return files;
};

describe('validators/templateLimitValidator', () => {
  it('returns error if template limit is exceeded', async () => {
    const validationErrors = templateLimitValidator.validate(
      'dirName',
      makeFilesList(51)
    );
    expect(validationErrors.length).toBe(1);
    expect(validationErrors[0].result).toBe(VALIDATION_RESULT.FATAL);
  });

  it('returns no errors if template limit is not exceeded', async () => {
    const validationErrors = templateLimitValidator.validate(
      'dirName',
      makeFilesList(49)
    );
    expect(validationErrors.length).toBe(0);
  });

  it('ignores all files without the .html extension', async () => {
    const validationErrors = templateLimitValidator.validate(
      'dirName',
      makeFilesList(51, '.js')
    );
    expect(validationErrors.length).toBe(0);
  });
});
