import { Box, Text, useInput } from 'ink';
import { useState } from 'react';
import { INK_COLORS } from '../styles.js';

export type SelectInputItem = {
  label: string;
  value: string;
  disabled?: boolean;
};

export type SelectInputProps = {
  items: SelectInputItem[];
  onSelect: (item: SelectInputItem) => void;
};

export function SelectInput({ items, onSelect }: SelectInputProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);

  useInput((_, key) => {
    if (key.upArrow) {
      setSelectedIndex(prevIndex => {
        let newIndex = prevIndex - 1;
        if (newIndex < 0) {
          newIndex = items.length - 1;
        }
        // Skip disabled items
        while (items[newIndex]?.disabled && newIndex !== prevIndex) {
          newIndex--;
          if (newIndex < 0) {
            newIndex = items.length - 1;
          }
        }
        return newIndex;
      });
    }

    if (key.downArrow) {
      setSelectedIndex(prevIndex => {
        let newIndex = prevIndex + 1;
        if (newIndex >= items.length) {
          newIndex = 0;
        }
        // Skip disabled items
        while (items[newIndex]?.disabled && newIndex !== prevIndex) {
          newIndex++;
          if (newIndex >= items.length) {
            newIndex = 0;
          }
        }
        return newIndex;
      });
    }

    if (key.return) {
      const selectedItem = items[selectedIndex];
      if (selectedItem && !selectedItem.disabled) {
        onSelect(selectedItem);
      }
    }
  });

  return (
    <Box flexDirection="column">
      {items.map((item, index) => {
        const isSelected = index === selectedIndex;
        const isDisabled = item.disabled;

        return (
          <Box key={item.value} flexDirection="row" columnGap={1}>
            <Text color={isSelected ? INK_COLORS.INFO_BLUE : undefined}>
              {isSelected ? '❯' : ' '}
            </Text>
            <Text
              color={
                isDisabled
                  ? INK_COLORS.GRAY
                  : isSelected
                    ? INK_COLORS.INFO_BLUE
                    : undefined
              }
              dimColor={isDisabled}
            >
              {item.label}
            </Text>
          </Box>
        );
      })}
    </Box>
  );
}

export function getSelectInput(props: SelectInputProps): React.ReactNode {
  return <SelectInput {...props} />;
}
