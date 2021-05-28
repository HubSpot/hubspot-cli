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

const mockGetAnnotationValue = (templateType, rest) => {
  templates.getAnnotationValue.mockImplementation((x, key) => {
    if (key === 'templateType') {
      return templateType;
    }
    return rest;
  });
};

const findError = (errors, errorKey) =>
  errors.find(error => error.key === `template.${errorKey}`);

describe('validators/marketplaceValidators/theme/TemplateValidator', () => {
  beforeEach(() => {
    templates.isCodedFile.mockReturnValue(true);
  });

  it('returns error if template limit is exceeded', async () => {
    mockGetAnnotationValue('page');

    const validationErrors = TemplateValidator.validate(
      'dirName',
      makeFilesList(TEMPLATE_LIMIT + 1)
    );
    const limitError = findError(validationErrors, 'limitExceeded');
    expect(limitError).toBeDefined();
    expect(validationErrors[0].result).toBe(VALIDATION_RESULT.FATAL);
  });

  it('returns no errors if template limit is not exceeded', async () => {
    mockGetAnnotationValue('page');

    const validationErrors = TemplateValidator.validate(
      'dirName',
      makeFilesList(TEMPLATE_LIMIT)
    );
    const limitError = findError(validationErrors, 'limitExceeded');
    expect(limitError).not.toBeDefined();
  });

  it('returns error if template annotation is missing label and screenshotPath', async () => {
    fs.readFileSync.mockReturnValue('mock');
    mockGetAnnotationValue('page');

    const validationErrors = TemplateValidator.validate('dirName', [
      'template.html',
    ]);
    expect(validationErrors.length).toBe(2);
    expect(validationErrors[0].result).toBe(VALIDATION_RESULT.FATAL);
  });

  it('returns error if template type is not allowed', async () => {
    fs.readFileSync.mockReturnValue('mock');
    mockGetAnnotationValue('starter_landing_pages', 'value');

    const validationErrors = TemplateValidator.validate('dirName', [
      'template.html',
    ]);

    expect(validationErrors.length).toBe(1);
  });

  it('returns no error if templateType is not found', async () => {
    fs.readFileSync.mockReturnValue('mock');
    mockGetAnnotationValue(null, 'value');

    const validationErrors = TemplateValidator.validate('dirName', [
      'template.html',
    ]);

    expect(validationErrors.length).toBe(0);
  });

  it('returns no error if template annotation has label and screenshotPath', async () => {
    fs.readFileSync.mockReturnValue('mock');
    mockGetAnnotationValue('page', 'value');

    const validationErrors = TemplateValidator.validate('dirName', [
      'template.html',
    ]);

    expect(validationErrors.length).toBe(0);
  });
});
