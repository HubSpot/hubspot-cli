const fs = require('fs');
const templates = require('@hubspot/cli-lib/templates');

const TemplateValidator = require('../marketplaceValidators/theme/TemplateValidator');
const { VALIDATION_RESULT } = require('../constants');

jest.mock('fs');
jest.mock('@hubspot/cli-lib/templates');

const TEMPLATE_LIMIT = 50;

const makeFilesList = numFiles => {
  const files = [];
  for (let i = 0; i < numFiles; i++) {
    files.push(`file-${i}.html`);
  }
  return files;
};

const findError = (errors, errorKey) =>
  errors.find(error => error.key === `template.${errorKey}`);

describe('validators/marketplaceValidators/theme/TemplateValidator', () => {
  beforeEach(() => {
    templates.isTemplate.mockReturnValue(true);
  });

  it('returns error if template limit is exceeded', async () => {
    const validationErrors = TemplateValidator.validate(
      'dirName',
      makeFilesList(TEMPLATE_LIMIT + 1)
    );
    const limitError = findError(validationErrors, 'limitExceeded');
    expect(limitError).toBeDefined();
    expect(validationErrors[0].result).toBe(VALIDATION_RESULT.FATAL);
  });

  it('returns no errors if template limit is not exceeded', async () => {
    const validationErrors = TemplateValidator.validate(
      'dirName',
      makeFilesList(TEMPLATE_LIMIT)
    );
    const limitError = findError(validationErrors, 'limitExceeded');
    expect(limitError).not.toBeDefined();
  });

  it('returns error if template annotation is missing label and screenshotPath', async () => {
    fs.readFileSync.mockReturnValue('mock');
    templates.getAnnotationValue.mockReturnValue(null);

    const validationErrors = TemplateValidator.validate('dirName', [
      'template.html',
    ]);
    expect(validationErrors.length).toBe(2);
    expect(validationErrors[0].result).toBe(VALIDATION_RESULT.FATAL);
  });

  it('returns no error if template annotation has label and screenshotPath', async () => {
    fs.readFileSync.mockReturnValue('mock');
    templates.getAnnotationValue.mockReturnValue('some-value');

    const validationErrors = TemplateValidator.validate('dirName', [
      'template.html',
    ]);
    expect(validationErrors.length).toBe(0);
  });
});
