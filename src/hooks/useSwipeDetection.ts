import { useState, TouchEvent, useRef, useCallback } from 'react';

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
  // Touch tracking state
  const [touchStartX, setTouchStartX] = useState(0);
  const [touchStartY, setTouchStartY] = useState(0);
  const [touchEndX, setTouchEndX] = useState(0);
  const [touchEndY, setTouchEndY] = useState(0);

  // Simple debounce for wheel events
  const lastWheelTime = useRef(0);

  const minSwipeDistance = 50;
  const wheelDebounceMs = 300;

  const onTouchStart = (e: TouchEvent) => {
    setTouchEndX(0);
    setTouchEndY(0);
    setTouchStartX(e.targetTouches[0].clientX);
    setTouchStartY(e.targetTouches[0].clientY);
  };

  const onTouchMove = (e: TouchEvent) => {
    setTouchEndX(e.targetTouches[0].clientX);
    setTouchEndY(e.targetTouches[0].clientY);
  };

  const onTouchEnd = () => {
    if (!touchStartX || !touchEndX) return;
    
    const distanceX = touchStartX - touchEndX;
    const distanceY = Math.abs(touchStartY - touchEndY);
    
    const isLeftSwipe = distanceX > minSwipeDistance;
    const isRightSwipe = distanceX < -minSwipeDistance;

    // Only detect swipe if horizontal movement > vertical movement
    if (isLeftSwipe && Math.abs(distanceX) > distanceY) {
      input.onSwipedLeft();
    }
    if (isRightSwipe && Math.abs(distanceX) > distanceY) {
      input.onSwipedRight();
    }
  };

  const onWheel = useCallback((e: WheelEvent) => {
    const now = Date.now();
    
    // Simple debounce to prevent multiple rapid triggers
    if (now - lastWheelTime.current < wheelDebounceMs) {
      return;
    }

    // Only handle horizontal wheel events (trackpad horizontal swipes)
    if (Math.abs(e.deltaX) > Math.abs(e.deltaY) && Math.abs(e.deltaX) > 10) {
      e.preventDefault();
      e.stopPropagation();
      
      lastWheelTime.current = now;
      
      if (e.deltaX > 0) {
        input.onSwipedLeft(); // Swipe left = next
      } else {
        input.onSwipedRight(); // Swipe right = prev
      }
    }
  }, [input, wheelDebounceMs]);

  return {
    onTouchStart,
    onTouchMove,
    onTouchEnd,
    onWheel
  };
};