import { useState, useCallback } from 'react';
import {
  resolveSettingsSection,
  type SettingsSection,
} from '@/components/settings/settingsSections';

interface UseSettingsDialogReturn {
  isOpen: boolean;
  currentSection: SettingsSection;
  openSettings: (section?: string) => void;
  closeSettings: () => void;
  setSection: (section: SettingsSection) => void;
}

export function useSettingsDialog(): UseSettingsDialogReturn {
  const [isOpen, setIsOpen] = useState(false);
  const [currentSection, setCurrentSection] =
    useState<SettingsSection>('general');

  const openSettings = useCallback((section: string = 'general') => {
    setCurrentSection(resolveSettingsSection(section));
    setIsOpen(true);
  }, []);

  const closeSettings = useCallback(() => {
    setIsOpen(false);
  }, []);

  const setSection = useCallback((section: SettingsSection) => {
    setCurrentSection(section);
  }, []);

  return {
    isOpen,
    currentSection,
    openSettings,
    closeSettings,
    setSection,
  };
}
