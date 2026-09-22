/**
 * MFX - Frankfurter API Client
 * Handles currency listing, real-time conversion rates, and historical time-series data.
 * Base API URL: https://api.frankfurter.dev/v1 or fallback to https://api.frankfurter.app/v1
 */

const API_BASE_URLS = [
  'https://api.frankfurter.dev/v1',
  'https://api.frankfurter.app/v1'
];

let currentBaseUrlIndex = 0;

// In-memory cache for currency names and symbols to avoid redundant network requests
let cachedCurrencies = null;
const ratesCache = new Map();

/**
 * Currency metadata helper containing symbols, flags, and country names.
 */
export const CURRENCY_METADATA = {
  USD: { symbol: '$', name: 'United States Dollar', flag: '🇺🇸', country: 'United States' },
  EUR: { symbol: '€', name: 'Euro', flag: '🇪🇺', country: 'European Union' },
  GBP: { symbol: '£', name: 'British Pound Sterling', flag: '🇬🇧', country: 'United Kingdom' },
  INR: { symbol: '₹', name: 'Indian Rupee', flag: '🇮🇳', country: 'India' },
  JPY: { symbol: '¥', name: 'Japanese Yen', flag: '🇯🇵', country: 'Japan' },
  AUD: { symbol: 'A$', name: 'Australian Dollar', flag: '🇦🇺', country: 'Australia' },
  CAD: { symbol: 'C$', name: 'Canadian Dollar', flag: '🇨🇦', country: 'Canada' },
  CHF: { symbol: 'CHF', name: 'Swiss Franc', flag: '🇨🇭', country: 'Switzerland' },
  CNY: { symbol: '¥', name: 'Chinese Yuan', flag: '🇨🇳', country: 'China' },
  HKD: { symbol: 'HK$', name: 'Hong Kong Dollar', flag: '🇭🇰', country: 'Hong Kong' },
  NZD: { symbol: 'NZ$', name: 'New Zealand Dollar', flag: '🇳🇿', country: 'New Zealand' },
  SEK: { symbol: 'kr', name: 'Swedish Krona', flag: '🇸🇪', country: 'Sweden' },
  KRW: { symbol: '₩', name: 'South Korean Won', flag: '🇰🇷', country: 'South Korea' },
  SGD: { symbol: 'S$', name: 'Singapore Dollar', flag: '🇸🇬', country: 'Singapore' },
  NOK: { symbol: 'kr', name: 'Norwegian Krone', flag: '🇳🇴', country: 'Norway' },
  MXN: { symbol: '$', name: 'Mexican Peso', flag: '🇲🇽', country: 'Mexico' },
  BRL: { symbol: 'R$', name: 'Brazilian Real', flag: '🇧🇷', country: 'Brazil' },
  ZAR: { symbol: 'R', name: 'South African Rand', flag: '🇿🇦', country: 'South Africa' },
  TRY: { symbol: '₺', name: 'Turkish Lira', flag: '🇹🇷', country: 'Turkey' },
  PLN: { symbol: 'zł', name: 'Polish Zloty', flag: '🇵🇱', country: 'Poland' },
  THB: { symbol: '฿', name: 'Thai Baht', flag: '🇹🇭', country: 'Thailand' },
  IDR: { symbol: 'Rp', name: 'Indonesian Rupiah', flag: '🇮🇩', country: 'Indonesia' },
  HUF: { symbol: 'Ft', name: 'Hungarian Forint', flag: '🇭🇺', country: 'Hungary' },
  CZK: { symbol: 'Kč', name: 'Czech Koruna', flag: '🇨🇿', country: 'Czech Republic' },
  ILS: { symbol: '₪', name: 'Israeli New Shekel', flag: '🇮🇱', country: 'Israel' },
  CLP: { symbol: '$', name: 'Chilean Peso', flag: '🇨🇱', country: 'Chile' },
  PHP: { symbol: '₱', name: 'Philippine Peso', flag: '🇵🇭', country: 'Philippines' },
  RON: { symbol: 'lei', name: 'Romanian Leu', flag: '🇷🇴', country: 'Romania' },
  DKK: { symbol: 'kr', name: 'Danish Krone', flag: '🇩🇰', country: 'Denmark' },
  BGN: { symbol: 'лв', name: 'Bulgarian Lev', flag: '🇧🇬', country: 'Bulgaria' },
  ISK: { symbol: 'kr', name: 'Icelandic Króna', flag: '🇮🇸', country: 'Iceland' }
};

/**
 * Fetch with automatic fallback between API mirror domains and timeout.
 */
async function fetchWithFallback(endpoint, options = {}) {
  const timeoutMs = 9000;

  for (let i = 0; i < API_BASE_URLS.length; i++) {
    const urlIndex = (currentBaseUrlIndex + i) % API_BASE_URLS.length;
    const baseUrl = API_BASE_URLS[urlIndex];
    const fullUrl = `${baseUrl}${endpoint}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(fullUrl, {
        ...options,
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP error ${response.status}: ${response.statusText}`);
      }

      currentBaseUrlIndex = urlIndex; // Sticky successful mirror
      return await response.json();
    } catch (err) {
      clearTimeout(timeoutId);
      console.warn(`API attempt failed on ${baseUrl}:`, err.message);
      if (i === API_BASE_URLS.length - 1) {
        throw new Error(`Unable to fetch currency data. Please check your internet connection.`);
      }
    }
  }
}

/**
 * Fetch all available currencies supported by Frankfurter API.
 * @returns {Promise<Object>} Map of { currencyCode: currencyName }
 */
export async function getCurrencies() {
  if (cachedCurrencies) {
    return cachedCurrencies;
  }

  try {
    const data = await fetchWithFallback('/currencies');
    cachedCurrencies = data;
    return data;
  } catch (error) {
    console.error('Failed to get currencies:', error);
    // Return fallback list if offline or API is down
    const fallback = {};
    for (const [code, meta] of Object.entries(CURRENCY_METADATA)) {
      fallback[code] = meta.name;
    }
    return fallback;
  }
}

/**
 * Fetch latest conversion rate between two currencies or base against all.
 * @param {string} base - Base currency code (e.g. 'USD')
 * @param {string|string[]} [symbols] - Target currency code or array of codes (e.g. 'INR' or ['EUR', 'GBP', 'INR'])
 * @returns {Promise<Object>} API response with { amount, base, date, rates }
 */
export async function getLatestRates(base = 'USD', symbols = null) {
  let endpoint = `/latest?from=${encodeURIComponent(base)}`;
  if (symbols) {
    const symbolParam = Array.isArray(symbols) ? symbols.join(',') : symbols;
    endpoint += `&to=${encodeURIComponent(symbolParam)}`;
  }

  const cacheKey = `latest_${base}_${symbols ? (Array.isArray(symbols) ? symbols.join(',') : symbols) : 'ALL'}`;
  const cached = ratesCache.get(cacheKey);
  const now = Date.now();

  // Cache for 60 seconds
  if (cached && (now - cached.timestamp < 60000)) {
    return cached.data;
  }

  try {
    const data = await fetchWithFallback(endpoint);
    ratesCache.set(cacheKey, { timestamp: now, data });
    return data;
  } catch (error) {
    console.error(`Failed to get latest rates for ${base}:`, error);
    if (cached) return cached.data;
    throw error;
  }
}

/**
 * Helper to calculate date string (YYYY-MM-DD) for past periods.
 * @param {string} period - '1M' | '3M' | '6M' | '1Y'
 * @returns {{ startDate: string, endDate: string }}
 */
export function calculateDateRange(period = '1M') {
  const end = new Date();
  const start = new Date();

  switch (period) {
    case '1M':
      start.setMonth(start.getMonth() - 1);
      break;
    case '3M':
      start.setMonth(start.getMonth() - 3);
      break;
    case '6M':
      start.setMonth(start.getMonth() - 6);
      break;
    case '1Y':
      start.setFullYear(start.getFullYear() - 1);
      break;
    default:
      start.setMonth(start.getMonth() - 1);
  }

  const formatDate = (date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  return {
    startDate: formatDate(start),
    endDate: formatDate(end)
  };
}

/**
 * Fetch historical time series exchange rates.
 * @param {string} base - Base currency (e.g. 'USD')
 * @param {string} target - Target currency (e.g. 'INR')
 * @param {string} period - '1M' | '3M' | '6M' | '1Y'
 * @returns {Promise<Object>} Object containing dates, rates array, and summary metrics.
 */
export async function getHistoricalRates(base = 'USD', target = 'INR', period = '1M') {
  // If base equals target, synthesize flat 1.0 rate
  if (base === target) {
    const { startDate, endDate } = calculateDateRange(period);
    return {
      base,
      target,
      period,
      startDate,
      endDate,
      dataPoints: [{ date: endDate, rate: 1.0 }],
      rates: [1.0],
      dates: [endDate],
      currentRate: 1.0,
      highRate: 1.0,
      lowRate: 1.0,
      avgRate: 1.0,
      pctChange: 0,
      changeAmount: 0
    };
  }

  const { startDate, endDate } = calculateDateRange(period);
  const endpoint = `/${startDate}..${endDate}?from=${encodeURIComponent(base)}&to=${encodeURIComponent(target)}`;

  const cacheKey = `hist_${base}_${target}_${period}_${startDate}_${endDate}`;
  const cached = ratesCache.get(cacheKey);
  const now = Date.now();

  // Cache historical data for 5 minutes
  if (cached && (now - cached.timestamp < 300000)) {
    return cached.data;
  }

  try {
    const rawData = await fetchWithFallback(endpoint);
    
    // Process rates into array
    const dateEntries = Object.entries(rawData.rates || {});
    // Sort chronologically
    dateEntries.sort(([dateA], [dateB]) => new Date(dateA) - new Date(dateB));

    const dates = [];
    const rates = [];
    const dataPoints = [];

    for (const [dateStr, rateObj] of dateEntries) {
      const rateVal = rateObj[target];
      if (typeof rateVal === 'number') {
        dates.push(dateStr);
        rates.push(rateVal);
        dataPoints.push({ date: dateStr, rate: rateVal });
      }
    }

    if (rates.length === 0) {
      throw new Error(`No historical data found for ${base} -> ${target}`);
    }

    const currentRate = rates[rates.length - 1];
    const firstRate = rates[0];
    const highRate = Math.max(...rates);
    const lowRate = Math.min(...rates);
    const sum = rates.reduce((acc, curr) => acc + curr, 0);
    const avgRate = sum / rates.length;

    const changeAmount = currentRate - firstRate;
    const pctChange = ((currentRate - firstRate) / firstRate) * 100;

    const result = {
      base,
      target,
      period,
      startDate,
      endDate,
      dates,
      rates,
      dataPoints,
      currentRate,
      firstRate,
      highRate,
      lowRate,
      avgRate,
      changeAmount,
      pctChange
    };

    ratesCache.set(cacheKey, { timestamp: now, data: result });
    return result;
  } catch (error) {
    console.error(`Failed to get historical rates for ${base} -> ${target}:`, error);
    throw error;
  }
}

/**
 * Get currency metadata including symbol, flag, and full name.
 * @param {string} code - Currency 3-letter code
 * @returns {Object}
 */
export function getCurrencyInfo(code) {
  if (CURRENCY_METADATA[code]) {
    return CURRENCY_METADATA[code];
  }
  return {
    symbol: code,
    name: cachedCurrencies?.[code] || code,
    flag: '🌐',
    country: code
  };
}
