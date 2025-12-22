import { INK_COLORS } from '../styles.js';
import { BoxWithTitle } from './BoxWithTitle.js';
export interface StatusMessageBoxProps {
  title: string;
  message: string;
  textCentered?: boolean;
}

export function getWarningBox(props: StatusMessageBoxProps): React.ReactNode {
  return <WarningBox {...props} />;
}

export function WarningBox({
  title,
  message,
  textCentered,
}: StatusMessageBoxProps): React.ReactNode {
  const color = INK_COLORS.WARNING_YELLOW;
  return (
    <BoxWithTitle
      title={title}
      message={message}
      titleBackgroundColor={color}
      borderColor={color}
      textCentered={textCentered}
    />
  );
}

export function getAlertBox(props: StatusMessageBoxProps): React.ReactNode {
  return <AlertBox {...props} />;
}

export function AlertBox({
  title,
  message,
  textCentered,
}: StatusMessageBoxProps): React.ReactNode {
  const color = INK_COLORS.ALERT_RED;
  return (
    <BoxWithTitle
      title={title}
      message={message}
      titleBackgroundColor={color}
      borderColor={color}
      textCentered={textCentered}
    />
  );
}

export function getSuccessBox(props: StatusMessageBoxProps): React.ReactNode {
  return <SuccessBox {...props} />;
}

export function SuccessBox({
  title,
  message,
  textCentered,
}: StatusMessageBoxProps): React.ReactNode {
  const color = INK_COLORS.SUCCESS_GREEN;
  return (
    <BoxWithTitle
      title={title}
      message={message}
      titleBackgroundColor={color}
      borderColor={color}
      textCentered={textCentered}
    />
  );
}

export function getInfoBox(props: StatusMessageBoxProps): React.ReactNode {
  return <InfoBox {...props} />;
}

export function InfoBox({
  title,
  message,
  textCentered,
}: StatusMessageBoxProps): React.ReactNode {
  const color = INK_COLORS.INFO_BLUE;
  return (
    <BoxWithTitle
      title={title}
      message={message}
      titleBackgroundColor={color}
      borderColor={color}
      textCentered={textCentered}
    />
  );
}
