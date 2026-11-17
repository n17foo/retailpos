/**
 * Mock for @react-native-community/netinfo — defaults to a connected device.
 * Tests can push states via __emit or set the static result of fetch().
 */

export interface NetInfoState {
  isConnected: boolean | null;
  isInternetReachable?: boolean | null;
  type?: string;
}

type Listener = (state: NetInfoState) => void;

const listeners = new Set<Listener>();
let currentState: NetInfoState = { isConnected: true, isInternetReachable: true, type: 'wifi' };

function addEventListener(listener: Listener): () => void {
  listeners.add(listener);
  listener(currentState);
  return () => listeners.delete(listener);
}

async function fetch(): Promise<NetInfoState> {
  return currentState;
}

/** Test helper — drive connectivity changes. */
function __emit(state: NetInfoState): void {
  currentState = state;
  for (const l of Array.from(listeners)) l(state);
}

function __reset(): void {
  listeners.clear();
  currentState = { isConnected: true, isInternetReachable: true, type: 'wifi' };
}

const NetInfo = { addEventListener, fetch, __emit, __reset };
export default NetInfo;
