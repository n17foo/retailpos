import React from 'react';
import { renderUi, hasText, pressByText } from '../../tests/testUtils';
import ErrorBoundary from './ErrorBoundary';
import { Button } from './Button';

jest.mock('../services/logger/LoggerFactory', () => ({
  LoggerFactory: {
    getInstance: () => ({
      createLogger: () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() }),
    }),
  },
}));

describe('ErrorBoundary', () => {
  it('catches render errors and recovers when Try Again is pressed', async () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    try {
      let shouldThrow = true;
      const Boom = () => {
        if (shouldThrow) throw new Error('Render crash');
        return <Button title="Recovered Content" />;
      };

      const tree = await renderUi(
        <ErrorBoundary>
          <Boom />
        </ErrorBoundary>
      );
      expect(hasText(tree, 'Something went wrong')).toBe(true);
      expect(hasText(tree, 'Render crash')).toBe(true);

      shouldThrow = false;
      await pressByText(tree, 'Try Again');
      expect(hasText(tree, 'Recovered Content')).toBe(true);
    } finally {
      spy.mockRestore();
    }
  });
});
