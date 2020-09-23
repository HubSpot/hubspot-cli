const { cleanSchema } = require('../schema');
const basic = require('./fixtures/schema/basic.json');
const full = require('./fixtures/schema/full.json');
const multiple = require('./fixtures/schema/multiple.json');

describe('cms-lib/schema', () => {
  describe('cleanSchema()', () => {
    it('cleans a basic schema', () => {
      expect(cleanSchema(basic)).toEqual(basic);
    });

    it('cleans a full schema', () => {
      expect(cleanSchema(full)).toMatchSnapshot();
    });

    it('cleans multiple schema', () => {
      expect(multiple.map(cleanSchema)).toMatchSnapshot();
    });
  });
});
