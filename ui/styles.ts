export const CONTAINER_STYLES = {
  padding: 1,
  marginY: 0.5,
  flexDirection: 'column',
  flexWrap: 'wrap',
} as const;

/**
 * Any color that can be used well in both WHITE and BLACK terminals.
 * This is a best effort to ensure that the color is good looking in both
 * light and dark modes.
 */
export const INK_COLORS = {
  ALERT_RED: '#fc7272',
  SUCCESS_GREEN: '#4deb7a',
  INFO_BLUE: '#4dcbeb',
  WARNING_YELLOW: '#EEB117',
  WHITE: 'white',
};
