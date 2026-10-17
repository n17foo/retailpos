import React from 'react';
import { renderUi, act } from '../../../tests/testUtils';
import { HidCaptureField } from './HidCaptureField';

jest.mock('../../hardware/services/scanner/ScannerSettingsService', () => ({
  scannerSettingsService: {
    getUsbConfig: () => ({
      scanIntervalMs: 80,
      minBarcodeLength: 3,
      maxBarcodeLength: 128,
      suffixChar: 'Enter',
    }),
  },
}));

describe('HidCaptureField', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('mounts hidden TextInput on native and feeds burst characters to onScan', async () => {
    const onScan = jest.fn();
    const tree = await renderUi(<HidCaptureField onScan={onScan} />);
    const input = tree.root.findByType('TextInput' as never);
    input.props.onChangeText('12345');
    input.props.onSubmitEditing();
    expect(onScan).toHaveBeenCalledWith('12345');
    await act(async () => {
      tree.unmount();
    });
  });
});
