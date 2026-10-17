import React from 'react';
import { renderUi, hasText } from '../../tests/testUtils';
import { AuthNavigator } from './AuthNavigator';

jest.mock('../../features/authentication/screens/LoginScreen', () => () => {
  const R = require('react');
  return R.createElement('Text', null, 'MockLoginScreen');
});

jest.mock('../../features/onboarding/screens/OnboardingScreen', () => () => {
  const R = require('react');
  return R.createElement('Text', null, 'MockOnboardingScreen');
});

describe('AuthNavigator', () => {
  it('mounts OnboardingScreen when showOnboarding is true and LoginScreen otherwise', async () => {
    const onboardingTree = await renderUi(<AuthNavigator onLogin={jest.fn()} showOnboarding />);
    expect(hasText(onboardingTree, 'MockOnboardingScreen')).toBe(true);

    const loginTree = await renderUi(<AuthNavigator onLogin={jest.fn()} showOnboarding={false} />);
    expect(hasText(loginTree, 'MockLoginScreen')).toBe(true);
  });
});
