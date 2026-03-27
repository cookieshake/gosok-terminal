# xterm.js Korean IME Issues - Research Findings

## Issue 1: Special character swallowed after Korean composition

### Root Cause

When typing Korean (e.g. "한글") followed by a special character like `.`, `?`, `!`:

1. Korean IME is in composition mode (compositionstart fired)
2. User presses `.` which:
   - **Chrome**: fires `keydown` with `isComposing=true` and `key='.'`, then `compositionend`, then `input`
   - **Safari**: fires `compositionend` first, then `keydown` (reversed order!)
3. xterm.js's `CompositionHelper.keydown()` sees the keydown during composition and calls `_finalizeComposition(false)`, which sends the composed Korean text immediately
4. But the `.` character's keydown event gets consumed (returns false from the handler) because `isComposing` was still true when it fired

The core problem is that when a non-composition character (like `.`) ends the composition, browsers differ in event ordering, and xterm.js's internal `_handleAnyTextareaChanges()` method (called for keyCode 229) sometimes fails to pick up the special character.

### Solution (already partially implemented in gosok-terminal)

The current implementation in `TerminalPane.tsx` (lines 170-232) uses:

1. `attachCustomKeyEventHandler` to block keyCode 229 and capture single printable chars during composition into `pendingChar`
2. `compositionend` listener (with `capture: true`) to send the pending char after the composed text
3. `Promise.resolve().then()` for Chrome to defer the pending char send (so Korean char goes first)
4. Direct send for Safari (since compositionend fires before keydown there)

### Potential improvements

The current implementation may have edge cases. A more robust approach based on the xterm.js `CompositionHelper.ts` source analysis:

```typescript
// In the customKeyEventHandler:
terminal.attachCustomKeyEventHandler((event) => {
  // Always block the virtual composition key
  if (event.keyCode === 229) return false;

  // During composition, capture printable chars that end composition
  if (event.isComposing) {
    if (event.type === 'keydown' && event.key.length === 1) {
      pendingChar = event.key;
    }
    return false;
  }
  return true;
});
```

For the compositionend handler, using a microtask (Promise.resolve) is correct for Chrome. For Safari, since compositionend fires before keydown, the pendingChar approach may not work reliably. Instead, Safari needs to listen for the `input` event that follows compositionend:

```typescript
// Safari-specific: listen for 'input' events right after compositionend
// to catch special characters that Safari delivers via input, not keydown
if (isSafari) {
  let justEndedComposition = false;

  textarea.addEventListener('compositionend', (e) => {
    imeComposing = false;
    justEndedComposition = true;
    const text = (e as CompositionEvent).data;
    if (text && ws.readyState === WebSocket.OPEN) {
      skipNextOnData = true;
      ws.send(encoder.encode(text));
    }
    // Reset flag after event loop completes
    setTimeout(() => { justEndedComposition = false; }, 0);
  }, { capture: true });

  textarea.addEventListener('input', (e) => {
    if (justEndedComposition && !imeComposing) {
      const inputEvent = e as InputEvent;
      if (inputEvent.inputType === 'insertText' && inputEvent.data) {
        // This is the special character typed right after composition
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(encoder.encode(inputEvent.data));
        }
      }
    }
  });
}
```

---

## Issue 2: Safari Korean composition doesn't work at all

### Root Cause (multiple factors)

**Factor A: Event order reversal in Safari**

Safari fires events in a different order than Chrome during IME composition:
- Chrome: `keydown (229)` -> `compositionstart` -> `compositionupdate` -> `compositionend` -> `keyup`
- Safari: `compositionend` -> `keydown` -> `keyup` (compositionend fires BEFORE keydown)

This means Safari's `keydown` event for characters that end composition arrives AFTER `compositionend`, causing xterm.js's internal handlers to misinterpret the sequence.

**Factor B: Safari shifted character / touch-typing bug (Issue #5374)**

In Safari (confirmed through v26.0.1), xterm.js has a bug where `onData` fires BEFORE `customKeyEvent`. This reversed order means:
- Characters processed via `onData` before the custom key event handler can intercept them
- When typing quickly (next key pressed before previous released), keystrokes are lost
- Shifted characters (like `#`, `@`) sometimes require double-pressing

This is an active, unresolved xterm.js bug.

**Factor C: textarea positioning**

If the xterm helper textarea (`xterm-helper-textarea`) is positioned outside the viewport (can happen after resize), Safari's IME may not attach to it properly. This was reported in Issue #3065.

### Workaround from Issue #5374 (confirmed working)

A user-contributed workaround that detects Safari's reversed event order:

```typescript
if (/Safari/.test(navigator.userAgent) && !/Chrome/.test(navigator.userAgent)) {
  let lastOnDataTime = 0;

  terminal.onData((data) => {
    lastOnDataTime = Date.now();
    // ... normal handling
  });

  terminal.attachCustomKeyEventHandler((e) => {
    // Skip modifier-only keys
    if ([16, 17, 18, 91, 93].includes(e.keyCode)) return true;

    if (e.key.length === 1 && e.type === 'keydown') {
      // If onData already fired (Safari's reversed order), the character
      // was already sent. If it hasn't fired within 50ms, send manually.
      if (Date.now() - lastOnDataTime > 50) {
        // onData didn't fire - manually send the character
        sendData(e.key);
      }
    }
    return true;
  });
}
```

### Comprehensive Safari IME fix

For gosok-terminal, the recommended approach combines:

1. **Manual composition handling**: Bypass xterm.js's composition system on Safari entirely
2. **Direct textarea event interception**: Listen to `compositionstart`, `compositionupdate`, `compositionend` and `input` events directly on the textarea
3. **Skip xterm's onData during composition**: Use the `skipNextOnData` pattern

```typescript
const isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);

if (isSafari && textarea) {
  let safariComposing = false;
  let safariSkipOnData = false;

  textarea.addEventListener('compositionstart', () => {
    safariComposing = true;
  });

  textarea.addEventListener('compositionend', (e) => {
    safariComposing = false;
    const text = (e as CompositionEvent).data;
    if (text && ws.readyState === WebSocket.OPEN) {
      safariSkipOnData = true;
      ws.send(encoder.encode(text));
    }
  }, { capture: true });

  // Catch special characters typed immediately after composition ends
  textarea.addEventListener('input', (e) => {
    if (!safariComposing) {
      const ie = e as InputEvent;
      if (ie.inputType === 'insertText' && ie.data && !ie.isComposing) {
        // Check if this is a post-composition special char
        // that xterm might miss due to event ordering
      }
    }
  });

  terminal.onData((data) => {
    if (safariComposing) return; // block during composition
    if (safariSkipOnData) {
      safariSkipOnData = false;
      return;
    }
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(encoder.encode(data));
    }
  });
}
```

---

## Key References

### xterm.js Issues
- [#1939 - IME composition broken on OSX](https://github.com/xtermjs/xterm.js/issues/1939) - Fixed, was regression from #1849
- [#3679 - CJK IME (Sogou) input broken](https://github.com/xtermjs/xterm.js/issues/3679) - `input` event is the only reliable cross-platform event
- [#5374 - Cannot type shifted characters in Safari](https://github.com/xtermjs/xterm.js/issues/5374) - OPEN, confirmed in Safari 26.0.1, includes workaround
- [#3639 - Can't input text in Safari 15 with IME](https://github.com/xtermjs/xterm.js/issues/3639) - Closed as IME-specific
- [#3836 - Korean characters not combining on iPad](https://github.com/xtermjs/xterm.js/issues/3836) - OPEN
- [#3251 - Fix bug of some IMEs cannot input](https://github.com/xtermjs/xterm.js/pull/3251) - Fix: `min-width: 1px` on textarea

### xterm.js CompositionHelper.ts key insights
- `compositionend.data` is unreliable on Chromium
- Korean ending consonants can move to following character if next input is a vowel
- Uses `setTimeout(0)` to wait for textarea value to settle after compositionend
- Textarea must be at least 1x1 px or IMEs break (`Math.max(width, 1)`)
- `_handleAnyTextareaChanges()` handles non-composition chars (keyCode 229) during active IME

### Browser event order differences
- **Chrome**: `keydown(229)` -> `compositionend` -> `input`
- **Safari**: `compositionend` -> `keydown` -> `input` (REVERSED!)
- **Firefox/Safari**: emit `keyup` after `compositionend`; Chrome/Edge do not
- W3C spec Issue #202: event order between compositionend and input is not fully standardized

### Other projects' approaches
- **ProseMirror**: Uses `compositionEndedAt` timestamp to block keydown events that arrive within a few ms of compositionend (Safari fix)
- **VS Code terminal**: Uses xterm.js directly; same issues apply
- **Gemini CLI**: Forked Ink with `terminalCursorFocus`/`positionImeCursor` for IME cursor positioning

---

## Summary of recommended fixes for gosok-terminal

### Issue 1 (special char swallowed): Current implementation is on the right track

The existing code captures `pendingChar` during composition and sends it after `compositionend`. To make it more robust:

1. Consider also listening to the `input` event (with `inputType === 'insertText'`) as a fallback, since `input` is the most reliable cross-platform event per Issue #3679 findings
2. Add a small timestamp guard (a la ProseMirror) to avoid false positives

### Issue 2 (Safari composition broken): Needs the compositionend-first handling

Safari's reversed event order (compositionend before keydown) requires:

1. Manually sending composed text from `compositionend.data` on Safari
2. Suppressing the duplicate `onData` that xterm.js fires
3. Using the Issue #5374 workaround for shifted/special characters after composition
4. Ensuring the textarea stays within viewport bounds (Issue #3065)

The current implementation already handles most of this. The main remaining risk is edge cases with rapid typing and the `skipNextOnData` flag potentially getting out of sync.
