import * as React from 'react';
import { Clock } from 'lucide-react';
import { Input } from '@/components/ui/Input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
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

  const handleHourSelect = (hour: number) => setSelectedHour(hour);
  const handleMinuteSelect = (minute: number) => setSelectedMinute(minute);
  const handlePeriodSelect = (period: string) => setSelectedPeriod(period);

  const handleConfirm = () => {
    const hour24 = selectedPeriod === 'AM'
      ? (selectedHour === 12 ? 0 : selectedHour)
      : (selectedHour === 12 ? 12 : selectedHour + 12);
    const timeString = `${hour24.toString().padStart(2, '0')}:${selectedMinute
      .toString()
      .padStart(2, '0')}`;
    const syntheticEvent = {
      target: { value: timeString },
    } as React.ChangeEvent<HTMLInputElement>;
    onChange(syntheticEvent);
    setShowPicker(false);
  };

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
            onClick={handleIconClick}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-accent hover:text-accent-foreground rounded-sm transition-colors z-10"
          >
            <Clock className="h-4 w-4 text-muted-foreground" />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <div className="p-4">
            <div className="flex gap-1">
              <div className="relative">
                <div className="text-xs text-muted-foreground text-center mb-1">Hour</div>
                <div className="h-32 w-16 rounded border border-border relative overflow-hidden">
                  <div className="absolute top-0 left-0 right-0 h-4 bg-gradient-to-b from-popover to-transparent pointer-events-none z-10" />
                  <div className="absolute bottom-0 left-0 right-0 h-4 bg-gradient-to-t from-popover to-transparent pointer-events-none z-10" />
                  <div
                    className="h-full w-full scrollbar-hide"
                    style={{ overflowY: 'scroll', overflowX: 'hidden', touchAction: 'pan-y' }}
                  >
                    {Array.from({ length: 12 }, (_, i) => i + 1).map((hour) => (
                      <div
                        key={hour}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleHourSelect(hour);
                        }}
                        className={`w-full px-2 py-2 text-sm transition-colors flex items-center justify-center cursor-pointer ${
                          selectedHour === hour ? 'bg-primary text-primary-foreground' : 'hover:bg-accent'
                        }`}
                        style={{ height: '32px', minHeight: '32px' }}
                      >
                        {hour}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="relative">
                <div className="text-xs text-muted-foreground text-center mb-1">Min</div>
                <div className="h-32 w-16 rounded border border-border relative overflow-hidden">
                  <div className="absolute top-0 left-0 right-0 h-4 bg-gradient-to-b from-popover to-transparent pointer-events-none z-10" />
                  <div className="absolute bottom-0 left-0 right-0 h-4 bg-gradient-to-t from-popover to-transparent pointer-events-none z-10" />
                  <div
                    className="h-full w-full scrollbar-hide"
                    style={{ overflowY: 'scroll', overflowX: 'hidden', touchAction: 'pan-y' }}
                  >
                    {Array.from({ length: 60 }, (_, i) => i).map((minute) => (
                      <div
                        key={minute}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleMinuteSelect(minute);
                        }}
                        className={`w-full px-2 py-2 text-sm transition-colors flex items-center justify-center cursor-pointer ${
                          selectedMinute === minute ? 'bg-primary text-primary-foreground' : 'hover:bg-accent'
                        }`}
                        style={{ height: '32px', minHeight: '32px' }}
                      >
                        {minute.toString().padStart(2, '0')}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="relative">
                <div className="text-xs text-muted-foreground text-center mb-1">Period</div>
                <div className="h-32 w-16 rounded border border-border relative flex flex-col">
                  {['AM', 'PM'].map((period) => (
                    <button
                      key={period}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handlePeriodSelect(period);
                      }}
                      className={`flex-1 px-2 py-4 text-sm transition-colors ${
                        selectedPeriod === period ? 'bg-primary text-primary-foreground' : 'hover:bg-accent'
                      }`}
                    >
                      {period}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex justify-between items-center mt-3">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  const now = new Date();
                  const currentHour = now.getHours();
                  const currentMinute = now.getMinutes();
                  const hour12 = currentHour === 0 ? 12 : currentHour > 12 ? currentHour - 12 : currentHour;
                  const period = currentHour >= 12 ? 'PM' : 'AM';
                  setSelectedHour(hour12);
                  setSelectedMinute(currentMinute);
                  setSelectedPeriod(period);
                  handleConfirm();
                }}
              >
                Now
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={handleConfirm} className="p-2">
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


