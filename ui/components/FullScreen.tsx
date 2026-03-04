import { Box } from 'ink';
import React from 'react';
import { useTerminalSize } from '../lib/useTerminalSize.js';

export type FullScreenProps = {
  children: React.ReactNode;
};

export function FullScreen({ children }: FullScreenProps): React.ReactNode {
  // Use rows - 1 to prevent flickering
  // See: https://github.com/vadimdemedes/ink/issues/359
  const { rows, columns } = useTerminalSize();
  const height = rows - 1;

  return (
    <Box
      flexDirection="column"
      width={columns}
      height={height}
      overflow="hidden"
    >
      {children}
    </Box>
  );
}

export function getFullScreen(props: FullScreenProps): React.ReactNode {
  return <FullScreen {...props} />;
}
