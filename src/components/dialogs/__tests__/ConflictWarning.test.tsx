import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ConflictWarning } from '../ConflictWarning';
import type { EventConflict } from '@/services/api';

const conflict = (
  id: string,
  title: string,
  calendarName: string
): EventConflict =>
  ({
    conflictingEvent: {
      id,
      title,
      calendarName,
      start: new Date('2026-07-10T10:00:00Z'),
      end: new Date('2026-07-10T11:00:00Z'),
      allDay: false,
    },
    overlapStart: new Date('2026-07-10T10:00:00Z'),
    overlapEnd: new Date('2026-07-10T11:00:00Z'),
    overlapDuration: 60,
  }) as unknown as EventConflict;

describe('ConflictWarning (#41)', () => {
  it('renders nothing when there are no conflicts', () => {
    const { container } = render(<ConflictWarning conflicts={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('names the calendar each conflicting event belongs to', () => {
    const conflicts = [
      conflict('e1', 'Dentist', 'Personal'),
      conflict('e2', 'Standup', 'Work'),
    ];

    render(<ConflictWarning conflicts={conflicts} />);

    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(
      screen.getByText('This time overlaps 2 existing events')
    ).toBeInTheDocument();
    expect(screen.getByText('Dentist')).toBeInTheDocument();
    expect(screen.getByText('Standup')).toBeInTheDocument();
    // Each conflict is attributed to the calendar it lives on.
    expect(screen.getByText(/Personal/)).toBeInTheDocument();
    expect(screen.getByText(/Work/)).toBeInTheDocument();
  });
});
