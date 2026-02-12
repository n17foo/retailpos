declare module '@env' {
  // Printer related environment variables
  export const USE_MOCK_PRINTERS: string;
  export const PRINTER_TYPE: string;

  // Payment related environment variables
  export const USE_MOCK_PAYMENT: string;
  export const WORLDPAY_MERCHANT_ID: string;
  export const WORLDPAY_SITE_REFERENCE: string;
  export const WORLDPAY_INSTALLATION_ID: string;

  // Scanner related environment variables
  export const USE_MOCK_SCANNER: string;

  // Secrets related environment variables
  export const USE_MOCK_SECRETS: string;

  // Printers related environment variables
  export const USE_MOCK_PRINTERS: string;

  // Add any other environment variables you use in your application here
}
