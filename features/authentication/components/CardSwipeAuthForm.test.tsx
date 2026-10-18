import React from 'react';
import { renderUi, hasText } from '../../../tests/testUtils';
import { CardSwipeAuthForm } from './CardSwipeAuthForm';

jest.mock('../../../shared/hooks/useTranslate', () => ({
  useTranslate: () => ({ t: (k: string) => k }),
}));

describe('CardSwipeAuthForm', () => {
  it('renders magstripe copy while waiting for a swipe', async () => {
    const tree = await renderUi(<CardSwipeAuthForm variant="magstripe" waitingForSwipe onCardInput={jest.fn()} />);
    expect(hasText(tree, 'login.swipeCard')).toBe(true);
    expect(hasText(tree, 'login.waitingForSwipe')).toBe(true);
  });

  it('renders rfid copy while waiting for a tap', async () => {
    const tree = await renderUi(<CardSwipeAuthForm variant="rfid_nfc" waitingForSwipe onCardInput={jest.fn()} />);
    expect(hasText(tree, 'login.tapBadge')).toBe(true);
    expect(hasText(tree, 'login.waitingForTap')).toBe(true);
  });

  it('forwards captured card data to onCardInput', async () => {
    const onCardInput = jest.fn();
    const tree = await renderUi(<CardSwipeAuthForm variant="magstripe" waitingForSwipe={false} onCardInput={onCardInput} />);
    const input = tree.root.findAll(n => n.type === 'TextInput')[0];
    input.props.onChangeText('%B4111...');
    expect(onCardInput).toHaveBeenCalledWith('%B4111...');
  });
});
