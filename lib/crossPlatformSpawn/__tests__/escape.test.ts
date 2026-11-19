import { escapeArgument } from '../escape.js';

const ESCAPE_ARGUMENT_CASES: [string, boolean, string][] = [
  ['', false, '^"^"'],
  ['plain', false, '^"plain^"'],
  ['with space', false, '^"with^ space^"'],
  ['say "hi" & echo pwned', false, '^"say^ \\^"hi\\^"^ ^&^ echo^ pwned^"'],
  ['C:\\Users\\me\\', false, '^"C:\\Users\\me\\\\^"'],
  ['quote after backslash \\"', false, '^"quote^ after^ backslash^ \\\\\\^"^"'],
  [
    '100% ^ | < > ( ) [ ] ! ` ; , * ?',
    false,
    '^"100^%^ ^^^ ^|^ ^<^ ^>^ ^(^ ^)^ ^[^ ^]^ ^!^ ^`^ ^;^ ^,^ ^*^ ^?^"',
  ],
  ['plain', true, '^^^"plain^^^"'],
  ['with space', true, '^^^"with^^^ space^^^"'],
  [
    'say "hi" & echo pwned',
    true,
    '^^^"say^^^ \\^^^"hi\\^^^"^^^ ^^^&^^^ echo^^^ pwned^^^"',
  ],
];

describe('lib/crossPlatformSpawn/escape', () => {
  describe('escapeArgument()', () => {
    it.each(ESCAPE_ARGUMENT_CASES)(
      'should match cross-spawn 7.0.6 for %j (double escape: %s)',
      (arg, doubleEscape, expected) => {
        expect(escapeArgument(arg, doubleEscape)).toBe(expected);
      }
    );
  });
});
