import { Box, Text } from 'ink';
import { useState } from 'react';

import { HorizontalSelectPrompt } from '../components/HorizontalSelectPrompt.js';
import {
  ComponentPropPair,
  getComponentOptions,
  populatedComponents,
} from '../lib/ui-testing-utils.js';
import { useTerminalSize } from '../lib/useTerminalSize.js';
import { CONTAINER_STYLES } from '../styles.js';

export type UiSandboxProps = {
  componentName: string | undefined;
};

export function getUiSandbox(props: UiSandboxProps): React.ReactNode {
  return <UiSandbox {...props} />;
}

export function UiSandbox({ componentName }: UiSandboxProps): React.ReactNode {
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
