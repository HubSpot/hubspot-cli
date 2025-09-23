import {
  getSuccessBox,
  getInfoBox,
  getWarningBox,
  getAlertBox,
} from '../components/StatusMessageBoxes.js';
import { getBoxWithTitle } from '../components/BoxWithTitle.js';
import {
  SuccessBox,
  InfoBox,
  WarningBox,
  AlertBox,
} from '../components/StatusMessageBoxes.js';
import { BoxWithTitle } from '../components/BoxWithTitle.js';

export type ComponentPropPair = {
  component: React.ReactNode;
  signature: string;
};

/**
 * These components will be used by the sandbox ui. Please add any new components here.
 */
export const populatedComponents: Record<string, ComponentPropPair> = {
  SuccessBox: {
    component: getSuccessBox({
      title: 'Success',
      message: 'This is a success message',
    }),
    signature: SuccessBox.toString(),
  },
  InfoBox: {
    component: getInfoBox({
      title: 'Info',
      message: 'This is an info message',
    }),
    signature: InfoBox.toString(),
  },
  WarningBox: {
    component: getWarningBox({
      title: 'Warning',
      message: 'This is a warning message',
    }),
    signature: WarningBox.toString(),
  },
  AlertBox: {
    component: getAlertBox({
      title: 'Alert',
      message: 'This is an alert message',
    }),
    signature: AlertBox.toString(),
  },
  BoxWithTitle: {
    component: getBoxWithTitle({
      title: 'Title',
      message: 'This is a box with a title',
    }),
    signature: BoxWithTitle.toString(),
  },
};

export function getComponentOptions(): string[] {
  return Object.keys(populatedComponents);
}
