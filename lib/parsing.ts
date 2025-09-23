import { lib } from '../lang/en.js';

export function parseStringToNumber(maybeNumber: string): number {
  const result = parseInt(maybeNumber, 10);
  if (Number.isNaN(result) || !/^-?\d+$/.test(maybeNumber)) {
    throw new Error(lib.parsing.unableToParseStringToNumber);
  }
  return result;
}
