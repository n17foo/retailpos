import React from 'react';
import { renderUi, hasText, pressByText, act } from '../../../tests/testUtils';
import { BasketLineItem } from './BasketLineItem';
import type { BasketItem } from '../contexts/BasketStateProvider';

jest.mock('../../platform-clients/hooks/useCurrency', () => ({
  useCurrency: () => ({ code: 'GBP', symbol: '£' }),
}));

const item: BasketItem = {
  id: 'line-1',
  productId: 'p1',
  name: 'Iced Latte',
  price: 2.99,
  quantity: 3,
  sku: 'LATTE-01',
};

const baseProps = {
  item,
  currencyCode: 'GBP',
  isSelected: false,
  isFlashing: false,
  isNoteEditing: false,
  noteChips: [] as string[],
  inputMode: 'touch' as const,
  isAtStockLimit: () => false,
  onToggleSelect: jest.fn(),
  onDecrement: jest.fn(),
  onIncrement: jest.fn(),
  onRemove: jest.fn(),
  onToggleNoteEdit: jest.fn(),
  onNoteChip: jest.fn(),
  onNoteSubmit: jest.fn(),
};

describe('BasketLineItem', () => {
  it('renders name, sku, unit price and cent-accurate line total', async () => {
    const tree = await renderUi(<BasketLineItem {...baseProps} />);
    expect(hasText(tree, 'Iced Latte')).toBe(true);
    expect(hasText(tree, 'LATTE-01')).toBe(true);
    expect(hasText(tree, '×3')).toBe(true);
    expect(hasText(tree, '£8.97')).toBe(true);
  });

  it('fires onToggleSelect when the line is pressed', async () => {
    const onToggleSelect = jest.fn();
    const tree = await renderUi(<BasketLineItem {...baseProps} onToggleSelect={onToggleSelect} />);
    await pressByText(tree, 'Iced Latte');
    expect(onToggleSelect).toHaveBeenCalledWith('line-1');
  });

  it('shows the action strip when selected and fires remove', async () => {
    const onRemove = jest.fn();
    const tree = await renderUi(<BasketLineItem {...baseProps} isSelected onRemove={onRemove} />);
    const remove = tree.root.findAll(n => n.props?.accessibilityLabel === 'Remove Iced Latte from cart')[0];
    await act(async () => {
      await remove.props.onPress();
    });
    expect(onRemove).toHaveBeenCalledWith('line-1');
  });

  it('renders the note editor with chips when isNoteEditing and selected', async () => {
    const onNoteChip = jest.fn();
    const tree = await renderUi(<BasketLineItem {...baseProps} isSelected isNoteEditing noteChips={['No Ice']} onNoteChip={onNoteChip} />);
    expect(hasText(tree, 'No Ice')).toBe(true);
    await pressByText(tree, 'No Ice');
    expect(onNoteChip).toHaveBeenCalledWith('line-1', 'No Ice');
  });

  it('disables increment when at stock limit', async () => {
    const onIncrement = jest.fn();
    const tree = await renderUi(<BasketLineItem {...baseProps} isSelected isAtStockLimit={() => true} onIncrement={onIncrement} />);
    const plus = tree.root.findAll(n => n.props?.accessibilityLabel === 'Increase quantity of Iced Latte')[0];
    expect(plus.props.disabled).toBe(true);
  });
});
