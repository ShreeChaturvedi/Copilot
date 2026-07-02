# Calendar surface — SETTLE redesign evidence (issue #28)

Built 2026-07-02 against design-brief 4.4 on the live app (Vite :5187, dev API :3014), screenshotted headless at 1440x900 and 390x844 in both themes via the in-app toggle. Commits: 8658fe9 (#43 fix), de2592b (chips/today/now-line/annotations, closes #55), 950082d (header/switcher/keyboard).

## What landed

- Chips: 2.4 alpha-film formula via eventContent + eventDidMount (`--chip-c` per event, no inline colors). Light 12% film + 3px bar + sunk text; dark 24% film + 0.5px rim + lifted text. Mono `09:30` 11px then title 12/500. <30min and month bars single-line. All-day bars round terminating ends only. Past 55% + saturate(.65). Selected/drag/mirror solid + white. Legacy colors run the 9.3.3 guard in `src/utils/chipColor.ts` (fails -> ink text + 32% film, class `chip-guard`).
- New-chip settle-in (scale .97 + fade 240ms ease-settle + aqua rim flash) fires on the optimistic temp chip only; the real event replacing it registers a title+start signature and does not re-flash. Module-level seen-sets make it idempotent across `key={slotMinTime}` remounts and view unmounts (verified by MutationObserver: exactly one `chip-enter` per create).
- Today: aqua-film-04 wash on the week body column and month cell only (all-day lane, header, and Day view excluded), aqua-rim left/right rails, FIXED 24x24 disc with mono numeral in week/day/list headers, month cells, and the mini-month (ui/calendar.tsx). #55 dead in every view.
- Now-line: FC line re-skinned 2px aqua + 6px dot (dark adds 8px 25% glow), stock red arrow hidden. JS overlay in CalendarView adds the live gutter chip (11px mono aqua on canvas, hides any hour label within 14px) and the 1px 20% ghost across other days; one 60s interval, transform-only updates, re-anchored on datesSet.
- Dimension annotations: drag mirror renders `|-- N MIN --|` (SSM 11 aqua, tick-ended pseudo-element lines) beside the chip; resize renders live start/end pinned to top/bottom edges. External task drag-in gets the same annotation via the shared mirror path.
- Month: #43 root cause was FC's SYNTHETIC month-header dates formatted with local getters (UTC weekday shift + bogus numbers). Headers now use FC's own per-column text, weekday only. Day numbers 12px mono top-right, `+n more` 11px mono.
- Gutter 11px mono --faint `9 AM`, NOON kept; :30 lines at half hairline; weekend ink-2% wash.
- Header: month Sentient 400 18px + numerals Inter 13px muted baseline-aligned; ViewSwitcher on tokens with machined-keycap tooltips; Today chiclet + T keycap. Keys: T / D / W / M / L / arrows (inert in inputs and under overlays; `[data-kbd-nav]` suppresses the switcher slide per brief 5). Reduced motion: 120ms crossfade + 240ms static 20% ring.

## Evidence map

| File                                                    | Proves                                                                                                      |
| ------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| calendar-week-{light,dark}-1440                         | chip formula both themes, today wash+rails+disc, now-line assembly, serif header, chiclets                  |
| calendar-month-{light,dark}-1440                        | #43 alignment fix, mono day numbers, today disc, film bars, +n more                                         |
| calendar-day-light-1440                                 | NO wash in Day view, disc not squished (#55), gutter label occlusion at 10:00 exactly                       |
| calendar-list-dark-1440                                 | list day headers with disc, 24h mono times, token rows                                                      |
| drag-annotation-dark-1440                               | solid mirror + `\|-- 90 MIN --\|`                                                                           |
| resize-annotation-dark-1440                             | live 13:00/15:30 pinned to chip edges                                                                       |
| external-task-drag-dark-1440                            | task mirror in default calendar color + 60 MIN annotation (eventReceive dialog verified opening, prefilled) |
| calendar-week-{light,dark}-390, calendar-month-dark-390 | 390px: no overflow, short-label switcher, chips legible                                                     |

## Known nits (accepted, or for later passes)

- Grid hairlines and the now-ghost show through chip films (films are translucent by design; matches hairline behavior).
- Gutter chip time can lead FC's line position by <=1 min between FC's own indicator refreshes.
- On mobile FC's `dayMaxEvents` (auto) wins over `dayMaxEventRows=2`; tall 390 month cells show up to 4 bars, which reads fine.
- Sibling agents share the dev DB (`dev-user-id`); task seeds vanished mid-session once. Events used for shots: recon seeds + `Deep work` (Sun 14:00) + `Focus block` (Mon 16:00) added this session.
