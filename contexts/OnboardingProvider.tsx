import React, { createContext, useState, useContext, useMemo, ReactNode, useEffect } from 'react';
import { Storage } from '../utils/storage';

const ONBOARDING_STATUS_KEY = 'onboarding_status';

export interface OnboardingContextType {
  isOnboarded: boolean;
  setIsOnboarded: (status: boolean) => void;
}

export const OnboardingContext = createContext<OnboardingContextType | null>(null);

export const OnboardingProvider = ({ children }: Readonly<{ children: ReactNode }>) => {
  const [isOnboarded, setIsOnboardedState] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkOnboardingStatus = async () => {
      try {
        const status = await Storage.getInstance().getItem(ONBOARDING_STATUS_KEY);
        if (status === 'completed') {
          setIsOnboardedState(true);
        }
      } catch (error) {
        console.error('Failed to load onboarding status', error);
      } finally {
        setIsLoading(false);
      }
    };

    checkOnboardingStatus();
  }, []);

  const setIsOnboarded = async (status: boolean) => {
    try {
      await Storage.getInstance().setItem(ONBOARDING_STATUS_KEY, status ? 'completed' : 'pending');
      setIsOnboardedState(status);
    } catch (error) {
      console.error('Failed to save onboarding status', error);
    }
  };

  const value = useMemo(
    () => ({
      isOnboarded,
      setIsOnboarded,
    }),
    [isOnboarded]
  );

  if (isLoading) {
    return null; // Or a loading spinner
  }

  return <OnboardingContext.Provider value={value}>{children}</OnboardingContext.Provider>;
};

export const useOnboardingContext = (): OnboardingContextType => {
  const context = useContext(OnboardingContext);

  if (context === null) {
    throw new Error('useOnboardingContext must be used within OnboardingProvider');
  }

  return context;
};
