type TargetCommandMap = {
  [key: string]: {
    target?: boolean;
    subCommands?: TargetCommandMap;
  };
};

export function isTargetedCommand(
  commandParts: (string | number)[],
  targetCommandMap: TargetCommandMap
): boolean {
  const currentCommand = commandParts[0];

  if (!targetCommandMap[currentCommand]) {
    return false;
  }

  if (targetCommandMap[currentCommand].target) {
    return true;
  }

  const subCommands = targetCommandMap[currentCommand].subCommands || {};
  if (commandParts.length > 1) {
    return isTargetedCommand(commandParts.slice(1), subCommands);
  }

  return false;
}
