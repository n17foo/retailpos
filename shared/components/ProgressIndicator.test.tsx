import React from 'react';
import { renderUi, hasText } from '../../tests/testUtils';
import { ProgressIndicator } from './ProgressIndicator';

describe('ProgressIndicator', () => {
  it('renders completed/current steps and step label', async () => {
    const tree = await renderUi(<ProgressIndicator currentStep={2} totalSteps={3} labels={['Platform', 'Admin', 'Hardware']} />);
    expect(hasText(tree, 'Step 2 of 3: Admin')).toBe(true);
  });
});
