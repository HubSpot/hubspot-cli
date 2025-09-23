const ANSI_CODE_REGEX =
  /[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g;

export function removeAnsiCodes(str: string): string {
  return str.replace(ANSI_CODE_REGEX, '');
}
