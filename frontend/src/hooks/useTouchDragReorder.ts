import { useRef, useCallback, useState } from 'react';

const LONG_PRESS_MS = 300;

/**
 * Provides touch-based drag-to-reorder for lists on mobile.
 * Requires a long-press to activate drag, so normal scrolling is not interrupted.
 * Returns touch event handlers and the currently-dragging item id for visual feedback.
 */
export function useTouchDragReorder<T extends { id: string }>(
  items: T[],
  onReorder: (ids: string[]) => void,
) {
  const dragId = useRef<string | null>(null);
  const startY = useRef(0);
  const startX = useRef(0);
  const isDragging = useRef(false);
  const longPressReady = useRef(false);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLElement | null>(null);
  const dragElementRef = useRef<HTMLElement | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);

  const clearTimer = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  };

  const getTouchHandlers = useCallback((id: string) => ({
    onTouchStart: (e: React.TouchEvent) => {
      const touch = e.touches[0];
      dragId.current = id;
      startY.current = touch.clientY;
      startX.current = touch.clientX;
      isDragging.current = false;
      longPressReady.current = false;
      containerRef.current = e.currentTarget.parentElement;
      dragElementRef.current = e.currentTarget as HTMLElement;

      clearTimer();
      longPressTimer.current = setTimeout(() => {
        longPressReady.current = true;
        setDraggingId(id);
        // Haptic feedback if available
        if (navigator.vibrate) navigator.vibrate(30);
      }, LONG_PRESS_MS);
    },
    onTouchMove: (e: React.TouchEvent) => {
      if (dragId.current !== id) return;
      const touch = e.touches[0];
      const dx = Math.abs(touch.clientX - startX.current);
      const dy = Math.abs(touch.clientY - startY.current);

      // Cancel long-press if finger moved before timer fired
      if (!longPressReady.current && (dx > 8 || dy > 8)) {
        clearTimer();
        dragId.current = null;
        return;
      }

      if (!longPressReady.current) return;

      if (!isDragging.current) {
        isDragging.current = true;
      }

      e.preventDefault();

      // Find which element we're over
      if (!containerRef.current) return;
      const children = Array.from(containerRef.current.children) as HTMLElement[];
      for (const child of children) {
        const rect = child.getBoundingClientRect();
        if (touch.clientY >= rect.top && touch.clientY <= rect.bottom) {
          const overId = items.find((_, idx) => children[idx] === child)?.id;
          if (overId && overId !== dragId.current) {
            const ids = items.map(x => x.id);
            const from = ids.indexOf(dragId.current!);
            const to = ids.indexOf(overId);
            ids.splice(from, 1);
            ids.splice(to, 0, dragId.current!);
            onReorder(ids);
          }
          break;
        }
      }
    },
    onTouchEnd: () => {
      clearTimer();
      dragId.current = null;
      isDragging.current = false;
      longPressReady.current = false;
      setDraggingId(null);
    },
  }), [items, onReorder]);

  return { getTouchHandlers, draggingId };
}
