import { TouchEvent, useRef, useCallback } from 'react';

interface SwipeInput {
  onSwipedLeft: () => void;
  onSwipedRight: () => void;
}

interface SwipeOutput {
  onTouchStart: (e: TouchEvent) => void;
  onTouchMove: (e: TouchEvent) => void;
  onTouchEnd: () => void;
  onWheel: (e: WheelEvent) => void;
}

/**
 * Simple swipe detection hook based on Stack Overflow solutions
 * Supports both touch devices (mobile) and trackpad (desktop)
 */
export const useSwipeDetection = (input: SwipeInput): SwipeOutput => {
  // Touch tracking in refs — these are only read in onTouchEnd, so updating
  // them per touch-move frame must never trigger a re-render of the caller.
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const touchEndX = useRef(0);
  const touchEndY = useRef(0);

  // Simple debounce for wheel events
  const lastWheelTime = useRef(0);

  const minSwipeDistance = 50;
  const wheelDebounceMs = 300;

  const onTouchStart = useCallback((e: TouchEvent) => {
    touchEndX.current = 0;
    touchEndY.current = 0;
    touchStartX.current = e.targetTouches[0].clientX;
    touchStartY.current = e.targetTouches[0].clientY;
  }, []);

  const onTouchMove = useCallback((e: TouchEvent) => {
    touchEndX.current = e.targetTouches[0].clientX;
    touchEndY.current = e.targetTouches[0].clientY;
  }, []);

  const onTouchEnd = useCallback(() => {
    if (!touchStartX.current || !touchEndX.current) return;

    const distanceX = touchStartX.current - touchEndX.current;
    const distanceY = Math.abs(touchStartY.current - touchEndY.current);

    const isLeftSwipe = distanceX > minSwipeDistance;
    const isRightSwipe = distanceX < -minSwipeDistance;

    // Only detect swipe if horizontal movement > vertical movement
    if (isLeftSwipe && Math.abs(distanceX) > distanceY) {
      input.onSwipedLeft();
    }
    if (isRightSwipe && Math.abs(distanceX) > distanceY) {
      input.onSwipedRight();
    }
  }, [input]);

  const onWheel = useCallback(
    (e: WheelEvent) => {
      const now = Date.now();

      // Simple debounce to prevent multiple rapid triggers
      if (now - lastWheelTime.current < wheelDebounceMs) {
        return;
      }

      // Only navigate on a deliberate horizontal fling: the delta must be
      // large AND decisively dominate the vertical component, so a slightly
      // diagonal two-finger scroll never hijacks the period (#17/#20/#32).
      if (
        Math.abs(e.deltaX) > 60 &&
        Math.abs(e.deltaX) > Math.abs(e.deltaY) * 2.5
      ) {
        e.preventDefault();
        e.stopPropagation();

        lastWheelTime.current = now;

        if (e.deltaX > 0) {
          input.onSwipedLeft(); // Swipe left = next
        } else {
          input.onSwipedRight(); // Swipe right = prev
        }
      }
    },
    [input]
  );

  return {
    onTouchStart,
    onTouchMove,
    onTouchEnd,
    onWheel,
  };
};
