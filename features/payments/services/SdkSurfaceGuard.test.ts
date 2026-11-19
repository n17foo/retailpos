/**
 * PAY-04 regression — the installed SDKs do not expose the terminal objects
 * these services were written against. Initialization must fail with a
 * descriptive error at load time instead of a cryptic TypeError mid-payment.
 */

jest.mock('@adyen/react-native', () => ({
  // The real package exports checkout components/modules — no AdyenTerminal.
  AdyenCheckout: jest.fn(),
}));

jest.mock('card-react-native', () => ({
  // The real package only exports the CardSdkReactNativeView component.
  CardSdkReactNativeView: jest.fn(),
}));

import { AdyenService } from './AdyenService';
import { TapPaymentsService } from './TapPaymentsService';

describe('PAY-04 — SDK surface guards', () => {
  it('AdyenService refuses to initialise without AdyenTerminal', () => {
    expect(() => AdyenService.getInstance()).toThrow(/AdyenTerminal/);
  });

  it('TapPaymentsService refuses to initialise without TapPayments', () => {
    expect(() => TapPaymentsService.getInstance()).toThrow(/TapPayments/);
  });
});
