const { cleanSchema, writeSchemaToDisk, logSchemas } = require('../schema');
const basic = require('./fixtures/schema/basic.json');
const full = require('./fixtures/schema/full.json');
const { getCwd } = require('@hubspot/cms-lib/path');
const multiple = require('./fixtures/schema/multiple.json');
const fs = require('fs-extra');
const path = require('path');
const { logger } = require('@hubspot/cms-lib/logger');

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
