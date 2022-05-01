const fs = require('fs');
const templates = require('@hubspot/cli-lib/templates');

const TemplateValidator = require('../marketplaceValidators/theme/TemplateValidator');
const { VALIDATION_RESULT } = require('../constants');
const {
  generateTemplatesList,
  makeFindError,
  THEME_PATH,
} = require('./validatorTestUtils');

jest.mock('fs');
jest.mock('@hubspot/cli-lib/templates');

const TEMPLATE_LIMIT = 50;

const mockGetAnnotationValue = (templateType, rest) => {
  templates.buildAnnotationValueGetter.mockImplementation(() => {
    return key => {
      if (key === 'templateType') {
        return templateType;
      }
      return rest;
    };
  });
};

const findError = makeFindError('template');

describe('validators/marketplaceValidators/theme/TemplateValidator', () => {
  beforeEach(() => {
    TemplateValidator.setAbsolutePath(THEME_PATH);
    templates.isCodedFile.mockReturnValue(true);
  });

  it('returns error if template limit is exceeded', async () => {
    mockGetAnnotationValue('page');

    const validationErrors = TemplateValidator.validate(
      generateTemplatesList(TEMPLATE_LIMIT + 1)
    );
    const limitError = findError(validationErrors, 'limitExceeded');
    expect(limitError).toBeDefined();
    expect(validationErrors[0].result).toBe(VALIDATION_RESULT.FATAL);
  });

  it('returns no errors if template limit is not exceeded', async () => {
    mockGetAnnotationValue('page');

    const validationErrors = TemplateValidator.validate(
      generateTemplatesList(TEMPLATE_LIMIT)
    );
    const limitError = findError(validationErrors, 'limitExceeded');
    expect(limitError).not.toBeDefined();
  });

  it('returns error if template annotation is missing label and screenshotPath', async () => {
    fs.readFileSync.mockReturnValue('mock');
    mockGetAnnotationValue('page');

    const validationErrors = TemplateValidator.validate(['template.html']);
    expect(validationErrors.length).toBe(2);
    expect(validationErrors[0].result).toBe(VALIDATION_RESULT.FATAL);
  });

  it('returns error if template type is not allowed', async () => {
    fs.readFileSync.mockReturnValue('mock');
    mockGetAnnotationValue('starter_landing_pages', 'value');

    const validationErrors = TemplateValidator.validate(['template.html']);

    expect(validationErrors.length).toBe(1);
  });

  it('returns error if template type is unknown', async () => {
    fs.readFileSync.mockReturnValue('mock');
    mockGetAnnotationValue('unknown-type', 'value');

    const validationErrors = TemplateValidator.validate(['template.html']);

    expect(validationErrors.length).toBe(1);
  });

  it('returns error if template type is not found', async () => {
    fs.readFileSync.mockReturnValue('mock');
    mockGetAnnotationValue(null, 'value');

    const validationErrors = TemplateValidator.validate(['template.html']);

    expect(validationErrors.length).toBe(1);
  });

  it('returns no error if template annotation has label and screenshotPath', async () => {
    fs.readFileSync.mockReturnValue('mock');
    mockGetAnnotationValue('page', 'value');

    const validationErrors = TemplateValidator.validate(['template.html']);

    expect(validationErrors.length).toBe(0);
  });
});
