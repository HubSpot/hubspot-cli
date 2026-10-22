import { fetchObjectSchemas } from '@hubspot/local-dev-lib/api/customObjects';
import { Schema } from '@hubspot/local-dev-lib/types/Schemas';
import { uiLogger } from '../ui/logger.js';
import { logSchemas, listSchemas } from '../schema.js';

vi.mock('@hubspot/local-dev-lib/api/customObjects');

const mockedFetchObjectSchemas = vi.mocked(fetchObjectSchemas);
const mockedUiLogger = vi.mocked(uiLogger);

const ACCOUNT_ID = 123;

function buildSchema(name: string, singular: string, objectTypeId?: string) {
  return {
    name,
    labels: { singular },
    objectTypeId,
  } as unknown as Schema;
}

const mockSchemaCars = buildSchema('cars', 'Car', '2-111');
const mockSchemaBoats = buildSchema('boats', 'Boat', '2-222');

describe('lib/schema', () => {
  describe('logSchemas()', () => {
    it('should log a message when there are no schemas', () => {
      logSchemas([]);

      expect(mockedUiLogger.log).toHaveBeenCalledWith('No Schemas were found');
      expect(mockedUiLogger.log).toHaveBeenCalledTimes(1);
    });

    it('should log a table containing the label, name, and object type id', () => {
      logSchemas([mockSchemaCars]);

      const output = mockedUiLogger.log.mock.calls[0][0];
      expect(output).toContain('Label');
      expect(output).toContain('Name');
      expect(output).toContain('objectTypeId');
      expect(output).toContain('Car');
      expect(output).toContain('cars');
      expect(output).toContain('2-111');
    });

    it('should sort rows by schema name', () => {
      logSchemas([mockSchemaCars, mockSchemaBoats]);

      const output = mockedUiLogger.log.mock.calls[0][0];
      expect(output.indexOf('boats')).toBeLessThan(output.indexOf('cars'));
    });

    it('should render an empty object type id when it is missing', () => {
      logSchemas([buildSchema('cars', 'Car')]);

      const output = mockedUiLogger.log.mock.calls[0][0];
      expect(output).not.toContain('undefined');
    });
  });

  describe('listSchemas()', () => {
    it('should fetch schemas for the account and log them', async () => {
      mockedFetchObjectSchemas.mockResolvedValue({
        data: { results: [mockSchemaCars] },
      } as unknown as Awaited<ReturnType<typeof fetchObjectSchemas>>);

      await listSchemas(ACCOUNT_ID);

      expect(mockedFetchObjectSchemas).toHaveBeenCalledWith(ACCOUNT_ID);
      expect(mockedUiLogger.log.mock.calls[0][0]).toContain('cars');
    });

    it('should log the empty message when the account has no schemas', async () => {
      mockedFetchObjectSchemas.mockResolvedValue({
        data: { results: [] },
      } as unknown as Awaited<ReturnType<typeof fetchObjectSchemas>>);

      await listSchemas(ACCOUNT_ID);

      expect(mockedUiLogger.log).toHaveBeenCalledWith('No Schemas were found');
    });

    it('should reject when the fetch fails', async () => {
      mockedFetchObjectSchemas.mockRejectedValue(new Error('boom'));

      await expect(listSchemas(ACCOUNT_ID)).rejects.toThrow('boom');
      expect(mockedUiLogger.log).not.toHaveBeenCalled();
    });
  });
});
