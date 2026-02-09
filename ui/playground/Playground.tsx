import { Box, Text } from 'ink';
import { useState } from 'react';

import { HorizontalSelectPrompt } from '../components/HorizontalSelectPrompt.js';
import {
  ComponentPropPair,
  getComponentOptions,
  populatedComponents,
} from './fixtures.js';
import { useTerminalSize } from '../lib/useTerminalSize.js';
import { CONTAINER_STYLES } from '../styles.js';

export type PlaygroundProps = {
  componentName: string | undefined;
};

export function getPlayground(props: PlaygroundProps): React.ReactNode {
  return <Playground {...props} />;
}

export function Playground({
  componentName,
}: PlaygroundProps): React.ReactNode {
  const componentOptions = getComponentOptions();
  const [selectedComponent, setSelectedComponent] = useState<
    ComponentPropPair | undefined
  >(componentName ? populatedComponents[componentName] : undefined);

  const mapStringToComponent = (str: string) => {
    setSelectedComponent(populatedComponents[str] || undefined);
  };

  const getFunctionArguments = (signature: string) => {
    const startIndex = signature.indexOf('(');
    const endIndex = signature.indexOf(')');
    const functionArgs = signature.slice(startIndex, endIndex + 1);
    return functionArgs;
  };

  const size = useTerminalSize(20);

  return (
    <Box flexDirection="column" height={size.rows}>
      <HorizontalSelectPrompt
        defaultOption={componentName}
        options={componentOptions}
        onSelect={mapStringToComponent}
      />
      {selectedComponent?.component}
      {selectedComponent?.signature && (
        <Box {...CONTAINER_STYLES} gap={1} borderStyle="classic">
          <Text>Signature:</Text>
          <Text>{getFunctionArguments(selectedComponent?.signature)}</Text>
        </Box>
      )}
    </Box>
  );
}
