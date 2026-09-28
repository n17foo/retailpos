import React from 'react';
import renderer, { act } from 'react-test-renderer';
import { useInactivityLock } from './useInactivityLock';
import { AUTO_LOCK_TIMEOUT_MS } from '../services/config/POSConfigService';

jest.mock('../services/config/POSConfigService', () => ({
  AUTO_LOCK_TIMEOUT_MS: jest.fn(() => 15_000),
  DEFAULT_AUTO_LOCK_MINUTES: 5,
  posConfig: { values: {} },
}));

const mockedTimeout = AUTO_LOCK_TIMEOUT_MS as jest.Mock;

interface HarnessProps {
  authed: boolean;
  onLock: () => void;
  expose: (registerActivity: () => void) => void;
}

function Harness({ authed, onLock, expose }: HarnessProps) {
  const registerActivity = useInactivityLock(authed, onLock);
  React.useEffect(() => {
    expose(registerActivity);
  }, [registerActivity, expose]);
  return null;
}

function mount(authed: boolean, onLock: () => void) {
  let register: () => void = () => {
    throw new Error('registerActivity not exposed yet');
  };
  const expose = (fn: () => void) => {
    register = fn;
  };
  let tree: renderer.ReactTestRenderer;
  act(() => {
    tree = renderer.create(React.createElement(Harness, { authed, onLock, expose }));
  });
  return { tree: tree!, register: () => register() };
}

describe('useInactivityLock', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    mockedTimeout.mockReturnValue(15_000);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('locks after the configured idle timeout', () => {
    const onLock = jest.fn();
    mount(true, onLock);

    act(() => {
      jest.advanceTimersByTime(20_000);
    });
    expect(onLock).toHaveBeenCalledTimes(1);
  });

  it('resets the idle timer on activity', () => {
    const onLock = jest.fn();
    const { register } = mount(true, onLock);

    act(() => {
      jest.advanceTimersByTime(10_000); // 10s idle — below the 15s limit
      register(); // user activity resets the clock
      jest.advanceTimersByTime(10_000); // only 10s since last activity
    });
    expect(onLock).not.toHaveBeenCalled();

    act(() => {
      jest.advanceTimersByTime(10_000); // now 20s idle
    });
    expect(onLock).toHaveBeenCalledTimes(1);
  });

  it('does not lock when the session is not authenticated', () => {
    const onLock = jest.fn();
    mount(false, onLock);

    act(() => {
      jest.advanceTimersByTime(60_000);
    });
    expect(onLock).not.toHaveBeenCalled();
  });

  it('does not lock when the timeout is disabled (0)', () => {
    mockedTimeout.mockReturnValue(0);
    const onLock = jest.fn();
    mount(true, onLock);

    act(() => {
      jest.advanceTimersByTime(60_000);
    });
    expect(onLock).not.toHaveBeenCalled();
  });

  it('stops checking after unmount', () => {
    const onLock = jest.fn();
    const { tree } = mount(true, onLock);
    act(() => {
      tree.unmount();
    });
    act(() => {
      jest.advanceTimersByTime(60_000);
    });
    expect(onLock).not.toHaveBeenCalled();
  });
});
