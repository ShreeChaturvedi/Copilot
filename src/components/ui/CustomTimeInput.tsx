import * as React from 'react';
import { Clock } from 'lucide-react';
import { Input } from '@/components/ui/Input';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Button } from '@/components/ui/Button';

export function CustomTimeInput({
  value,
  onChange,
  className,
}: {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  className?: string;
}) {
  const [showPicker, setShowPicker] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const hourListRef = React.useRef<HTMLDivElement>(null);
  const minuteListRef = React.useRef<HTMLDivElement>(null);
  const [selectedHour, setSelectedHour] = React.useState<number>(12);
  const [selectedMinute, setSelectedMinute] = React.useState<number>(0);
  const [selectedPeriod, setSelectedPeriod] = React.useState<string>('AM');

  const handleIconClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setShowPicker(true);
  };

  const handleInputClick = (e: React.MouseEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (inputRef.current) {
      inputRef.current.select();
    }
  };

  React.useEffect(() => {
    if (!value) {
      setSelectedHour(12);
      setSelectedMinute(0);
      setSelectedPeriod('AM');
      return;
    }
    const [hours, minutes] = value.split(':').map(Number);
    const hour12 = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
    const period = hours >= 12 ? 'PM' : 'AM';
    setSelectedHour(hour12);
    setSelectedMinute(minutes);
    setSelectedPeriod(period);
  }, [value]);

  // On open, bring the currently-selected hour/minute into view so the wheel
  // doesn't start at 00 when editing e.g. 09:45. Respects reduced motion.
  React.useEffect(() => {
    if (!showPicker) return;
    const prefersReduced =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const behavior: ScrollBehavior = prefersReduced ? 'auto' : 'smooth';
    const raf = requestAnimationFrame(() => {
      hourListRef.current
        ?.querySelector('[data-selected="true"]')
        ?.scrollIntoView({ block: 'center', behavior });
      minuteListRef.current
        ?.querySelector('[data-selected="true"]')
        ?.scrollIntoView({ block: 'center', behavior });
    });
    return () => cancelAnimationFrame(raf);
  }, [showPicker]);

  const handlePeriodSelect = (period: string) => setSelectedPeriod(period);

  // Serialize an explicit hour(24)/minute pair and notify the parent. Taking
  // explicit args means callers never depend on not-yet-flushed state.
  const commitTime = React.useCallback(
    (hour24: number, minute: number) => {
      const timeString = `${hour24.toString().padStart(2, '0')}:${minute
        .toString()
        .padStart(2, '0')}`;
      const syntheticEvent = {
        target: { value: timeString },
      } as React.ChangeEvent<HTMLInputElement>;
      onChange(syntheticEvent);
      setShowPicker(false);
    },
    [onChange]
  );

  const handleConfirm = () => {
    const hour24 =
      selectedPeriod === 'AM'
        ? selectedHour === 12
          ? 0
          : selectedHour
        : selectedHour === 12
          ? 12
          : selectedHour + 12;
    commitTime(hour24, selectedMinute);
  };

  // Arrow-key navigation within a scroll column: move focus to the adjacent
  // option button. Enter/Space activation comes free from native <button>.
  const handleColumnKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    const options = Array.from(
      e.currentTarget.querySelectorAll<HTMLButtonElement>('[role="option"]')
    );
    const idx = options.indexOf(document.activeElement as HTMLButtonElement);
    if (idx === -1) return;
    e.preventDefault();
    const nextIdx =
      e.key === 'ArrowDown'
        ? Math.min(options.length - 1, idx + 1)
        : Math.max(0, idx - 1);
    options[nextIdx]?.focus();
    options[nextIdx]?.scrollIntoView({ block: 'nearest' });
  };

  const hours = Array.from({ length: 12 }, (_, i) => i + 1);
  const minutes = Array.from({ length: 60 }, (_, i) => i);

  return (
    <div className="relative">
      <Input
        ref={inputRef}
        type="time"
        value={value}
        onChange={onChange}
        onClick={handleInputClick}
        className={`pr-8 [&::-webkit-calendar-picker-indicator]:hidden ${className || ''}`}
      />
      <Popover open={showPicker} onOpenChange={setShowPicker} modal={true}>
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label="Open time picker"
            onClick={handleIconClick}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-accent hover:text-accent-foreground rounded-sm transition-colors z-10 outline-none focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-1"
          >
            <Clock className="h-4 w-4 text-muted-foreground" />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <div className="p-4">
            <div className="flex gap-1">
              <div className="relative">
                <div className="text-xs text-muted-foreground text-center mb-1">
                  Hour
                </div>
                <div className="h-32 w-16 rounded border border-border relative overflow-hidden">
                  <div className="absolute top-0 left-0 right-0 h-4 bg-gradient-to-b from-popover to-transparent pointer-events-none z-10" />
                  <div className="absolute bottom-0 left-0 right-0 h-4 bg-gradient-to-t from-popover to-transparent pointer-events-none z-10" />
                  <div
                    ref={hourListRef}
                    role="listbox"
                    aria-label="Hour"
                    onKeyDown={handleColumnKeyDown}
                    className="h-full w-full scrollbar-hide"
                    style={{
                      overflowY: 'scroll',
                      overflowX: 'hidden',
                      touchAction: 'pan-y',
                    }}
                  >
                    {hours.map((hour) => {
                      const isSelected = selectedHour === hour;
                      return (
                        <button
                          key={hour}
                          type="button"
                          role="option"
                          aria-selected={isSelected}
                          data-selected={isSelected}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedHour(hour);
                          }}
                          className={`w-full px-2 py-2 text-sm transition-colors flex items-center justify-center cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                            isSelected
                              ? 'bg-primary text-primary-foreground'
                              : 'hover:bg-accent'
                          }`}
                          style={{ height: '32px', minHeight: '32px' }}
                        >
                          {hour}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="relative">
                <div className="text-xs text-muted-foreground text-center mb-1">
                  Min
                </div>
                <div className="h-32 w-16 rounded border border-border relative overflow-hidden">
                  <div className="absolute top-0 left-0 right-0 h-4 bg-gradient-to-b from-popover to-transparent pointer-events-none z-10" />
                  <div className="absolute bottom-0 left-0 right-0 h-4 bg-gradient-to-t from-popover to-transparent pointer-events-none z-10" />
                  <div
                    ref={minuteListRef}
                    role="listbox"
                    aria-label="Minute"
                    onKeyDown={handleColumnKeyDown}
                    className="h-full w-full scrollbar-hide"
                    style={{
                      overflowY: 'scroll',
                      overflowX: 'hidden',
                      touchAction: 'pan-y',
                    }}
                  >
                    {minutes.map((minute) => {
                      const isSelected = selectedMinute === minute;
                      return (
                        <button
                          key={minute}
                          type="button"
                          role="option"
                          aria-selected={isSelected}
                          data-selected={isSelected}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedMinute(minute);
                          }}
                          className={`w-full px-2 py-2 text-sm transition-colors flex items-center justify-center cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                            isSelected
                              ? 'bg-primary text-primary-foreground'
                              : 'hover:bg-accent'
                          }`}
                          style={{ height: '32px', minHeight: '32px' }}
                        >
                          {minute.toString().padStart(2, '0')}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="relative">
                <div className="text-xs text-muted-foreground text-center mb-1">
                  Period
                </div>
                <div
                  role="listbox"
                  aria-label="AM or PM"
                  className="h-32 w-16 rounded border border-border relative flex flex-col"
                >
                  {['AM', 'PM'].map((period) => {
                    const isSelected = selectedPeriod === period;
                    return (
                      <button
                        key={period}
                        type="button"
                        role="option"
                        aria-selected={isSelected}
                        onClick={(e) => {
                          e.stopPropagation();
                          handlePeriodSelect(period);
                        }}
                        className={`flex-1 px-2 py-4 text-sm transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                          isSelected
                            ? 'bg-primary text-primary-foreground'
                            : 'hover:bg-accent'
                        }`}
                      >
                        {period}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="flex justify-between items-center mt-3">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  // Compute from `now` directly so the emitted value is current
                  // (state setters below only update the visible wheels).
                  const now = new Date();
                  const currentHour = now.getHours();
                  const currentMinute = now.getMinutes();
                  const hour12 =
                    currentHour === 0
                      ? 12
                      : currentHour > 12
                        ? currentHour - 12
                        : currentHour;
                  const period = currentHour >= 12 ? 'PM' : 'AM';
                  setSelectedHour(hour12);
                  setSelectedMinute(currentMinute);
                  setSelectedPeriod(period);
                  commitTime(currentHour, currentMinute);
                }}
              >
                Now
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={handleConfirm}
                className="px-4"
              >
                Confirm
              </Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

export default CustomTimeInput;
