import { useEffect, type RefObject } from 'react';
import type { Terminal } from '@xterm/xterm';

interface UseMobileKeyboardArgs {
  containerRef: RefObject<HTMLDivElement | null>;
  terminalRef: RefObject<Terminal | null>;
}

/**
 * iOS Safari requires focus() to happen inside a user-gesture handler to pop
 * the virtual keyboard. Blur on touchstart so a subsequent scroll gesture
 * cannot re-open the keyboard via the still-focused textarea (which iOS does
 * after the user manually dismisses); re-focus on touchend only if the finger
 * barely moved (a tap).
 */
export function useMobileKeyboard({ containerRef, terminalRef }: UseMobileKeyboardArgs) {
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let touchStartX = 0;
    let touchStartY = 0;
    const onTouchStart = (e: TouchEvent) => {
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
      terminalRef.current?.textarea?.blur();
    };
    const onTouchEnd = (e: TouchEvent) => {
      const t = e.changedTouches[0];
      if (Math.abs(t.clientX - touchStartX) < 5 && Math.abs(t.clientY - touchStartY) < 5) {
        terminalRef.current?.textarea?.focus();
      }
    };
    container.addEventListener('touchstart', onTouchStart, { passive: true });
    container.addEventListener('touchend', onTouchEnd, { passive: true });

    return () => {
      container.removeEventListener('touchstart', onTouchStart);
      container.removeEventListener('touchend', onTouchEnd);
    };
  }, [containerRef, terminalRef]);
}
