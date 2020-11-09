const fs = require('fs-extra');
const { downloadHubDbTable, createHubDbTable } = require('../hubdb');
const hubdb = require('../api/hubdb');
const { getCwd } = require('../path');
const hubdbJson = require('./fixtures/hubdb/hubdbTableData');
const hubdbFetchRowResponse = require('./fixtures/hubdb/hubdbFetchRowsResponse.json');
const hubdbFetchTableResponse = require('./fixtures/hubdb/hubdbFetchTableResponse.json');
const hubdbCreateTableResponse = require('./fixtures/hubdb/hubdbCreateTableResponse.json');
const hubdbCreateRowsResponse = require('./fixtures/hubdb/hubdbCreateRowsResponse.json');
const hubdbPublishTableResponse = require('./fixtures/hubdb/hubdbPublishTableResponse.json');

jest.mock('../path');
jest.mock('../api/hubdb');

describe('cms-lib/hubdb', () => {
  it('downloads hubdb table', async () => {
    const accountId = 123;
    const tableId = 456;
    const destPath = 'tmp.json';
    const projectCwd = '/home/tom/projects';

    getCwd.mockReturnValue(projectCwd);

    hubdb.fetchRows.mockReturnValue(hubdbFetchRowResponse);
    hubdb.fetchTable.mockReturnValue(hubdbFetchTableResponse);

    const { filePath } = await downloadHubDbTable(accountId, tableId, destPath);
    const fileOutput = JSON.parse(fs.outputFile.mock.results[0].value);

    describe('outputs correct rows', () => {
      expect(fileOutput.rows.length).toBe(3);
      expect(fileOutput.rows[1].name).toBe('My Better Event');
    });

    describe('tranforms column ids to names', () => {
      expect(fileOutput.rows[0].values['second_col']).toBe('b');
    });
    describe('provides data with correct name', () => {
      expect(fileOutput.name).toBe('cool-table-name');
    });
    describe('returns destination file path', () => {
      expect(filePath).toEqual(`${projectCwd}/${destPath}`);
    });
  });

  it('uploads hubdb table', async () => {
    const accountId = 123;
    const srcPath = 'tmp.json';
    const projectCwd = '/home/tom/projects';

    fs.statSync.mockReturnValue({ isFile: () => true });
    fs.readJsonSync.mockReturnValue(hubdbJson);

    hubdb.createTable.mockReturnValue(hubdbCreateTableResponse);
    hubdb.createRows.mockReturnValue(hubdbCreateRowsResponse);
    hubdb.publishTable.mockReturnValue(hubdbPublishTableResponse);

    const table = await createHubDbTable(accountId, `${projectCwd}/${srcPath}`);

    describe('has the correct number of rows', () => {
      expect(table.rowCount).toEqual(3);
    });
    describe('returns the correct table ID', () => {
      expect(table.tableId).toEqual(2639452);
    });
    describe('publishes the table', () => {
      expect(hubdb.publishTable).toBeCalled();
    });
  });
});
