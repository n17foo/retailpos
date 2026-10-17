import React, { createContext, useState, useContext, useMemo, ReactNode, useEffect } from 'react';
import { keyValueRepository } from '../../../shared/repositories/KeyValueRepository';
import { LoggerFactory } from '../../../shared/services/logger/LoggerFactory';
import { setupProgressService } from '../services/SetupProgressService';

const logger = LoggerFactory.getInstance().createLogger('OnboardingProvider');

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
        const status = await keyValueRepository.getItem(ONBOARDING_STATUS_KEY);
        if (status === 'completed') {
          setIsOnboardedState(true);
        }
        // Load setup progress so SetupProgressService cache is warm
        await setupProgressService.load();
      } catch (error) {
        logger.error({ message: 'Failed to load onboarding status' }, error instanceof Error ? error : new Error(String(error)));
      } finally {
        setIsLoading(false);
      }
    };

    checkOnboardingStatus();
  }, []);

  const setIsOnboarded = async (status: boolean) => {
    try {
      await keyValueRepository.setItem(ONBOARDING_STATUS_KEY, status ? 'completed' : 'pending');
      setIsOnboardedState(status);
    } catch (error) {
      logger.error({ message: 'Failed to save onboarding status' }, error instanceof Error ? error : new Error(String(error)));
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
