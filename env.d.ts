declare module '@env' {
  // Printer related environment variables
  export const USE_MOCK_PRINTERS: string;
  export const PRINTER_TYPE: string;

  // Payment related environment variables
  export const USE_MOCK_PAYMENT: string;

  // Scanner related environment variables
  export const USE_MOCK_SCANNER: string;

  // Secrets related environment variables
  export const USE_MOCK_SECRETS: string;
  export const ALLOW_PLAINTEXT_SECRET_FALLBACK: string;

  // Printers related environment variables
  export const USE_MOCK_PRINTERS: string;

  // Add any other environment variables you use in your application here
}
