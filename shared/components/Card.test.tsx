import React from 'react';
import { renderUi, hasText, pressByText } from '../../tests/testUtils';
import { Card } from './Card';
import { Button } from './Button';

describe('Card', () => {
  it('renders children and handles onPress when pressable', async () => {
    const onPress = jest.fn();
    const tree = await renderUi(
      <Card onPress={onPress} elevationLevel="low">
        <Button title="Card Action" onPress={onPress} />
      </Card>
    );
    expect(hasText(tree, 'Card Action')).toBe(true);
    await pressByText(tree, 'Card Action');
    expect(onPress).toHaveBeenCalled();
  });
});
