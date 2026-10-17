import React from 'react';
import { renderUi, hasText } from '../../../tests/testUtils';
import { ScanNoticeBar } from './ScanNoticeBar';

describe('ScanNoticeBar', () => {
  it('renders added, out_of_stock, and not_found notices', async () => {
    const addedTree = await renderUi(<ScanNoticeBar notice={{ kind: 'added', code: '123', name: 'Latte', at: 1 }} />);
    expect(hasText(addedTree, 'Latte added')).toBe(true);

    const oosTree = await renderUi(<ScanNoticeBar notice={{ kind: 'out_of_stock', code: '123', name: 'Latte', at: 1 }} />);
    expect(hasText(oosTree, 'Latte is out of stock')).toBe(true);

    const missingTree = await renderUi(<ScanNoticeBar notice={{ kind: 'not_found', code: '999', at: 1 }} />);
    expect(hasText(missingTree, 'No product for “999”')).toBe(true);
  });
});
