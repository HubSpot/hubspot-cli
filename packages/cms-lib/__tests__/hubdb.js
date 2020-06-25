const fs = require('fs-extra');
const { downloadHubDbTable, createHubDbTable } = require('../hubdb');
const { publishTable } = require('../api/hubdb');
const { getCwd } = require('../path');
const hubdbJson = require('./fixtures/hubdb/hubdbTableData');

jest.mock('../path');
jest.mock('../api/hubdb');

describe('cms-lib/hubdb', () => {
  it('downloads hubdb table', async () => {
    const portalId = 123;
    const tableId = 456;
    const destPath = 'tmp.json';
    const projectCwd = '/home/tom/projects';

    getCwd.mockReturnValue(projectCwd);

    const { filePath } = await downloadHubDbTable(portalId, tableId, destPath);

    describe('transforms column names to ids', () => {
      expect(fs.outputFile).toHaveBeenCalledWith(
        `${projectCwd}/${destPath}`,
        expect.stringContaining('"name": "My Event",')
      );
    });

    describe('provides data with correct name', () => {
      expect(fs.outputFile).toHaveBeenCalledWith(
        `${projectCwd}/${destPath}`,
        expect.stringContaining('events-test')
      );
    });

    describe('returns destination file path', () => {
      expect(filePath).toEqual(`${projectCwd}/${destPath}`);
    });
  });

  it('uploads hubdb table', async () => {
    const portalId = 123;
    const srcPath = 'tmp.json';
    const projectCwd = '/home/tom/projects';

    fs.statSync.mockReturnValue({ isFile: () => true });
    fs.readJsonSync.mockReturnValue(hubdbJson);

    const table = await createHubDbTable(portalId, `${projectCwd}/${srcPath}`);

    expect(publishTable).toBeCalled();
    // expect(table.portalId).toEqual(portalId);
    expect(table.rowCount).toEqual(3);
    expect(table.tableId).toEqual(2639452);
  });
});
