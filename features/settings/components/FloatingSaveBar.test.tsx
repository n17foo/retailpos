import React from 'react';
import { renderUi, hasText, pressByText } from '../../../tests/testUtils';
import { FloatingSaveBar } from './FloatingSaveBar';

describe('FloatingSaveBar', () => {
  it('returns null when hidden and invokes onSave / onDiscard when visible', async () => {
    const hiddenTree = await renderUi(<FloatingSaveBar visible={false} onSave={jest.fn()} onDiscard={jest.fn()} />);
    expect(hiddenTree.toJSON()).toBeNull();

    const onSave = jest.fn();
    const onDiscard = jest.fn();
    const tree = await renderUi(<FloatingSaveBar visible onSave={onSave} onDiscard={onDiscard} />);
    expect(hasText(tree, 'You have unsaved changes')).toBe(true);

    await pressByText(tree, 'Save Changes');
    expect(onSave).toHaveBeenCalledTimes(1);

    await pressByText(tree, 'Discard');
    expect(onDiscard).toHaveBeenCalledTimes(1);
  });
});
