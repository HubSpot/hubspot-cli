import { Box, Text } from 'ink';
import { CONTAINER_STYLES } from '../styles.js';

export interface BoxWithTitleProps {
  title: string;
  message: string;
  titleBackgroundColor?: string;
  borderColor?: string;
}

export function getBoxWithTitle(props: BoxWithTitleProps): React.ReactNode {
  return <BoxWithTitle {...props} />;
}

export function BoxWithTitle({
  title,
  message,
  titleBackgroundColor,
  borderColor,
}: BoxWithTitleProps): React.ReactNode {
  return (
    <Box {...CONTAINER_STYLES} borderStyle="round" borderColor={borderColor}>
      <Box
        position="absolute"
        marginTop={-2}
        paddingX={0}
        alignSelf="flex-start"
        justifyContent="center"
        alignItems="center"
      >
        <Text backgroundColor={titleBackgroundColor} bold>
          {` ${title} `}
        </Text>
      </Box>
      <Box justifyContent="center" alignItems="center">
        <Text>{message}</Text>
      </Box>
    </Box>
  );
}
