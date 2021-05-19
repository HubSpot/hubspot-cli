const ValidatorStore = require('../ValidatorStore');

describe('validators/ValidatorStore', () => {
  beforeEach(() => {
    ValidatorStore.clear();
  });

  it('setValue sets a value in the store', async () => {
    ValidatorStore.setValue('test', 'value');

    expect(ValidatorStore.store.test).toBe('value');
  });

  it('hasValue checks if the store contains a value', async () => {
    ValidatorStore.setValue('test', 'value');

    expect(ValidatorStore.hasValue('test')).toBe(true);
    expect(ValidatorStore.hasValue('test1')).toBe(false);
  });

  it('getValue returns a value', async () => {
    ValidatorStore.setValue('test', 'value');

    expect(ValidatorStore.getValue('test')).toBe('value');
  });

  it('clear resets the store', async () => {
    ValidatorStore.setValue('test', 'value');
    expect(Object.keys(ValidatorStore.store).length).toBe(1);

    ValidatorStore.clear();
    expect(Object.keys(ValidatorStore.store).length).toBe(0);
  });
});
