import { useEffect, type RefObject } from 'react';
import type { Terminal } from '@xterm/xterm';

type Modifier = 'ctrl' | 'alt' | 'shift' | null;

interface UseKeyboardModifierArgs {
  terminalRef: RefObject<Terminal | null>;
  activeModifier?: Modifier;
  onModifierUsed?: () => void;
  sendData: (data: string) => void;
}

/**
 * Routes a single A–Z keypress through the active modifier (Ctrl/Alt) when the
 * external modifier toolbar arms one. Mounts a capture-phase keydown listener
 * on xterm's textarea so we run before xterm's own handlers; bails on IME
 * composition (keyCode 229) and on Shift (no transform needed).
 */
export function useKeyboardModifier({
  terminalRef,
  activeModifier,
  onModifierUsed,
  sendData,
}: UseKeyboardModifierArgs) {
  useEffect(() => {
    if (!activeModifier || activeModifier === 'shift') return;
    const textarea = terminalRef.current?.textarea;
    if (!textarea) return;

    const handler = (e: KeyboardEvent) => {
      if (e.isComposing || e.keyCode === 229) return;
      const key = e.key.toLowerCase();
      if (key.length !== 1 || key < 'a' || key > 'z') return;

      e.preventDefault();
      e.stopImmediatePropagation();

      const data = activeModifier === 'ctrl'
        ? String.fromCharCode(key.charCodeAt(0) - 96)
        : '\x1b' + key;

      sendData(data);
      onModifierUsed?.();
    };

    textarea.addEventListener('keydown', handler, { capture: true });
    return () => textarea.removeEventListener('keydown', handler, { capture: true });
  }, [terminalRef, activeModifier, onModifierUsed, sendData]);
}
