// Original package: ink-table (https://github.com/maticzav/ink-table)
// Copyright (c) Matic Zavadlal <matic.zavadlal@gmail.com>
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in all
// copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
// SOFTWARE.

import React from 'react';
import { Box, Text } from 'ink';
import { INK_COLORS } from '../styles.js';

/* Table */

export type Scalar = string | number | boolean | null | undefined;

export function getTable<T extends ScalarDict>(
  props: Pick<TableProps<T>, 'data'> & Partial<TableProps<T>>
) {
  return <Table {...props} />;
}

export type ScalarDict = {
  [key: string]: Scalar;
};

export type CellProps = React.PropsWithChildren<{ column: number }>;

export type TableProps<T extends ScalarDict> = {
  /**
   * List of values (rows).
   */
  data: T[];
  /**
   * Columns that we should display in the table.
   */
  columns: (keyof T)[];
  /**
   * Cell padding.
   */
  padding: number;
  /**
   * Header component.
   */
  header: (props: React.PropsWithChildren<object>) => JSX.Element;
  /**
   * Component used to render a cell in the table.
   */
  cell: (props: CellProps) => JSX.Element;
  /**
   * Component used to render the skeleton of the table.
   */
  skeleton: (props: React.PropsWithChildren<object>) => JSX.Element;
  /**
   * Whether to render without borders.
   */
  borderless: boolean;
};

/* Table */

export default class Table<T extends ScalarDict> extends React.Component<
  Pick<TableProps<T>, 'data'> & Partial<TableProps<T>>
> {
  /* Config */

  /**
   * Merges provided configuration with defaults.
   */
  getConfig(): TableProps<T> {
    return {
      data: this.props.data,
      columns: this.props.columns || this.getDataKeys(),
      padding: this.props.padding || 1,
      header: this.props.header || Header,
      cell: this.props.cell || Cell,
      skeleton: this.props.skeleton || Skeleton,
      borderless: this.props.borderless ?? false,
    };
  }

  /**
   * Gets all keyes used in data by traversing through the data.
   */
  getDataKeys(): (keyof T)[] {
    const keys = new Set<keyof T>();

    // Collect all the keys.
    for (const data of this.props.data) {
      for (const key in data) {
        keys.add(key);
      }
    }

    return Array.from(keys);
  }

  /**
   * Calculates the width of each column by finding
   * the longest value in a cell of a particular column.
   *
   * Returns a list of column names and their widths.
   */
  getColumns(): Column<T>[] {
    const { columns, padding } = this.getConfig();

    const widths: Column<T>[] = columns.map(key => {
      const header = String(key).length;
      /* Get the width of each cell in the column */
      const data = this.props.data.map(data => {
        const value = data[key];

        if (value == undefined || value == null) return 0;
        return String(value).length;
      });

      const width = Math.max(...data, header) + padding * 2;

      /* Construct a cell */
      return {
        column: key,
        width: width,
        key: String(key),
      };
    });

    return widths;
  }

  /**
   * Returns a (data) row representing the headings.
   */
  getHeadings(): Partial<T> {
    const { columns } = this.getConfig();

    const headings: Partial<T> = columns.reduce(
      (acc, column) => ({ ...acc, [column]: column }),
      {}
    );

    return headings;
  }

  /* Rendering utilities */

  getHeaderRow() {
    const config = this.getConfig();
    return row<T>({
      cell: config.skeleton,
      padding: config.padding,
      skeleton: {
        component: config.skeleton,
        line: '─',
        left: '┌',
        right: '┐',
        cross: '┬',
      },
    });
  }

  getHeadingRow() {
    const config = this.getConfig();
    return row<T>({
      cell: config.header,
      padding: config.padding,
      skeleton: {
        component: config.skeleton,
        line: ' ',
        left: config.borderless ? '' : '│',
        right: config.borderless ? '' : '│',
        cross: config.borderless ? '  ' : '│',
      },
    });
  }

  getSeparatorRow() {
    const config = this.getConfig();
    return row<T>({
      cell: config.skeleton,
      padding: config.padding,
      skeleton: {
        component: config.skeleton,
        line: '─',
        left: '├',
        right: '┤',
        cross: '┼',
      },
    });
  }

  getDataRow() {
    const config = this.getConfig();
    return row<T>({
      cell: config.cell,
      padding: config.padding,
      skeleton: {
        component: config.skeleton,
        line: ' ',
        left: config.borderless ? '' : '│',
        right: config.borderless ? '' : '│',
        cross: config.borderless ? '  ' : '│',
      },
    });
  }

  getFooterRow() {
    const config = this.getConfig();
    return row<T>({
      cell: config.skeleton,
      padding: config.padding,
      skeleton: {
        component: config.skeleton,
        line: '─',
        left: '└',
        right: '┘',
        cross: '┴',
      },
    });
  }

  /* Render */

  render() {
    const config = this.getConfig();
    const columns = this.getColumns();
    const headings = this.getHeadings();
    const { borderless } = config;

    const headerRow = this.getHeaderRow();
    const headingRow = this.getHeadingRow();
    const separatorRow = this.getSeparatorRow();
    const dataRow = this.getDataRow();
    const footerRow = this.getFooterRow();

    return (
      <Box flexDirection="column" marginLeft={1}>
        {!borderless && headerRow({ key: 'header', columns, data: {} })}
        {!Object.keys(headings).includes('') && // Don't show header for lists
          headingRow({ key: 'heading', columns, data: headings })}
        {this.props.data.map((row, index) => {
          const key = `row-${JSON.stringify(row)}-${index}`;

          return (
            <Box flexDirection="column" key={key}>
              {!borderless &&
                separatorRow({ key: `separator-${key}`, columns, data: {} })}
              {dataRow({ key: `data-${key}`, columns, data: row })}
            </Box>
          );
        })}
        {!borderless && footerRow({ key: 'footer', columns, data: {} })}
      </Box>
    );
  }
}

/* Helper components */

type RowConfig = {
  /**
   * Component used to render cells.
   */
  cell: (props: CellProps) => JSX.Element;
  /**
   * Tells the padding of each cell.
   */
  padding: number;
  /**
   * Component used to render skeleton in the row.
   */
  skeleton: {
    component: (props: React.PropsWithChildren<object>) => JSX.Element;
    /**
     * Characters used in skeleton.
     *    |             |
     * (left)-(line)-(cross)-(line)-(right)
     *    |             |
     */
    left: string;
    right: string;
    cross: string;
    line: string;
  };
};

type RowProps<T extends ScalarDict> = {
  key: string;
  data: Partial<T>;
  columns: Column<T>[];
};

type Column<T> = {
  key: string;
  column: keyof T;
  width: number;
};

/**
 * Constructs a Row element from the configuration.
 */
function row<T extends ScalarDict>(
  config: RowConfig
): (props: RowProps<T>) => JSX.Element {
  /* This is a component builder. We return a function. */

  const skeleton = config.skeleton;

  /* Row */
  return props => (
    <Box flexDirection="row">
      {/* Left */}
      <skeleton.component>{skeleton.left}</skeleton.component>
      {/* Data */}
      {...intersperse(
        i => {
          const key = `${props.key}-hseparator-${i}`;

          // The horizontal separator.
          return (
            <skeleton.component key={key}>{skeleton.cross}</skeleton.component>
          );
        },

        // Values.
        props.columns.map((column, colI) => {
          // content
          const value = props.data[column.column];

          if (value == undefined || value == null) {
            const key = `${props.key}-empty-${column.key}`;

            return (
              <config.cell key={key} column={colI}>
                {skeleton.line.repeat(column.width)}
              </config.cell>
            );
          } else {
            const key = `${props.key}-cell-${column.key}`;

            // margins
            const ml = config.padding;
            const mr = column.width - String(value).length - config.padding;

            return (
              /* prettier-ignore */
              <config.cell key={key} column={colI}>
                {`${skeleton.line.repeat(ml)}${String(value)}${skeleton.line.repeat(mr)}`}
              </config.cell>
            );
          }
        })
      )}
      {/* Right */}
      <skeleton.component>{skeleton.right}</skeleton.component>
    </Box>
  );
}

/**
 * Renders the header of a table.
 */
export function Header(props: React.PropsWithChildren<object>) {
  return (
    <Text bold color={INK_COLORS.INFO_BLUE}>
      {props.children}
    </Text>
  );
}

/**
 * Renders a cell in the table.
 */
export function Cell(props: CellProps) {
  return <Text>{props.children}</Text>;
}

/**
 * Redners the scaffold of the table.
 */
export function Skeleton(props: React.PropsWithChildren<object>) {
  return <Text bold>{props.children}</Text>;
}

/* Utility functions */

/**
 * Intersperses a list of elements with another element.
 */
function intersperse<T, I>(
  intersperser: (index: number) => I,
  elements: T[]
): (T | I)[] {
  // Intersparse by reducing from left.
  const interspersed: (T | I)[] = elements.reduce(
    (acc, element, index) => {
      // Only add element if it's the first one.
      if (acc.length === 0) return [element];
      // Add the intersparser as well otherwise.
      return [...acc, intersperser(index), element];
    },
    [] as (T | I)[]
  );

  return interspersed;
}
