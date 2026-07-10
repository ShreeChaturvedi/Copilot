export type SettingsSection =
  | 'general'
  | 'account'
  | 'integrations'
  | 'security'
  | 'about';

/** Map legacy deep-link ids to the minimal-five IA. */
export function resolveSettingsSection(section: string): SettingsSection {
  switch (section) {
    case 'profile':
      return 'account';
    case 'preferences':
    case 'calendar':
      return 'general';
    case 'help':
      return 'about';
    case 'general':
    case 'account':
    case 'integrations':
    case 'security':
    case 'about':
      return section;
    default:
      return 'general';
  }
}

export const SECTION_TITLES: Record<SettingsSection, string> = {
  general: 'General',
  account: 'Account',
  integrations: 'Integrations',
  security: 'Security',
  about: 'About',
};
