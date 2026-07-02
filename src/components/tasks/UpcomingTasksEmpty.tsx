/**
 * Shared empty state for the sidebar's time-based lists (upcoming tasks and
 * upcoming events). Follows the §4.7 pattern: an etched drawing of the filled
 * state, one Sentient voice line, one muted note. The etch and the aqua
 * "caught up" badge both read from theme tokens, so it holds up in light and
 * dark.
 */

import React from 'react';
import '@/styles/new-folder.css';

// The etched agenda: a day rail with three cleared slots, resolved by a soft
// aqua check. Purely decorative, so it stays out of the accessibility tree.
export const ScheduleEmptyArt: React.FC = () => (
  <svg
    className="schedule-empty-art"
    viewBox="0 0 128 100"
    role="img"
    aria-hidden="true"
    focusable="false"
  >
    <line
      className="schedule-empty-etch"
      x1="16"
      y1="20"
      x2="16"
      y2="84"
      strokeDasharray="3 5"
    />
    {[24, 52, 80].map((y) => (
      <g key={y}>
        <circle className="schedule-empty-tick" cx="16" cy={y} r="2.5" />
        <rect
          className="schedule-empty-etch"
          x="28"
          y={y - 9}
          width="56"
          height="18"
          rx="6"
          strokeDasharray="4 5"
        />
      </g>
    ))}
    <circle className="schedule-empty-badge" cx="108" cy="52" r="15" />
    <path className="schedule-empty-check" d="M101 52 l5 6 l10 -13" />
  </svg>
);

export interface UpcomingEmptyStateProps {
  /** Sentient voice line — one per surface. */
  voice: string;
  /** Muted Inter note beneath the voice line. */
  note: string;
  /** Optional asset override; defaults to the shared schedule etch. */
  art?: React.ReactNode;
}

export const UpcomingEmptyState: React.FC<UpcomingEmptyStateProps> = ({
  voice,
  note,
  art,
}) => (
  <div className="schedule-empty">
    {art ?? <ScheduleEmptyArt />}
    <p className="schedule-empty-voice">{voice}</p>
    <p className="schedule-empty-note">{note}</p>
  </div>
);

export default UpcomingEmptyState;
