import React from 'react';
import { renderUi, hasText } from '../../../tests/testUtils';
import UsersScreen from './UsersScreen';

jest.mock('./UsersSettingsTab', () => {
  const R = require('react');
  return () => R.createElement('Text', null, 'MockUsersSettingsTab');
});

describe('UsersScreen', () => {
  it('renders UsersSettingsTab inside ScrollView', async () => {
    const tree = await renderUi(<UsersScreen />);
    expect(hasText(tree, 'MockUsersSettingsTab')).toBe(true);
  });
});
