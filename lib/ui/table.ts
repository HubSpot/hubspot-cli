import chalk from 'chalk';
import { table, TableUserConfig } from 'table';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function isObject(item: any): boolean {
  return item && typeof item === 'object' && !Array.isArray(item);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mergeDeep<T extends Record<string, any>>(
  target: T,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ...sources: any[]
): T {
  if (!sources.length) return target;
  const source = sources.shift();

  if (isObject(target) && source && isObject(source)) {
    for (const key in source) {
      if (isObject(source[key])) {
        if (!target[key]) Object.assign(target, { [key]: {} });
        mergeDeep(target[key], source[key]);
      } else {
        Object.assign(target, { [key]: source[key] });
      }
    }
  }

  return mergeDeep(target, ...sources);
}

const tableConfigDefaults: TableUserConfig = {
  singleLine: true,
  border: {
    topBody: '',
    topJoin: '',
    topLeft: '',
    topRight: '',

    bottomBody: '',
    bottomJoin: '',
    bottomLeft: '',
    bottomRight: '',

    bodyLeft: '',
    bodyRight: '',
    bodyJoin: '',

    joinBody: '',
    joinLeft: '',
    joinRight: '',
    joinJoin: '',
  },
  columnDefault: {
    paddingLeft: 0,
    paddingRight: 1,
  },
  drawHorizontalLine: () => {
    return false;
  },
};

export function getTableContents(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tableData: any[][] = [],
  tableConfig: Partial<TableUserConfig> = {}
): string {
  const mergedConfig = mergeDeep({}, tableConfigDefaults, tableConfig);

  return table(tableData, mergedConfig);
}

export function getTableHeader(headerItems: string[]): string[] {
  return headerItems.map(headerItem => chalk.bold(headerItem));
}
