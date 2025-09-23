import { useStdout } from 'ink';
import { useEffect, useState } from 'react';

/**
 * This hook is used to get the current terminal size.
 * It will return the current terminal size, and if a component is using this hook to set height/width,
 * it will re-render when the terminal size changes.
 * ONLY USE THIS HOOK WITH SCREENS. THIS HOOK WILL DESTROY ANY PRIOR LOG OUTPUT IF USED TO SET HEIGHT/WIDTH.
 * @param minHeight - The minimum height of the terminal.
 * @param minWidth - The minimum width of the terminal.
 * @returns The current terminal size.
 */
export function useTerminalSize(
  minHeight?: number,
  minWidth?: number
): { columns: number; rows: number } {
  const { stdout } = useStdout();
  const [size, setSize] = useState({
    columns: Math.max(stdout.columns, minWidth ?? 0),
    rows: Math.max(stdout.rows, minHeight ?? 0),
  });

  useEffect(() => {
    const handleResize = () => {
      setSize({
        columns: Math.max(stdout.columns, minWidth ?? 0),
        rows: Math.max(stdout.rows, minHeight ?? 0),
      });
    };

    stdout.on('resize', handleResize);

    return () => {
      stdout.off('resize', handleResize);
    };
  }, [stdout]);

  return size;
}
