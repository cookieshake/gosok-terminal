import { useEffect, type RefObject } from 'react';
import type { Terminal } from '@xterm/xterm';

interface UseKoreanIMEArgs {
  containerRef: RefObject<HTMLDivElement | null>;
  terminalRef: RefObject<Terminal | null>;
  /** Send raw bytes to the PTY. Returns true if the WS was OPEN and the send went through. */
  send: (data: string) => boolean;
}

const isKorean = (s: string | null) =>
  s != null && /[ᄀ-ᇿ㄰-㆏ꥠ-꥿가-힣ힰ-퟿]/.test(s);

const isModifierKey = (kc: number) =>
  kc === 16 || kc === 17 || kc === 18 || kc === 20 || kc === 91 || kc === 93;

/**
 * Safari (desktop + iOS) does not fire compositionstart/compositionend for
 * Korean IME the way Chrome/Firefox do, so xterm.js's built-in composition
 * handling never engages and partially-composed jamo leak straight to the
 * PTY. Intercept `input` events on the helper textarea: stream completed
 * syllables to the WS as they finalize, and render the in-progress jamo in
 * xterm's .composition-view overlay positioned at the cursor cell.
 *
 * Non-Safari browsers: this hook is a no-op (early return).
 */
export function useKoreanIME({ containerRef, terminalRef, send }: UseKoreanIMEArgs) {
  useEffect(() => {
    const container = containerRef.current;
    const terminal = terminalRef.current;
    if (!container || !terminal) return;

    const isSafari = /Safari/i.test(navigator.userAgent) && !/Chrome/i.test(navigator.userAgent);
    if (!isSafari || !terminal.textarea) return;

    const ta = terminal.textarea;
    const helpers = ta.parentElement;
    const compView = container.querySelector<HTMLElement>('.composition-view');
    let imeActive = false;
    let preImeValue = '';
    let pendingSent = 0;

    const showComp = (text: string) => {
      if (!compView) return;
      compView.textContent = text;
      compView.classList.add('active');
      const screen = container.querySelector<HTMLElement>('.xterm-screen');
      if (screen) {
        const cellW = screen.clientWidth / terminal.cols;
        const cellH = screen.clientHeight / terminal.rows;
        const buf = terminal.buffer.active;
        compView.style.left = `${(buf.cursorX + pendingSent * 2) * cellW}px`;
        compView.style.top = `${buf.cursorY * cellH}px`;
        compView.style.height = `${cellH}px`;
        compView.style.lineHeight = `${cellH}px`;
        compView.style.fontSize = `${terminal.options.fontSize}px`;
      }
    };
    const hideComp = () => {
      if (!compView) return;
      compView.textContent = '';
      compView.classList.remove('active');
    };
    const flushCompleted = () => {
      const full = ta.value.slice(preImeValue.length);
      const completed = full.slice(0, -1);
      if (completed && send(completed)) {
        pendingSent += [...completed].length;
        preImeValue += completed;
      }
    };
    const flushIme = () => {
      if (!imeActive) return;
      imeActive = false;
      hideComp();
      const composed = ta.value.slice(preImeValue.length);
      if (composed) send(composed);
      ta.value = '';
      preImeValue = '';
      pendingSent = 0;
    };

    const repositionListener = terminal.onWriteParsed(() => {
      if (imeActive && pendingSent > 0) {
        pendingSent = 0;
        if (compView?.textContent) showComp(compView.textContent);
      }
    });

    const onImeInput = (e: Event) => {
      const ie = e as InputEvent;
      if (ie.inputType === 'insertText' && isKorean(ie.data)) {
        if (!imeActive) {
          imeActive = true;
          preImeValue = ta.value.slice(0, ta.value.length - (ie.data?.length ?? 0));
          pendingSent = 0;
        } else {
          flushCompleted();
        }
        showComp(ie.data ?? '');
        e.stopPropagation();
      } else if (ie.inputType === 'insertReplacementText' && imeActive) {
        showComp(ie.data ?? '');
        e.stopPropagation();
      } else if (imeActive) {
        flushIme();
      }
    };
    const onImeKeydown = (e: KeyboardEvent) => {
      if (imeActive && (e.keyCode === 229 || isModifierKey(e.keyCode))) {
        e.stopPropagation();
      } else if (imeActive) {
        flushIme();
      }
    };

    helpers?.addEventListener('input', onImeInput, true);
    helpers?.addEventListener('keydown', onImeKeydown, true);

    return () => {
      helpers?.removeEventListener('input', onImeInput, true);
      helpers?.removeEventListener('keydown', onImeKeydown, true);
      repositionListener.dispose();
    };
  }, [containerRef, terminalRef, send]);
}
