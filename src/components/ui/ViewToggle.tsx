import React from 'react';
import { Calendar, CheckSquare } from 'lucide-react';
import { SharedToggleButton, type ToggleOption } from '@/components/ui/SharedToggleButton';

export type ViewMode = 'calendar' | 'task';

interface ViewToggleProps {
  currentView: ViewMode;
  onToggle: (view: ViewMode) => void;
  className?: string;
  disabled?: boolean;
}

// Define view options with icons and labels (same as TaskControls pattern)
const VIEW_OPTIONS: ToggleOption<ViewMode>[] = [
  {
    value: 'calendar',
    label: 'Calendar',
    icon: Calendar,
  },
  {
    value: 'task',
    label: 'Tasks',
    icon: CheckSquare,
  },
];

export const ViewToggle: React.FC<ViewToggleProps> = ({
  currentView,
  onToggle,
  className,
  disabled = false
}) => {
  return (
    <SharedToggleButton
      currentValue={currentView}
      options={VIEW_OPTIONS}
      onValueChange={onToggle}
      className={className}
      disabled={disabled}
      size="sm"
      showLabels={true} // Show labels like TaskControls does
      showShortLabelsOnMobile={false}
    />
  );
};

export default ViewToggle;