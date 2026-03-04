import { Box, Text } from 'ink';
import TextInput from 'ink-text-input';
import { INK_COLORS } from '../styles.js';

export type InputFieldProps = {
  flag: string;
  prompt: string;
  value: string;
  isEditing: boolean;
  onChange: (value: string) => void;
  onSubmit: () => void;
};

export function InputField({
  flag,
  prompt,
  value,
  isEditing,
  onChange,
  onSubmit,
}: InputFieldProps) {
  return (
    <Box flexDirection="row" flexWrap="wrap" columnGap={1} marginBottom={1}>
      <Text color={INK_COLORS.HUBSPOT_TEAL}>?</Text>
      <Text>
        [--{flag}] {prompt}
      </Text>
      <Text color={INK_COLORS.INFO_BLUE}>
        <TextInput
          focus={isEditing}
          value={value}
          onChange={onChange}
          onSubmit={onSubmit}
        />
      </Text>
    </Box>
  );
}

export function getInputField(props: InputFieldProps): React.ReactNode {
  return <InputField {...props} />;
}
