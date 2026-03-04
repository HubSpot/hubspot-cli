import { Box, Text } from 'ink';
import { ValueOf } from '@hubspot/local-dev-lib/types/Utils';
import { ACTION_STATUSES } from '../constants.js';
import { INK_COLORS } from '../styles.js';
import { StatusIcon } from './StatusIcon.js';

type ActionStatus = ValueOf<typeof ACTION_STATUSES>;

export type ActionSectionProps = {
  status: ActionStatus;
  statusText: string;
  errorMessage?: string;
  children?: React.ReactNode;
};

const LEFT_BORDER_BOX_PROPS = {
  flexDirection: 'column' as const,
  borderStyle: 'single' as const,
  borderColor: INK_COLORS.GRAY,
  borderLeft: true,
  borderTop: false,
  borderRight: false,
  borderBottom: false,
  paddingLeft: 2,
  marginLeft: 1,
};

export function ActionSection({
  status,
  statusText,
  errorMessage,
  children,
}: ActionSectionProps) {
  if (status === ACTION_STATUSES.IDLE) {
    return null;
  }

  return (
    <>
      <Box flexDirection="row" columnGap={1}>
        <StatusIcon status={status} />
        <Text>{statusText}</Text>
      </Box>

      <Box {...LEFT_BORDER_BOX_PROPS}>
        {children}
        {status === ACTION_STATUSES.ERROR && errorMessage && (
          <Text color={INK_COLORS.ALERT_RED} wrap="wrap">
            {errorMessage}
          </Text>
        )}
      </Box>
    </>
  );
}

export function getActionSection(props: ActionSectionProps): React.ReactNode {
  return <ActionSection {...props} />;
}
