import chalk from 'chalk';
import { helpers, interpolate } from '../interpolation.js';

describe('lib/interpolation', () => {
  describe('helpers', () => {
    it('should wrap text with bold styling in the bold helper', () => {
      expect(helpers.bold('text')).toBe(chalk.bold('text'));
    });

    it('should wrap text with yellow styling in the yellow helper', () => {
      expect(helpers.yellow('text')).toBe(chalk.reset.yellow('text'));
    });

    it('should wrap text with green styling in the green helper', () => {
      expect(helpers.green('text')).toBe(chalk.reset.green('text'));
    });

    it('should wrap text with red styling in the red helper', () => {
      expect(helpers.red('text')).toBe(chalk.reset.red('text'));
    });

    it('should wrap text with cyan styling in the cyan helper', () => {
      expect(helpers.cyan('text')).toBe(chalk.cyan('text'));
    });

    it('should wrap text with orange styling in the orange helper', () => {
      expect(helpers.orange('text')).toBe(chalk.hex('#FC9900')('text'));
    });
  });

  describe('interpolate()', () => {
    it('should return the string unchanged when it has no placeholders', () => {
      expect(interpolate('plain text', {})).toBe('plain text');
    });

    it('should replace a placeholder with its value', () => {
      expect(interpolate('Hello {{ name }}!', { name: 'World' })).toBe(
        'Hello World!'
      );
    });

    it('should replace a placeholder that has no surrounding whitespace', () => {
      expect(interpolate('Hello {{name}}!', { name: 'World' })).toBe(
        'Hello World!'
      );
    });

    it('should replace multiple different placeholders', () => {
      expect(
        interpolate('{{ first }} and {{ second }}', {
          first: 'one',
          second: 'two',
        })
      ).toBe('one and two');
    });

    it('should replace every occurrence of a repeated placeholder', () => {
      expect(interpolate('{{ word }} {{ word }}', { word: 'echo' })).toBe(
        'echo echo'
      );
    });

    it('should stringify number values', () => {
      expect(interpolate('Account {{ id }}', { id: 123 })).toBe('Account 123');
    });

    it('should stringify boolean values', () => {
      expect(interpolate('Enabled: {{ flag }}', { flag: false })).toBe(
        'Enabled: false'
      );
    });

    it('should render undefined values as the string undefined', () => {
      expect(interpolate('Value: {{ missing }}', {})).toBe('Value: undefined');
    });

    it('should render null values as the string null', () => {
      expect(interpolate('Value: {{ empty }}', { empty: null })).toBe(
        'Value: null'
      );
    });

    it('should leave empty placeholders untouched', () => {
      expect(interpolate('Value: {{ }}', {})).toBe('Value: {{ }}');
    });

    it('should apply a helper to the text it wraps', () => {
      expect(interpolate('{{#bold}}text{{/bold}}', {})).toBe(
        chalk.bold('text')
      );
    });

    it('should apply a helper to interpolated values inside it', () => {
      expect(
        interpolate('{{#green}}Hello {{ name }}{{/green}}', { name: 'World' })
      ).toBe(chalk.reset.green('Hello World'));
    });

    it('should apply the same helper to multiple wrapped sections', () => {
      expect(interpolate('{{#red}}a{{/red}} {{#red}}b{{/red}}', {})).toBe(
        `${chalk.reset.red('a')} ${chalk.reset.red('b')}`
      );
    });

    it('should apply different helpers in the same string', () => {
      expect(interpolate('{{#bold}}a{{/bold}} {{#cyan}}b{{/cyan}}', {})).toBe(
        `${chalk.bold('a')} ${chalk.cyan('b')}`
      );
    });

    it('should not treat helper delimiters as interpolation identifiers', () => {
      expect(interpolate('{{#unknown}}text{{/unknown}}', {})).toBe(
        '{{#unknown}}text{{/unknown}}'
      );
    });
  });
});
