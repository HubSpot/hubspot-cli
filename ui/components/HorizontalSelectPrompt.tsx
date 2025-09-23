import { Box, Text, useInput } from 'ink';
import { useState } from 'react';
import { CONTAINER_STYLES, INK_COLORS } from '../styles.js';

export interface HorizontalSelectPromptProps {
  defaultOption?: string;
  options: string[];
  onSelect: (value: string) => void;
  prompt?: string;
}

export function getHorizontalSelectPrompt(
  props: HorizontalSelectPromptProps
): React.ReactNode {
  return <HorizontalSelectPrompt {...props} />;
}

export function HorizontalSelectPrompt({
  defaultOption,
  options,
  onSelect,
  prompt,
}: HorizontalSelectPromptProps): React.ReactNode {
  const [selectedIndex, setSelectedIndex] = useState(
    defaultOption && options.indexOf(defaultOption) !== -1
      ? options.indexOf(defaultOption)
      : 0
  );

  const moveRight = () => {
    setSelectedIndex(prev => (prev < options.length - 1 ? prev + 1 : 0));
  };
  const moveLeft = () => {
    setSelectedIndex(prev => (prev > 0 ? prev - 1 : options.length - 1));
  };

  useInput((_, key) => {
    if (key.leftArrow) {
      moveLeft();
    } else if (key.rightArrow) {
      moveRight();
    } else if (key.return) {
      onSelect(options[selectedIndex]);
    }
  });

  return (
    <Box
      {...CONTAINER_STYLES}
      flexDirection="column"
      marginTop={1}
      width="100%"
      alignSelf="center"
      justifyContent="center"
    >
      {prompt && (
        <Box marginBottom={1}>
          <Text>{prompt}</Text>
        </Box>
      )}
      <Box
        flexDirection="row"
        justifyContent="center"
        flexWrap="wrap"
        width="100%"
        gap={1}
      >
        {options.map((option, index) => (
          <Box key={index}>
            <Text
              backgroundColor={
                index === selectedIndex ? INK_COLORS.INFO_BLUE : undefined
              }
              bold={index === selectedIndex}
            >
              {` ${option} `}
            </Text>
          </Box>
        ))}
      </Box>
      <Box marginTop={1} alignSelf="center" justifyContent="center">
        <Text dimColor>Use arrow keys to navigate, Enter to select</Text>
      </Box>
    </Box>
  );
}
