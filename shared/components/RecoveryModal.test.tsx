import React from 'react';
import { renderUi, hasText, pressByText } from '../../tests/testUtils';
import { RecoveryModal } from './RecoveryModal';

describe('RecoveryModal', () => {
  it('renders title, message, details, and invokes action handlers', async () => {
    const onPrimary = jest.fn();
    const onSecondary = jest.fn();
    const tree = await renderUi(
      <RecoveryModal
        visible
        type="error"
        title="Payment Failed"
        message="Card declined"
        details="Code: card_declined"
        actions={[
          { label: 'Retry Card', type: 'primary', onPress: onPrimary },
          { label: 'Switch to Cash', type: 'secondary', onPress: onSecondary },
        ]}
      />
    );
    expect(hasText(tree, 'Payment Failed')).toBe(true);
    await pressByText(tree, 'Retry Card');
    expect(onPrimary).toHaveBeenCalledTimes(1);
    await pressByText(tree, 'Switch to Cash');
    expect(onSecondary).toHaveBeenCalledTimes(1);
  });
});
