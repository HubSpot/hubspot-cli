import { Box, Text } from 'ink';
import { CONTAINER_STYLES } from '../styles.js';

export interface BoxWithTitleProps {
  title: string;
  message?: string;
  titleBackgroundColor?: string;
  borderColor?: string;
  textCentered?: boolean;
  children?: React.ReactNode;
  flexGrow?: number;
}

export function getBoxWithTitle(props: BoxWithTitleProps): React.ReactNode {
  return <BoxWithTitle {...props} />;
}

export function BoxWithTitle({
  title,
  message,
  titleBackgroundColor,
  borderColor,
  textCentered,
  children,
  flexGrow,
}: BoxWithTitleProps): React.ReactNode {
  return (
    <Box
      {...CONTAINER_STYLES}
      flexGrow={flexGrow}
      borderStyle="round"
      borderColor={borderColor}
    >
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
      <Box flexDirection="column" width="100%" rowGap={1}>
        {/* Split on \n\n for sections with gaps, \n for lines without gaps */}
        {message?.split('\n\n').map((section, sectionIndex) => (
          <Box
            key={sectionIndex}
            flexDirection="column"
            alignItems={textCentered ? 'center' : 'flex-start'}
          >
            {section.split('\n').map((line, lineIndex) => (
              <Text key={`${sectionIndex}-${lineIndex}`}>{line}</Text>
            ))}
          </Box>
        ))}
        {children}
      </Box>
    </Box>
  );
}
