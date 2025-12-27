import React, { createContext, useContext, ReactNode } from 'react';
import useSettings from '../hooks/useSettings';

interface SettingsContextType {
  settings: { [key: string]: any };
  loading: boolean;
  error: Error | null;
  getSetting: <T>(key: string, defaultValue: T) => T;
  updateSetting: <T>(key: string, value: T) => Promise<void>;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export const SettingsProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { settings, loading, error, getSetting, updateSetting } = useSettings();

  const value = {
    settings,
    loading,
    error,
    getSetting,
    updateSetting,
  };

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
};

export const useSettingsData = () => {
  const context = useContext(SettingsContext);
  if (context === undefined) {
    throw new Error('useSettingsData must be used within a SettingsProvider');
  }
  return context;
};
