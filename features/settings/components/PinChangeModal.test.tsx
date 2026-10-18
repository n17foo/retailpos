import React from 'react';
import { renderUi, hasText, pressByText } from '../../../tests/testUtils';
import { PinChangeModal } from './PinChangeModal';

const baseProps = {
  visible: true,
  userName: 'Alice',
  pinStep: 'enter' as const,
  newPin: '',
  confirmPin: '',
  onKeyPress: jest.fn(),
  onDelete: jest.fn(),
  onCancel: jest.fn(),
  onBack: jest.fn(),
};

describe('PinChangeModal', () => {
  it('renders the enter-step title and user name', async () => {
    const tree = await renderUi(<PinChangeModal {...baseProps} />);
    expect(hasText(tree, 'Enter New PIN')).toBe(true);
    expect(hasText(tree, 'Alice')).toBe(true);
    expect(hasText(tree, 'Back')).toBe(false);
  });

  it('renders the confirm-step title and back button', async () => {
    const onBack = jest.fn();
    const tree = await renderUi(<PinChangeModal {...baseProps} pinStep="confirm" onBack={onBack} />);
    expect(hasText(tree, 'Confirm New PIN')).toBe(true);
    await pressByText(tree, 'Back');
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('fires onCancel', async () => {
    const onCancel = jest.fn();
    const tree = await renderUi(<PinChangeModal {...baseProps} onCancel={onCancel} />);
    await pressByText(tree, 'Cancel');
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
