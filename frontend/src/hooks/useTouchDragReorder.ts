import { useRef, useCallback } from 'react';

/**
 * Provides touch-based drag-to-reorder for lists on mobile.
 * Returns touch event handlers to spread onto each draggable item.
 */
export function useTouchDragReorder<T extends { id: string }>(
  items: T[],
  onReorder: (ids: string[]) => void,
) {
  const dragId = useRef<string | null>(null);
  const startY = useRef(0);
  const startX = useRef(0);
  const isDragging = useRef(false);
  const containerRef = useRef<HTMLElement | null>(null);

  const getTouchHandlers = useCallback((id: string) => ({
    onTouchStart: (e: React.TouchEvent) => {
      const touch = e.touches[0];
      dragId.current = id;
      startY.current = touch.clientY;
      startX.current = touch.clientX;
      isDragging.current = false;
      containerRef.current = e.currentTarget.parentElement;
    },
    onTouchMove: (e: React.TouchEvent) => {
      if (dragId.current !== id) return;
      const touch = e.touches[0];
      const dx = Math.abs(touch.clientX - startX.current);
      const dy = Math.abs(touch.clientY - startY.current);

      if (!isDragging.current) {
        if (dy > 10 && dy > dx) {
          isDragging.current = true;
        } else {
          return;
        }
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
      dragId.current = null;
      isDragging.current = false;
    },
  }), [items, onReorder]);

  return { getTouchHandlers };
}
