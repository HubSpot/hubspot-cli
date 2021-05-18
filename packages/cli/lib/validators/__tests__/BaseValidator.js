const BaseValidator = require('../marketplaceValidators/theme/BaseValidator');
const { VALIDATION_RESULT } = require('../constants');

const Validator = new BaseValidator({
  name: 'Test validator',
  key: 'validatorKey',
});

describe('validators/theme/BaseValidator', () => {
  it('getSuccess returns expected object', async () => {
    const success = Validator.getSuccess();

    expect(success.validatorKey).toBe('validatorKey');
    expect(success.validatorName).toBe('Test validator');
    expect(success.result).toBe(VALIDATION_RESULT.SUCCESS);
  });

  it('getError returns expected object', async () => {
    const errorObj = { key: 'errorkey', getCopy: () => 'Some error copy' };
    const success = Validator.getError(errorObj);

    expect(success.validatorKey).toBe('validatorKey');
    expect(success.validatorName).toBe('Test validator');
    expect(success.error).toBe('Some error copy');
    expect(success.result).toBe(VALIDATION_RESULT.FATAL);
    expect(success.key).toBe('validatorKey.errorkey');
  });
});
