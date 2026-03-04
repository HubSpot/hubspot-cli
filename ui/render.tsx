import { render } from 'ink';
import { getTable, Scalar } from './components/Table.js';
import { mapTableDataToObjects } from './lib/table.js';
import { ReactNode } from 'react';
import { FullScreen } from './components/FullScreen.js';
import SpinniesManager from '../lib/ui/SpinniesManager.js';

// Ink 6 clips output when it exceeds stdout.rows — we can use a large row count to prevent this.
// This value is arbitrary but large enough to prevent clipping for any realistic static output.
const INK_VIEWPORT_ROWS_FOR_STATIC_OUTPUT = 1000;

/**
 * Renders an Ink component to stdout and immediately unmounts.
 * Uses a proxy to report large viewport dimensions, preventing Ink from clipping output.
 * @param component - The React/Ink component to render.
 */
export async function renderInline(component: React.ReactNode): Promise<void> {
  // Create a proxy stdout that reports large dimensions to prevent Ink from clipping
  const stdout = new Proxy(process.stdout, {
    get(target, prop) {
      if (prop === 'rows') return INK_VIEWPORT_ROWS_FOR_STATIC_OUTPUT;
      const value = Reflect.get(target, prop);
      return typeof value === 'function' ? value.bind(target) : value;
    },
  });

  const { unmount } = render(component, {
    patchConsole: false,
    stdout: stdout as typeof process.stdout,
  });
  unmount();
}

/**
 * Renders a table with headers and data rows.
 * @param tableHeaders - Column headers. Pass `['']` to hide the header row.
 * @param tableData - 2D array where each inner array is a row of cell values.
 * @param borderless - If true, renders without table borders.
 */
export async function renderTable(
  tableHeaders: string[],
  tableData: Scalar[][],
  borderless?: boolean
): Promise<void> {
  const tableObjects = mapTableDataToObjects(tableHeaders, tableData);
  await renderInline(getTable({ data: tableObjects, borderless }));
}

/**
 * Renders a borderless list without headers.
 * @param items - 2D array where each inner array is a row (typically single-item arrays for a simple list).
 */
export async function renderList(items: string[][]): Promise<void> {
  await renderTable([''], items, true);
}

export async function renderInteractive(
  component: ReactNode,
  options: {
    fullScreen?: boolean;
  } = {
    fullScreen: false,
  }
): Promise<void> {
  // Disable SpinniesManager output during Ink rendering to prevent spinner text
  // from interfering with Ink's terminal control (especially when using fullScreen
  // mode's alternative buffer). Re-enable after rendering completes.
  SpinniesManager.setDisableOutput(true);

  if (options.fullScreen) {
    // Enter alternative buffer
    process.stdout.write('\x1b[?1049h');

    let instance;
    try {
      instance = render(<FullScreen>{component}</FullScreen>, {
        patchConsole: true,
      });
      await instance.waitUntilExit();
    } finally {
      // Exit alternative buffer
      process.stdout.write('\x1b[?1049l');
    }
  } else {
    const instance = render(component);
    await instance.waitUntilExit();
  }
  SpinniesManager.setDisableOutput(false);
}
