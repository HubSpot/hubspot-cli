import { Text } from 'ink';
import Spinner from 'ink-spinner';
import { ValueOf } from '@hubspot/local-dev-lib/types/Utils';
import { ACTION_STATUSES } from '../constants.js';
import { INK_COLORS } from '../styles.js';

type ActionStatus = ValueOf<typeof ACTION_STATUSES>;

export type StatusIconProps = {
  status: ActionStatus;
};

export function StatusIcon({ status }: StatusIconProps) {
  if (status === ACTION_STATUSES.ERROR) {
    return <Text color={INK_COLORS.ALERT_RED}>×</Text>;
  }
  if (status === ACTION_STATUSES.DONE) {
    return <Text color={INK_COLORS.HUBSPOT_TEAL}>✓</Text>;
  }
  return (
    <Text color={INK_COLORS.HUBSPOT_TEAL}>
      <Spinner type="dots" />
    </Text>
  );
}

export function getStatusIcon(props: StatusIconProps): React.ReactNode {
  return <StatusIcon {...props} />;
}
