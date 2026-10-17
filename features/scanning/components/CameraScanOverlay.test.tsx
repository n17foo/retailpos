import React from 'react';
import { renderUi } from '../../../tests/testUtils';
import { CameraScanOverlay } from './CameraScanOverlay';

describe('CameraScanOverlay', () => {
  it('renders CameraView when permission is granted', async () => {
    const tree = await renderUi(<CameraScanOverlay visible onClose={jest.fn()} onScanned={jest.fn()} presentation="side" />);
    expect(tree.root.findAllByType('CameraView' as never)).toHaveLength(1);
  });
});
