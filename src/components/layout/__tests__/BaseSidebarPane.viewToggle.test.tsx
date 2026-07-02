/**
 * Regression guard for #70: the ViewToggle inside the MOBILE sidebar drawer must
 * switch the active view. `useIsMobile` is forced true so `<Sidebar>` renders its
 * Sheet (drawer) branch, and the Sheet is mocked to render its children inline so
 * the drawer's ViewToggle is mounted. Clicking Calendar/Tasks must drive the real
 * uiStore.currentView — the value MainLayout reads to pick the rendered pane.
 *
 * (Live 390px playwright verification confirmed the drawer toggle already flips
 * the rendered pane on this branch; this locks the wiring against regression.)
 */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('@/hooks/use-mobile', () => ({ useIsMobile: () => true }));

// Render the mobile Sheet (drawer) content inline so the toggle is present.
vi.mock('@/components/ui/sheet', () => {
  const Passthrough = ({ children }: { children?: React.ReactNode }) => (
    <div>{children}</div>
  );
  return {
    Sheet: Passthrough,
    SheetContent: Passthrough,
    SheetHeader: Passthrough,
    SheetTitle: Passthrough,
    SheetDescription: Passthrough,
  };
});

import { SidebarProvider } from '@/components/ui/sidebar';
import { BaseSidebarPane } from '../BaseSidebarPane';
import { useUIStore } from '@/stores/uiStore';

beforeEach(() => {
  useUIStore.setState({ currentView: 'calendar' });
});

describe('#70 — mobile drawer ViewToggle', () => {
  it('switches uiStore.currentView between calendar and tasks', async () => {
    render(
      <SidebarProvider>
        <BaseSidebarPane userProfileContent={<div />} />
      </SidebarProvider>
    );

    // Both toggle options are mounted inside the (mobile) drawer.
    const tasksBtn = screen.getByRole('button', { name: 'Tasks' });
    const calendarBtn = screen.getByRole('button', { name: 'Calendar' });

    await userEvent.click(tasksBtn);
    expect(useUIStore.getState().currentView).toBe('task');

    await userEvent.click(calendarBtn);
    expect(useUIStore.getState().currentView).toBe('calendar');
  });
});
