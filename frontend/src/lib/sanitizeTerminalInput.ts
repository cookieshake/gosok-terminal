// Guards the PTY-bound input stream against a known xterm.js bug: on mobile,
// when an application has mouse tracking enabled (DECSET 1000/1002/1003 + 1006),
// momentum/inertia touch scrolling fires gesture events without clientX/clientY.
// xterm's _handleTouchScrollAsWheel then computes mouse-report coordinates as
// NaN and emits SGR sequences like `\x1b[<64;NaN;NaNM` repeatedly. The receiving
// program's line editor swallows `\x1b[<64;N` as an (invalid) CSI and inserts the
// trailing `aN;NaNM` as literal text, garbling the prompt.
//
// We strip these malformed SGR mouse reports at the I/O boundary. The match is
// anchored on the `\x1b[<` … NaN … `M`/`m` shape, so legitimate user input that
// merely contains the text "NaN" is never affected.
// eslint-disable-next-line no-control-regex -- ESC (0x1b) is the required CSI prefix
const CORRUPT_SGR_MOUSE = /\x1b\[<[\d;]*(?:NaN[\d;]*)+[Mm]/g;

export function sanitizeTerminalInput(data: string): string {
  if (!data.includes('NaN')) return data;
  return data.replace(CORRUPT_SGR_MOUSE, '');
}
