export interface CurrencyInfo {
  code: string;
  symbol: string;
  name: string;
  symbolPlacement: 'before' | 'after';
}

export const CURRENCIES: CurrencyInfo[] = [
  { code: 'GBP', symbol: '£', name: 'British Pound', symbolPlacement: 'before' },
  { code: 'USD', symbol: '$', name: 'US Dollar', symbolPlacement: 'before' },
  { code: 'EUR', symbol: '€', name: 'Euro', symbolPlacement: 'before' },
  { code: 'CAD', symbol: 'CA$', name: 'Canadian Dollar', symbolPlacement: 'before' },
  { code: 'AUD', symbol: 'A$', name: 'Australian Dollar', symbolPlacement: 'before' },
  { code: 'JPY', symbol: '¥', name: 'Japanese Yen', symbolPlacement: 'before' },
  { code: 'CHF', symbol: 'CHF', name: 'Swiss Franc', symbolPlacement: 'before' },
  { code: 'CNY', symbol: '¥', name: 'Chinese Yuan', symbolPlacement: 'before' },
  { code: 'INR', symbol: '₹', name: 'Indian Rupee', symbolPlacement: 'before' },
  { code: 'BRL', symbol: 'R$', name: 'Brazilian Real', symbolPlacement: 'before' },
  { code: 'MXN', symbol: 'MX$', name: 'Mexican Peso', symbolPlacement: 'before' },
  { code: 'ZAR', symbol: 'R', name: 'South African Rand', symbolPlacement: 'before' },
  { code: 'KRW', symbol: '₩', name: 'South Korean Won', symbolPlacement: 'before' },
  { code: 'SEK', symbol: 'kr', name: 'Swedish Krona', symbolPlacement: 'before' },
  { code: 'NOK', symbol: 'kr', name: 'Norwegian Krone', symbolPlacement: 'before' },
  { code: 'DKK', symbol: 'kr', name: 'Danish Krone', symbolPlacement: 'before' },
  { code: 'PLN', symbol: 'zł', name: 'Polish Zloty', symbolPlacement: 'before' },
  { code: 'TRY', symbol: '₺', name: 'Turkish Lira', symbolPlacement: 'before' },
  { code: 'AED', symbol: 'د.إ', name: 'UAE Dirham', symbolPlacement: 'before' },
  { code: 'SGD', symbol: 'S$', name: 'Singapore Dollar', symbolPlacement: 'before' },
  { code: 'HKD', symbol: 'HK$', name: 'Hong Kong Dollar', symbolPlacement: 'before' },
  { code: 'NZD', symbol: 'NZ$', name: 'New Zealand Dollar', symbolPlacement: 'before' },
  { code: 'THB', symbol: '฿', name: 'Thai Baht', symbolPlacement: 'before' },
  { code: 'ILS', symbol: '₪', name: 'Israeli Shekel', symbolPlacement: 'before' },
  { code: 'NGN', symbol: '₦', name: 'Nigerian Naira', symbolPlacement: 'before' },
  { code: 'KES', symbol: 'KSh', name: 'Kenyan Shilling', symbolPlacement: 'before' },
  { code: 'GHS', symbol: 'GH₵', name: 'Ghanaian Cedi', symbolPlacement: 'before' },
  { code: 'EGP', symbol: 'E£', name: 'Egyptian Pound', symbolPlacement: 'before' },
  { code: 'PHP', symbol: '₱', name: 'Philippine Peso', symbolPlacement: 'before' },
  { code: 'COP', symbol: 'COL$', name: 'Colombian Peso', symbolPlacement: 'before' },
  { code: 'ARS', symbol: 'AR$', name: 'Argentine Peso', symbolPlacement: 'before' },
  { code: 'CLP', symbol: 'CL$', name: 'Chilean Peso', symbolPlacement: 'before' },
  { code: 'PEN', symbol: 'S/', name: 'Peruvian Sol', symbolPlacement: 'before' },
  { code: 'MAD', symbol: 'MAD', name: 'Moroccan Dirham', symbolPlacement: 'before' },
  { code: 'SAR', symbol: '﷼', name: 'Saudi Riyal', symbolPlacement: 'before' },
  { code: 'QAR', symbol: 'QR', name: 'Qatari Riyal', symbolPlacement: 'before' },
  { code: 'KWD', symbol: 'KD', name: 'Kuwaiti Dinar', symbolPlacement: 'before' },
  { code: 'BHD', symbol: 'BD', name: 'Bahraini Dinar', symbolPlacement: 'before' },
  { code: 'TWD', symbol: 'NT$', name: 'Taiwan Dollar', symbolPlacement: 'before' },
  { code: 'MYR', symbol: 'RM', name: 'Malaysian Ringgit', symbolPlacement: 'before' },
  { code: 'IDR', symbol: 'Rp', name: 'Indonesian Rupiah', symbolPlacement: 'before' },
  { code: 'VND', symbol: '₫', name: 'Vietnamese Dong', symbolPlacement: 'after' },
  { code: 'PKR', symbol: '₨', name: 'Pakistani Rupee', symbolPlacement: 'before' },
  { code: 'BDT', symbol: '৳', name: 'Bangladeshi Taka', symbolPlacement: 'before' },
  { code: 'LKR', symbol: 'Rs', name: 'Sri Lankan Rupee', symbolPlacement: 'before' },
  { code: 'RUB', symbol: '₽', name: 'Russian Ruble', symbolPlacement: 'after' },
  { code: 'UAH', symbol: '₴', name: 'Ukrainian Hryvnia', symbolPlacement: 'after' },
  { code: 'CZK', symbol: 'Kč', name: 'Czech Koruna', symbolPlacement: 'after' },
  { code: 'HUF', symbol: 'Ft', name: 'Hungarian Forint', symbolPlacement: 'after' },
  { code: 'RON', symbol: 'lei', name: 'Romanian Leu', symbolPlacement: 'after' },
  { code: 'BGN', symbol: 'лв', name: 'Bulgarian Lev', symbolPlacement: 'after' },
  { code: 'HRK', symbol: 'kn', name: 'Croatian Kuna', symbolPlacement: 'after' },
  { code: 'ISK', symbol: 'kr', name: 'Icelandic Krona', symbolPlacement: 'after' },
  { code: 'LEK', symbol: 'Lek', name: 'Albanian Lek', symbolPlacement: 'after' },
];

const symbolMap = new Map(CURRENCIES.map(c => [c.code, c.symbol]));
const currencyInfoMap = new Map(CURRENCIES.map(c => [c.code, c]));

export function getCurrencySymbol(code: string): string {
  return symbolMap.get(code) || code;
}

export function getCurrencyInfo(code: string): CurrencyInfo | undefined {
  return currencyInfoMap.get(code);
}

export const CURRENCY_CODES = CURRENCIES.map(c => c.code);
