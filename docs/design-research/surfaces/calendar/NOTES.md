# Calendar surface — SETTLE redesign evidence (issue #28)

Built 2026-07-02 against design-brief 4.4 on the live app (Vite :5187, dev API :3014), screenshotted headless at 1440x900 and 390x844 in both themes via the in-app toggle. Commits: 8658fe9 (#43 fix), de2592b (chips/today/now-line/annotations, closes #55), 950082d (header/switcher/keyboard).

## What landed

- Chips: 2.4 alpha-film formula via eventContent + eventDidMount (`--chip-c` per event, no inline colors). Light 12% film + 3px bar + sunk text; dark 24% film + 0.5px rim + lifted text. Mono `09:30` 11px then title 12/500. <30min and month bars single-line. All-day bars round terminating ends only. Past 55% + saturate(.65). Selected/drag/mirror solid + white. Legacy colors run the 9.3.3 guard in `src/utils/chipColor.ts` (fails -> ink text + 32% film, class `chip-guard`).
- New-chip settle-in (scale .97 + fade 240ms ease-settle + aqua rim flash) fires on the optimistic temp chip only; the real event replacing it registers a title+start signature and does not re-flash. Seen-ness is keyed on the MASTER event id and seeded from the full fetched list (not per-occurrence ids), so `key={slotMinTime}` remounts, view unmounts, and date navigation over recurring series are all idempotent. The first cut keyed on occurrence ids, so navigating to a new week/month minted unseen occurrence ids and replayed the flash on recurring chips only — fixed in the follow-up pass (see below).
- Today: aqua-film-04 wash on the week body column and month cell only (all-day lane, header, and Day view excluded), aqua-rim left/right rails, FIXED 24x24 disc with mono numeral in week/day/list headers, month cells, and the mini-month (ui/calendar.tsx). #55 dead in every view.
- Now-line: FC line re-skinned 2px aqua + 6px dot (dark adds 8px 25% glow), stock red arrow hidden. JS overlay in CalendarView adds the live gutter chip (11px mono aqua on canvas, hides any hour label within 14px) and the 1px 20% ghost across other days; one 60s interval, transform-only updates, re-anchored on datesSet.
- Dimension annotations: drag mirror renders `|-- N MIN --|` (SSM 11 aqua, tick-ended pseudo-element lines) beside the chip; resize renders live start/end pinned to top/bottom edges. External task drag-in gets the same annotation via the shared mirror path.
- Month: #43 root cause was FC's SYNTHETIC month-header dates formatted with local getters (UTC weekday shift + bogus numbers). Headers now use FC's own per-column text, weekday only. Day numbers 12px mono top-right, `+n more` 11px mono.
- Gutter 11px mono --faint `9 AM`, NOON kept; :30 lines at half hairline; weekend ink-2% wash.
- Header: month Sentient 400 18px + numerals Inter 13px muted baseline-aligned; ViewSwitcher on tokens with machined-keycap tooltips; Today chiclet + T keycap. Keys: T / D / W / M / L / arrows (inert in inputs and under overlays; `[data-kbd-nav]` suppresses the switcher slide per brief 5). Reduced motion: 120ms crossfade + 240ms static 20% ring.

## Evidence map

| File                                            | Proves                                                                                                                  |
| ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| calendar-week-{light,dark}-1440                 | chip formula both themes, today wash+rails+disc, now-line assembly, serif header, chiclets                              |
| calendar-month-{light,dark}-1440                | #43 alignment fix, mono day numbers, today disc, film bars, +n more                                                     |
| calendar-day-light-1440                         | NO wash in Day view, disc not squished (#55), gutter label occlusion at 10:00 exactly                                   |
| calendar-day-dark-1440                          | Day in dark: 24% film + rim chips, now-line dot glow, still no wash, disc correct                                       |
| calendar-list-{light,dark}-1440                 | list day headers with disc, 24h mono times, token rows, past rows dimmed, both themes                                   |
| drag-annotation-dark-1440                       | solid mirror + `\|-- 90 MIN --\|`                                                                                       |
| resize-annotation-dark-1440                     | live 13:00/15:30 pinned to chip edges                                                                                   |
| external-task-drag-dark-1440                    | task mirror in default calendar color + 60 MIN annotation (eventReceive dialog verified opening, prefilled)             |
| calendar-{week,month,day,list}-{light,dark}-390 | full 390 matrix (9.1): no overflow, short-label M/W/D/L switcher, chips/rows legible, Day gutter chip + now-line intact |

## Fix pass 2026-07-02 (review findings on #28)

- 9.1 evidence matrix completed: added calendar-day-dark-1440, calendar-day-{light,dark}-390, calendar-list-light-1440, calendar-list-{light,dark}-390, calendar-month-light-390. Every view is now shot at 1440 and 390 in both themes (16 files), themes via the app's persisted preference (server pref + class toggle, not OS).
- 4.4 idempotency deviation fixed in CalendarView.tsx: `isNewChip` was keyed on per-occurrence ids (`id::instanceKey`), and recurring occurrences are only expanded inside the visible range, so each date navigation minted unseen ids and replayed settle-in + rim flash on recurring chips (e.g. weekly Team Standup). Now keyed on the master event id, seeded post-commit from the FULL fetched list, so range-revealed occurrences are never "new"; only events created this session flash. Runtime-verified with a MutationObserver on `chip-enter`: 12 week navs + 4 month navs + D/W view switches with the weekly Team Standup visible = 0 flashes; creating an event = exactly 1 flash (the optimistic chip); navigating away/back after create = still 1.
- DB seeds had vanished again (see nit below); re-seeded the identical event/task set for the new shots (Team Standup is `RRULE:FREQ=WEEKLY;INTERVAL=1;BYDAY=WE` from 2026-06-24).

## Known nits (accepted, or for later passes)

- Grid hairlines and the now-ghost show through chip films (films are translucent by design; matches hairline behavior).
- Gutter chip time can lead FC's line position by <=1 min between FC's own indicator refreshes.
- On mobile FC's `dayMaxEvents` (auto) wins over `dayMaxEventRows=2`; tall 390 month cells show up to 4 bars, which reads fine.
- Sibling agents share the dev DB (`dev-user-id`); task seeds vanished mid-session once. Events used for shots: recon seeds + `Deep work` (Sun 14:00) + `Focus block` (Mon 16:00) added this session.
