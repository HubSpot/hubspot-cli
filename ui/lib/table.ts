import { removeAnsiCodes } from '../../lib/ui/removeAnsiCodes.js';
import { Scalar, ScalarDict } from '../components/Table.js';

export function mapTableDataToObjects(
  headers: string[],
  data: Scalar[][]
): ScalarDict[] {
  const cleanHeaders = headers.map(removeAnsiCodes);
  return data.map(row => {
    const rowObject: ScalarDict = {};
    cleanHeaders.forEach((header, index) => {
      rowObject[header] = row[index] ?? '';
    });
    return rowObject;
  });
}
