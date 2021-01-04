const fs = require('fs-extra');
const path = require('path');
const { cleanSchema, writeSchemaToDisk, logSchemas } = require('../schema');
const { logger } = require('../logger');
const { getCwd } = require('../path');
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

  describe('writeSchemaToDisk()', () => {
    it('writes schema to disk', () => {
      const spy = jest.spyOn(fs, 'outputFileSync');
      expect(fs.existsSync(path.resolve(getCwd(), `${basic.name}.json`))).toBe(
        false
      );
      writeSchemaToDisk(basic);
      expect(spy.mock.calls[0][1]).toMatchSnapshot();
    });
  });

  describe('logSchemas()', () => {
    it('logs schemas', () => {
      const spy = jest.spyOn(logger, 'log');
      logSchemas([basic]);
      expect(spy.mock.calls[0][0]).toMatchSnapshot();
    });
  });
});
