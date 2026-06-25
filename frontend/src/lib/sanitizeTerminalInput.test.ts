import { describe, it, expect } from 'vitest';
import { sanitizeTerminalInput } from './sanitizeTerminalInput';

const ESC = '\x1b';

describe('sanitizeTerminalInput', () => {
  it('strips a single corrupt SGR wheel report', () => {
    expect(sanitizeTerminalInput(`${ESC}[<64;NaN;NaNM`)).toBe('');
  });

  it('strips repeated corrupt reports (the observed scroll garbage)', () => {
    const garbage = `${ESC}[<64;NaN;NaNM`.repeat(5);
    expect(sanitizeTerminalInput(garbage)).toBe('');
  });

  it('strips wheel-down (button 65) and release (lowercase m) variants', () => {
    expect(sanitizeTerminalInput(`${ESC}[<65;NaN;NaNM`)).toBe('');
    expect(sanitizeTerminalInput(`${ESC}[<0;NaN;NaNm`)).toBe('');
  });

  it('strips a corrupt report mixed with surrounding valid input', () => {
    expect(sanitizeTerminalInput(`a${ESC}[<64;NaN;NaNMb`)).toBe('ab');
  });

  it('leaves a valid SGR mouse report untouched', () => {
    const valid = `${ESC}[<64;10;20M`;
    expect(sanitizeTerminalInput(valid)).toBe(valid);
  });

  it('leaves literal user-typed "NaN" text untouched', () => {
    expect(sanitizeTerminalInput('NaN')).toBe('NaN');
    expect(sanitizeTerminalInput('parseInt returned NaN here')).toBe('parseInt returned NaN here');
  });

  it('returns ordinary keystrokes unchanged', () => {
    expect(sanitizeTerminalInput('ls -la\r')).toBe('ls -la\r');
  });
});
