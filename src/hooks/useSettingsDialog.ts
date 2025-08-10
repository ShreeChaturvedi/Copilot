import { useState, useCallback } from 'react';
import type { SettingsSection } from '@/components/settings/SettingsDialog';

interface UseSettingsDialogReturn {
  isOpen: boolean;
  currentSection: SettingsSection;
  openSettings: (section?: SettingsSection) => void;
  closeSettings: () => void;
  setSection: (section: SettingsSection) => void;
}

export function useSettingsDialog(): UseSettingsDialogReturn {
  const [isOpen, setIsOpen] = useState(false);
  const [currentSection, setCurrentSection] = useState<SettingsSection>('general');

  const openSettings = useCallback((section: SettingsSection = 'general') => {
    setCurrentSection(section);
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