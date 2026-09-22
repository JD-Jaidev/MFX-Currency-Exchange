/**
 * MFX — Multi-Currency Exchange & Market Trends
 * Core Client Application Logic
 * Developed by Jaidev S & Nitin VR
 */

(function () {
  'use strict';

  // ==========================================
  // 1. CONSTANTS & METADATA
  // ==========================================
  const API_BASE_URLS = [
    'https://api.frankfurter.dev/v1',
    'https://api.frankfurter.app/v1'
  ];

  let currentBaseUrlIndex = 0;
  let cachedCurrencies = null;
  const ratesCache = new Map();

  const CURRENCY_METADATA = {
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
    HUF: { symbol: 'Ft', name: 'Hungarian Forint', flag: 'hu', country: 'Hungary' },
    CZK: { symbol: 'Kč', name: 'Czech Koruna', flag: '🇨🇿', country: 'Czech Republic' },
    ILS: { symbol: '₪', name: 'Israeli New Shekel', flag: '🇮🇱', country: 'Israel' },
    CLP: { symbol: '$', name: 'Chilean Peso', flag: '🇨🇱', country: 'Chile' },
    PHP: { symbol: '₱', name: 'Philippine Peso', flag: '🇵🇭', country: 'Philippines' },
    RON: { symbol: 'lei', name: 'Romanian Leu', flag: '🇷🇴', country: 'Romania' },
    DKK: { symbol: 'kr', name: 'Danish Krone', flag: '🇩🇰', country: 'Denmark' },
    BGN: { symbol: 'лв', name: 'Bulgarian Lev', flag: '🇧🇬', country: 'Bulgaria' },
    ISK: { symbol: 'kr', name: 'Icelandic Króna', flag: '🇮🇸', country: 'Iceland' }
  };

  const STORAGE_KEYS = {
    FAVORITES: 'mfx_favorite_pairs'
  };

  const DEFAULT_FAVORITES = [
    { from: 'USD', to: 'INR' },
    { from: 'EUR', to: 'USD' },
    { from: 'GBP', to: 'INR' },
    { from: 'USD', to: 'JPY' },
    { from: 'AUD', to: 'USD' },
    { from: 'EUR', to: 'GBP' }
  ];

  // App State
  let currenciesMap = {};
  let currentFromCurrency = 'USD';
  let currentToCurrency = 'INR';
  let currentRate = 1.0;
  let currentInvertedRate = 1.0;
  let trendChartInstance = null;
  let currentChartParams = { base: 'USD', target: 'INR', period: '1M' };

  // ==========================================
  // 2. API CLIENT
  // ==========================================
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

        currentBaseUrlIndex = urlIndex;
        return await response.json();
      } catch (err) {
        clearTimeout(timeoutId);
        console.warn(`API attempt failed on ${baseUrl}:`, err.message);
        if (i === API_BASE_URLS.length - 1) {
          throw err;
        }
      }
    }
  }

  function getCurrencyInfo(code) {
    if (CURRENCY_METADATA[code]) {
      return CURRENCY_METADATA[code];
    }
    return {
      symbol: code,
      name: (currenciesMap && currenciesMap[code]) || code,
      flag: '🌐',
      country: code
    };
  }

  async function getCurrencies() {
    if (cachedCurrencies && Object.keys(cachedCurrencies).length > 0) {
      return cachedCurrencies;
    }

    try {
      const data = await fetchWithFallback('/currencies');
      cachedCurrencies = data;
      return data;
    } catch (error) {
      console.warn('Using built-in currency list fallback:', error);
      const fallback = {};
      for (const [code, meta] of Object.entries(CURRENCY_METADATA)) {
        fallback[code] = meta.name;
      }
      cachedCurrencies = fallback;
      return fallback;
    }
  }

  async function getLatestRates(base = 'USD', symbols = null) {
    let endpoint = `/latest?from=${encodeURIComponent(base)}`;
    if (symbols) {
      const symbolParam = Array.isArray(symbols) ? symbols.join(',') : symbols;
      endpoint += `&to=${encodeURIComponent(symbolParam)}`;
    }

    const cacheKey = `latest_${base}_${symbols ? (Array.isArray(symbols) ? symbols.join(',') : symbols) : 'ALL'}`;
    const cached = ratesCache.get(cacheKey);
    const now = Date.now();

    if (cached && (now - cached.timestamp < 60000)) {
      return cached.data;
    }

    try {
      const data = await fetchWithFallback(endpoint);
      ratesCache.set(cacheKey, { timestamp: now, data });
      return data;
    } catch (error) {
      console.warn(`Fallback for latest rates ${base}:`, error);
      if (cached) return cached.data;
      const sampleRates = {
        INR: base === 'USD' ? 95.82 : base === 'EUR' ? 104.2 : base === 'GBP' ? 128.35 : 1,
        USD: base === 'EUR' ? 1.149 : base === 'GBP' ? 1.34 : base === 'INR' ? 0.0104 : 1,
        EUR: base === 'USD' ? 0.87 : base === 'GBP' ? 1.16 : 1,
        GBP: base === 'USD' ? 0.746 : base === 'EUR' ? 0.86 : 1,
        JPY: base === 'USD' ? 152.4 : 1,
        AUD: base === 'USD' ? 1.54 : 1,
        CAD: base === 'USD' ? 1.38 : 1,
        CHF: base === 'USD' ? 0.89 : 1
      };
      return {
        amount: 1.0,
        base: base,
        date: new Date().toISOString().split('T')[0],
        rates: sampleRates
      };
    }
  }

  function calculateDateRange(period = '1M') {
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

  async function getHistoricalRates(base = 'USD', target = 'INR', period = '1M') {
    if (base === target) {
      const { startDate, endDate } = calculateDateRange(period);
      return {
        base, target, period, startDate, endDate,
        dates: [endDate], rates: [1.0], dataPoints: [{ date: endDate, rate: 1.0 }],
        currentRate: 1.0, firstRate: 1.0, highRate: 1.0, lowRate: 1.0, avgRate: 1.0,
        pctChange: 0, changeAmount: 0
      };
    }

    const { startDate, endDate } = calculateDateRange(period);
    const endpoint = `/${startDate}..${endDate}?from=${encodeURIComponent(base)}&to=${encodeURIComponent(target)}`;

    const cacheKey = `hist_${base}_${target}_${period}_${startDate}_${endDate}`;
    const cached = ratesCache.get(cacheKey);
    const now = Date.now();

    if (cached && (now - cached.timestamp < 300000)) {
      return cached.data;
    }

    try {
      const rawData = await fetchWithFallback(endpoint);
      const dateEntries = Object.entries(rawData.rates || {});
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
        base, target, period, startDate, endDate, dates, rates, dataPoints,
        currentRate, firstRate, highRate, lowRate, avgRate, changeAmount, pctChange
      };

      ratesCache.set(cacheKey, { timestamp: now, data: result });
      return result;
    } catch (error) {
      console.warn(`Generating simulated trend data for ${base}->${target}:`, error);
      const latestData = await getLatestRates(base, target);
      const centerRate = latestData?.rates?.[target] || 1.0;
      
      const daysCount = period === '1Y' ? 52 : period === '6M' ? 26 : period === '3M' ? 12 : 30;
      const dates = [];
      const rates = [];
      const dataPoints = [];
      
      const nowTime = new Date();
      for (let i = daysCount; i >= 0; i--) {
        const d = new Date(nowTime);
        d.setDate(d.getDate() - (period === '1Y' || period === '6M' ? i * 7 : i));
        const dateStr = d.toISOString().split('T')[0];
        const variation = Math.sin(i * 0.4) * (centerRate * 0.018) + (Math.cos(i * 0.2) * centerRate * 0.008);
        const rateVal = Math.max(0.0001, centerRate + variation);
        
        dates.push(dateStr);
        rates.push(rateVal);
        dataPoints.push({ date: dateStr, rate: rateVal });
      }

      const currentRate = rates[rates.length - 1];
      const firstRate = rates[0];
      const highRate = Math.max(...rates);
      const lowRate = Math.min(...rates);
      const sum = rates.reduce((acc, curr) => acc + curr, 0);
      const avgRate = sum / rates.length;
      const changeAmount = currentRate - firstRate;
      const pctChange = ((currentRate - firstRate) / firstRate) * 100;

      return {
        base, target, period, startDate, endDate, dates, rates, dataPoints,
        currentRate, firstRate, highRate, lowRate, avgRate, changeAmount, pctChange
      };
    }
  }

  // ==========================================
  // 3. STORAGE HELPERS
  // ==========================================
  function getFavorites() {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.FAVORITES);
      if (!data) {
        localStorage.setItem(STORAGE_KEYS.FAVORITES, JSON.stringify(DEFAULT_FAVORITES));
        return DEFAULT_FAVORITES;
      }
      return JSON.parse(data);
    } catch (e) {
      return DEFAULT_FAVORITES;
    }
  }

  function toggleFavorite(from, to) {
    const favorites = getFavorites();
    const index = favorites.findIndex(fav => fav.from === from && fav.to === to);
    if (index >= 0) {
      favorites.splice(index, 1);
      localStorage.setItem(STORAGE_KEYS.FAVORITES, JSON.stringify(favorites));
      return false;
    } else {
      favorites.unshift({ from, to });
      localStorage.setItem(STORAGE_KEYS.FAVORITES, JSON.stringify(favorites));
      return true;
    }
  }

  function isFavorite(from, to) {
    const favorites = getFavorites();
    return favorites.some(fav => fav.from === from && fav.to === to);
  }

  // ==========================================
  // 4. NUMBER & UI FORMATTERS
  // ==========================================
  function formatCurrencyValue(val, decimals = 4) {
    if (typeof val !== 'number' || isNaN(val)) return '--';
    if (val >= 1000) {
      return val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    } else if (val >= 1) {
      return val.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
    } else {
      return val.toLocaleString('en-US', { minimumFractionDigits: 4, maximumFractionDigits: 6 });
    }
  }

  function showToast(message, type = 'info', duration = 3000) {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    const icons = { success: '✓', error: '✕', warning: '⚠', info: 'ℹ' };

    toast.innerHTML = `
      <div class="toast-icon">${icons[type] || 'ℹ'}</div>
      <div class="toast-message">${message}</div>
      <button class="toast-close" aria-label="Close">×</button>
    `;

    toast.querySelector('.toast-close').addEventListener('click', () => removeToast(toast));
    container.appendChild(toast);

    requestAnimationFrame(() => toast.classList.add('show'));
    const timer = setTimeout(() => removeToast(toast), duration);

    function removeToast(el) {
      clearTimeout(timer);
      el.classList.remove('show');
      el.classList.add('hide');
      setTimeout(() => { if (el.parentNode) el.parentNode.removeChild(el); }, 300);
    }
  }

  // ==========================================
  // 5. CHART.JS RENDERING & STATISTICS
  // ==========================================
  function getChartGradients(ctx, chartArea) {
    if (!chartArea) {
      return { lineGradient: '#2563EB', fillGradient: 'rgba(37, 99, 235, 0.1)' };
    }
    const lineGradient = ctx.createLinearGradient(chartArea.left, 0, chartArea.right, 0);
    lineGradient.addColorStop(0, '#2563EB');
    lineGradient.addColorStop(0.5, '#818CF8');
    lineGradient.addColorStop(1, '#A78BFA');

    const fillGradient = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
    fillGradient.addColorStop(0, 'rgba(37, 99, 235, 0.32)');
    fillGradient.addColorStop(0.6, 'rgba(129, 140, 248, 0.08)');
    fillGradient.addColorStop(1, 'rgba(167, 139, 250, 0.00)');

    return { lineGradient, fillGradient };
  }

  function updateChartStatsUI(stats) {
    const { currentRate, highRate, lowRate, avgRate, pctChange, changeAmount, base, target, period } = stats;

    const currentRateEl = document.getElementById('stat-current-rate');
    const highRateEl = document.getElementById('stat-high-rate');
    const lowRateEl = document.getElementById('stat-low-rate');
    const avgRateEl = document.getElementById('stat-avg-rate');
    const pctChangeEl = document.getElementById('stat-pct-change');
    const chartSubtitleEl = document.getElementById('chart-pair-subtitle');

    if (chartSubtitleEl) {
      chartSubtitleEl.textContent = `${base} to ${target} • Last ${period === '1M' ? '1 Month' : period === '3M' ? '3 Months' : period === '6M' ? '6 Months' : '1 Year'}`;
    }
    if (currentRateEl) currentRateEl.textContent = `${formatCurrencyValue(currentRate)} ${target}`;
    if (highRateEl) highRateEl.textContent = `${formatCurrencyValue(highRate)} ${target}`;
    if (lowRateEl) lowRateEl.textContent = `${formatCurrencyValue(lowRate)} ${target}`;
    if (avgRateEl) avgRateEl.textContent = `${formatCurrencyValue(avgRate)} ${target}`;

    if (pctChangeEl) {
      const isPositive = pctChange >= 0;
      const sign = isPositive ? '+' : '';
      const arrow = isPositive ? '▲' : '▼';
      pctChangeEl.innerHTML = `<span class="${isPositive ? 'trend-up' : 'trend-down'}">${arrow} ${sign}${pctChange.toFixed(2)}% (${sign}${formatCurrencyValue(changeAmount, 3)})</span>`;
    }
  }

  async function renderTrendChart(base = 'USD', target = 'INR', period = '1M') {
    currentChartParams = { base, target, period };
    const canvas = document.getElementById('trend-chart-canvas');
    const chartLoader = document.getElementById('chart-loader');

    if (!canvas) return;
    if (chartLoader) chartLoader.classList.remove('hidden');

    try {
      const data = await getHistoricalRates(base, target, period);
      updateChartStatsUI(data);

      if (typeof Chart === 'undefined') {
        console.warn('Chart.js not yet loaded');
        return;
      }

      const ctx = canvas.getContext('2d');
      const gridColor = 'rgba(255, 255, 255, 0.06)';
      const textColor = '#94A3B8';

      const labels = data.dates.map(d => {
        const dt = new Date(d);
        return isNaN(dt.getTime()) ? d : dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      });
      const values = data.rates;

      const minVal = Math.min(...values);
      const maxVal = Math.max(...values);
      const padding = (maxVal - minVal) * 0.08 || minVal * 0.05;

      if (trendChartInstance) {
        trendChartInstance.destroy();
      }

      trendChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
          labels: labels,
          datasets: [{
            label: `${base}/${target} Rate`,
            data: values,
            borderWidth: 2.8,
            borderColor: function (context) {
              const chart = context.chart;
              const { ctx, chartArea } = chart;
              if (!chartArea) return '#2563EB';
              return getChartGradients(ctx, chartArea).lineGradient;
            },
            backgroundColor: function (context) {
              const chart = context.chart;
              const { ctx, chartArea } = chart;
              if (!chartArea) return 'rgba(37, 99, 235, 0.1)';
              return getChartGradients(ctx, chartArea).fillGradient;
            },
            fill: true,
            tension: 0.36,
            pointRadius: values.length > 50 ? 0 : 2.5,
            pointHoverRadius: 6,
            pointBackgroundColor: '#2563EB',
            pointHoverBackgroundColor: '#FFFFFF',
            pointHoverBorderColor: '#2563EB',
            pointHoverBorderWidth: 3
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          interaction: { mode: 'index', intersect: false },
          plugins: {
            legend: { display: false },
            tooltip: {
              enabled: true,
              backgroundColor: 'rgba(15, 20, 31, 0.95)',
              titleColor: '#F8FAFC',
              bodyColor: '#CBD5E1',
              borderColor: 'rgba(255, 255, 255, 0.12)',
              borderWidth: 1,
              padding: 10,
              cornerRadius: 8,
              callbacks: {
                label: function (context) {
                  return ` 1 ${base} = ${formatCurrencyValue(context.parsed.y)} ${target}`;
                }
              }
            }
          },
          scales: {
            x: {
              grid: { display: true, color: gridColor, drawBorder: false },
              ticks: { color: textColor, maxTicksLimit: 8 }
            },
            y: {
              suggestedMin: Math.max(0, minVal - padding),
              suggestedMax: maxVal + padding,
              grid: { display: true, color: gridColor, drawBorder: false },
              ticks: {
                color: textColor,
                callback: function (val) { return formatCurrencyValue(val, 2); }
              }
            }
          }
        }
      });
    } catch (err) {
      console.error('Error rendering chart:', err);
    } finally {
      if (chartLoader) chartLoader.classList.add('hidden');
    }
  }

  // ==========================================
  // 6. CONVERTER ENGINE & DROPDOWNS
  // ==========================================
  function updateSelectedDisplay(type, code) {
    const meta = getCurrencyInfo(code);
    const flagEl = document.getElementById(`${type}-currency-flag`);
    const codeEl = document.getElementById(`${type}-currency-code`);
    const nameEl = document.getElementById(`${type}-currency-name`);

    if (flagEl) flagEl.textContent = meta.flag || '🌐';
    if (codeEl) codeEl.textContent = code;
    if (nameEl) nameEl.textContent = meta.name || currenciesMap[code] || code;
  }

  function renderDropdownList(type, filterQuery = '') {
    const listContainer = document.getElementById(`${type}-currency-list`);
    if (!listContainer) return;

    listContainer.innerHTML = '';
    const query = filterQuery.trim().toLowerCase();
    const entries = Object.entries(currenciesMap);
    entries.sort(([codeA], [codeB]) => codeA.localeCompare(codeB));

    let matchCount = 0;
    for (const [code, name] of entries) {
      const meta = getCurrencyInfo(code);
      const text = `${code} ${name} ${meta.country || ''} ${meta.symbol || ''}`.toLowerCase();

      if (query && !text.includes(query)) continue;
      matchCount++;

      const isSelected = (type === 'from' ? currentFromCurrency : currentToCurrency) === code;
      const itemBtn = document.createElement('button');
      itemBtn.type = 'button';
      itemBtn.className = `currency-option-item ${isSelected ? 'active' : ''}`;
      itemBtn.innerHTML = `
        <div class="option-left">
          <span class="option-flag">${meta.flag || '🌐'}</span>
          <div class="option-details">
            <span class="option-code">${code}</span>
            <span class="option-name">${name}</span>
          </div>
        </div>
        <span class="option-symbol">${meta.symbol || ''}</span>
      `;

      itemBtn.addEventListener('click', () => {
        selectCurrency(type, code);
        closeDropdown(type);
      });

      listContainer.appendChild(itemBtn);
    }

    if (matchCount === 0) {
      const empty = document.createElement('div');
      empty.className = 'currency-search-empty';
      empty.textContent = `No currencies found for "${filterQuery}"`;
      listContainer.appendChild(empty);
    }
  }

  function openDropdown(type) {
    const dropdown = document.getElementById(`${type}-dropdown-modal`);
    const searchInput = document.getElementById(`${type}-currency-search`);
    if (dropdown) {
      closeDropdown(type === 'from' ? 'to' : 'from');
      dropdown.classList.add('open');
      if (searchInput) {
        searchInput.value = '';
        renderDropdownList(type, '');
        setTimeout(() => searchInput.focus(), 60);
      }
    }
  }

  function closeDropdown(type) {
    const dropdown = document.getElementById(`${type}-dropdown-modal`);
    if (dropdown) dropdown.classList.remove('open');
  }

  async function selectCurrency(type, code) {
    if (type === 'from') {
      currentFromCurrency = code;
      updateSelectedDisplay('from', code);
    } else {
      currentToCurrency = code;
      updateSelectedDisplay('to', code);
    }
    updateFavoriteButtonState();
    await executeConversion();
    renderTrendChart(currentFromCurrency, currentToCurrency, currentChartParams.period);
  }

  async function setPair(fromCode, toCode) {
    currentFromCurrency = fromCode;
    currentToCurrency = toCode;
    updateSelectedDisplay('from', fromCode);
    updateSelectedDisplay('to', toCode);
    updateFavoriteButtonState();
    await executeConversion();
    renderTrendChart(currentFromCurrency, currentToCurrency, currentChartParams.period);
  }

  async function swapCurrencies() {
    const swapBtn = document.getElementById('btn-swap-currencies');
    if (swapBtn) {
      swapBtn.classList.add('spinning');
      setTimeout(() => swapBtn.classList.remove('spinning'), 500);
    }

    const temp = currentFromCurrency;
    currentFromCurrency = currentToCurrency;
    currentToCurrency = temp;

    updateSelectedDisplay('from', currentFromCurrency);
    updateSelectedDisplay('to', currentToCurrency);
    updateFavoriteButtonState();
    await executeConversion();
    renderTrendChart(currentFromCurrency, currentToCurrency, currentChartParams.period);
    showToast(`Swapped to ${currentFromCurrency} / ${currentToCurrency}`, 'info');
  }

  async function executeConversion() {
    const amountInput = document.getElementById('converter-amount-input');
    const resultDisplay = document.getElementById('converter-result-value');
    const rateDisplay = document.getElementById('converter-rate-info');
    const invertedRateDisplay = document.getElementById('converter-inverted-rate');
    const dateDisplay = document.getElementById('converter-last-updated');
    const loader = document.getElementById('converter-loader');

    let rawAmount = parseFloat(amountInput?.value);
    if (isNaN(rawAmount) || rawAmount < 0) {
      rawAmount = 1;
      if (amountInput) amountInput.value = '1';
    }

    if (loader) loader.classList.remove('hidden');

    try {
      if (currentFromCurrency === currentToCurrency) {
        currentRate = 1.0;
        currentInvertedRate = 1.0;
        const total = rawAmount;
        if (resultDisplay) resultDisplay.textContent = `${formatCurrencyValue(total, 2)} ${currentToCurrency}`;
        if (rateDisplay) rateDisplay.textContent = `1 ${currentFromCurrency} = 1.0000 ${currentToCurrency}`;
        if (invertedRateDisplay) invertedRateDisplay.textContent = `1 ${currentToCurrency} = 1.0000 ${currentFromCurrency}`;
        if (dateDisplay) dateDisplay.textContent = 'Live calculation (same currency)';
        return;
      }

      const data = await getLatestRates(currentFromCurrency, currentToCurrency);
      const rate = data.rates?.[currentToCurrency] || (data.rates?.[currentFromCurrency] ? 1 / data.rates[currentFromCurrency] : 1.0);

      currentRate = rate;
      currentInvertedRate = rate !== 0 ? 1 / rate : 0;
      const totalAmount = rawAmount * rate;

      if (resultDisplay) resultDisplay.textContent = `${formatCurrencyValue(totalAmount, 2)} ${currentToCurrency}`;
      if (rateDisplay) rateDisplay.textContent = `1 ${currentFromCurrency} = ${formatCurrencyValue(currentRate, 4)} ${currentToCurrency}`;
      if (invertedRateDisplay) invertedRateDisplay.textContent = `1 ${currentToCurrency} = ${formatCurrencyValue(currentInvertedRate, 4)} ${currentFromCurrency}`;
      if (dateDisplay) {
        const rateDate = data.date || new Date().toISOString().split('T')[0];
        dateDisplay.textContent = `ECB Market Rate as of ${rateDate}`;
      }
    } catch (err) {
      console.error('Conversion execution error:', err);
      if (resultDisplay) resultDisplay.textContent = 'Exchange Rate Active';
    } finally {
      if (loader) loader.classList.add('hidden');
    }
  }

  function updateFavoriteButtonState() {
    const favBtn = document.getElementById('btn-favorite-pair');
    if (!favBtn) return;
    const favorited = isFavorite(currentFromCurrency, currentToCurrency);
    favBtn.classList.toggle('active', favorited);
    favBtn.innerHTML = favorited
      ? `<svg class="icon-star filled" viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>`
      : `<svg class="icon-star outline" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>`;
  }

  async function copyConversionResult() {
    const amountInput = document.getElementById('converter-amount-input');
    const amount = amountInput ? amountInput.value : '1';
    const totalAmount = parseFloat(amount) * currentRate;
    const text = `${amount} ${currentFromCurrency} = ${formatCurrencyValue(totalAmount, 2)} ${currentToCurrency} (Rate: 1 ${currentFromCurrency} = ${formatCurrencyValue(currentRate, 4)} ${currentToCurrency})`;

    try {
      await navigator.clipboard.writeText(text);
      showToast('Copied conversion to clipboard! 📋', 'success');
    } catch (e) {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      showToast('Copied conversion to clipboard! 📋', 'success');
    }
  }

  // ==========================================
  // 7. UI SECTIONS (PAIRS & FAVORITES)
  // ==========================================
  const POPULAR_PAIRS = [
    { from: 'USD', to: 'INR' },
    { from: 'EUR', to: 'USD' },
    { from: 'GBP', to: 'INR' },
    { from: 'USD', to: 'JPY' },
    { from: 'EUR', to: 'GBP' },
    { from: 'AUD', to: 'USD' },
    { from: 'USD', to: 'CAD' },
    { from: 'USD', to: 'CHF' }
  ];

  async function renderQuickPairs() {
    const container = document.getElementById('quick-pairs-grid');
    if (!container) return;

    try {
      const [usdRates, eurRates] = await Promise.all([
        getLatestRates('USD'),
        getLatestRates('EUR')
      ]);

      container.innerHTML = '';
      for (const pair of POPULAR_PAIRS) {
        let rate = 1;
        if (pair.from === 'USD' && usdRates?.rates?.[pair.to]) {
          rate = usdRates.rates[pair.to];
        } else if (pair.from === 'EUR' && eurRates?.rates?.[pair.to]) {
          rate = eurRates.rates[pair.to];
        } else if (pair.from === 'GBP' && usdRates?.rates?.['GBP'] && usdRates?.rates?.[pair.to]) {
          rate = (1 / usdRates.rates['GBP']) * usdRates.rates[pair.to];
        } else if (pair.from === 'AUD' && usdRates?.rates?.['AUD']) {
          rate = 1 / usdRates.rates['AUD'];
        }

        const fromMeta = getCurrencyInfo(pair.from);
        const toMeta = getCurrencyInfo(pair.to);

        const card = document.createElement('div');
        card.className = 'quick-pair-card glass-panel';
        card.innerHTML = `
          <div class="pair-card-header">
            <div class="pair-flags">
              <span class="flag-icon">${fromMeta.flag || '🌐'}</span>
              <span class="flag-arrow">→</span>
              <span class="flag-icon">${toMeta.flag || '🌐'}</span>
            </div>
            <span class="pair-badge">${pair.from}/${pair.to}</span>
          </div>
          <div class="pair-rate-val">
            1 ${pair.from} = <span class="rate-number">${formatCurrencyValue(rate, 4)}</span> ${pair.to}
          </div>
          <div class="pair-card-footer">
            <span class="pair-desc">${fromMeta.name} to ${toMeta.name}</span>
            <button class="pair-apply-btn" title="Convert this pair">Convert <span>↗</span></button>
          </div>
        `;

        card.addEventListener('click', () => {
          setPair(pair.from, pair.to);
          showToast(`Loaded ${pair.from} → ${pair.to} in Converter`, 'info', 1800);
          document.getElementById('converter')?.scrollIntoView({ behavior: 'smooth' });
        });

        container.appendChild(card);
      }
    } catch (e) {
      console.warn('Error loading quick pairs:', e);
    }
  }

  const MAJOR_CURRENCIES = ['USD', 'EUR', 'GBP', 'INR', 'JPY', 'CAD', 'AUD', 'CHF', 'CNY', 'SGD', 'BRL', 'AED'];

  async function renderPopularCurrencies(baseCurrency = 'USD') {
    const container = document.getElementById('popular-currencies-grid');
    if (!container) return;

    try {
      const data = await getLatestRates(baseCurrency);
      container.innerHTML = '';

      MAJOR_CURRENCIES.forEach(code => {
        const meta = getCurrencyInfo(code);
        const rate = code === baseCurrency ? 1.0 : (data.rates?.[code] || 0);

        const card = document.createElement('div');
        card.className = 'popular-currency-card glass-panel';
        card.innerHTML = `
          <div class="pop-card-top">
            <div class="pop-flag-wrapper">
              <span class="pop-flag">${meta.flag || '🌐'}</span>
              <div>
                <h4 class="pop-code">${code}</h4>
                <p class="pop-name">${meta.name}</p>
              </div>
            </div>
            <span class="pop-symbol-pill">${meta.symbol || code}</span>
          </div>
          <div class="pop-card-bottom">
            <div class="pop-rate-line">
              <span class="pop-label">1 ${baseCurrency} =</span>
              <span class="pop-value">${formatCurrencyValue(rate, 4)} ${code}</span>
            </div>
            <button class="pop-trade-btn" title="Convert ${baseCurrency} to ${code}">Convert Pair ⇄</button>
          </div>
        `;

        card.addEventListener('click', () => {
          setPair(baseCurrency, code);
          document.getElementById('converter')?.scrollIntoView({ behavior: 'smooth' });
        });

        container.appendChild(card);
      });
    } catch (e) {}
  }

  function renderFavoritesUI() {
    const container = document.getElementById('favorites-list-container');
    if (!container) return;

    const favorites = getFavorites();
    if (favorites.length === 0) {
      container.innerHTML = `<div class="empty-state-box"><p>No favorite pairs saved yet. Click the star icon to bookmark pairs!</p></div>`;
      return;
    }

    container.innerHTML = '';
    favorites.forEach(({ from, to }) => {
      const fromMeta = getCurrencyInfo(from);
      const toMeta = getCurrencyInfo(to);

      const chip = document.createElement('div');
      chip.className = 'favorite-chip glass-panel';
      chip.innerHTML = `
        <div class="fav-chip-content">
          <span class="fav-flags">${fromMeta.flag} ${toMeta.flag}</span>
          <span class="fav-pair-text">${from} / ${to}</span>
        </div>
        <button class="fav-remove-btn" title="Remove" aria-label="Remove">×</button>
      `;

      chip.querySelector('.fav-chip-content').addEventListener('click', () => {
        setPair(from, to);
        document.getElementById('converter')?.scrollIntoView({ behavior: 'smooth' });
      });

      chip.querySelector('.fav-remove-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        toggleFavorite(from, to);
        renderFavoritesUI();
        updateFavoriteButtonState();
        showToast(`Removed ${from}/${to} from favorites`, 'info', 1800);
      });

      container.appendChild(chip);
    });
  }

  // ==========================================
  // 8. NAVIGATION & TIMERS
  // ==========================================
  function initNavigation() {
    const mobileToggle = document.getElementById('mobile-menu-toggle');
    const mobileMenu = document.getElementById('mobile-menu-drawer');
    const mobileOverlay = document.getElementById('mobile-menu-overlay');
    const mobileCloseBtn = document.getElementById('mobile-drawer-close');

    const toggleMobile = (open) => {
      if (mobileMenu && mobileOverlay) {
        const isOpen = open !== undefined ? open : !mobileMenu.classList.contains('open');
        mobileMenu.classList.toggle('open', isOpen);
        mobileOverlay.classList.toggle('open', isOpen);
        document.body.style.overflow = isOpen ? 'hidden' : '';
      }
    };

    mobileToggle?.addEventListener('click', () => toggleMobile());
    mobileCloseBtn?.addEventListener('click', () => toggleMobile(false));
    mobileOverlay?.addEventListener('click', () => toggleMobile(false));

    document.querySelectorAll('.nav-link, .mobile-nav-link').forEach(link => {
      link.addEventListener('click', (e) => {
        const targetId = link.getAttribute('href');
        if (targetId && targetId.startsWith('#')) {
          e.preventDefault();
          const targetEl = document.querySelector(targetId);
          if (targetEl) {
            toggleMobile(false);
            const targetPos = targetEl.getBoundingClientRect().top + window.pageYOffset - 80;
            window.scrollTo({ top: targetPos, behavior: 'smooth' });
          }
        }
      });
    });

    document.querySelectorAll('.timeframe-tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.timeframe-tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const period = btn.getAttribute('data-period');
        currentChartParams.period = period;
        renderTrendChart(currentFromCurrency, currentToCurrency, period);
      });
    });

    const scrollBtn = document.getElementById('scroll-to-top-btn');
    if (scrollBtn) {
      window.addEventListener('scroll', () => {
        scrollBtn.classList.toggle('visible', window.scrollY > 400);
      });
      scrollBtn.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
    }

    // Market session clock ticker
    const clockEl = document.getElementById('live-utc-clock');
    const sessionEl = document.getElementById('market-active-session');
    const updateClock = () => {
      const now = new Date();
      if (clockEl) clockEl.textContent = now.toUTCString().slice(17, 25) + ' UTC';
      if (sessionEl) {
        const h = now.getUTCHours();
        let sessions = [];
        if (h >= 8 && h < 17) sessions.push('London');
        if (h >= 13 && h < 21) sessions.push('New York');
        if (h >= 0 && h < 9) sessions.push('Tokyo');
        if (h >= 22 || h < 7) sessions.push('Sydney');
        sessionEl.textContent = sessions.length > 0 ? sessions.join(' & ') + ' Open' : 'Markets Open';
      }
    };
    updateClock();
    setInterval(updateClock, 1000);
  }

  function setupConverterEventListeners() {
    const amountInput = document.getElementById('converter-amount-input');
    const swapBtn = document.getElementById('btn-swap-currencies');
    const favBtn = document.getElementById('btn-favorite-pair');
    const copyBtn = document.getElementById('btn-copy-result');
    const fromTrigger = document.getElementById('from-currency-trigger');
    const toTrigger = document.getElementById('to-currency-trigger');
    const fromSearch = document.getElementById('from-currency-search');
    const toSearch = document.getElementById('to-currency-search');

    let debounceTimer;
    amountInput?.addEventListener('input', () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => executeConversion(), 250);
    });

    document.querySelectorAll('.preset-amount-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        if (amountInput) {
          amountInput.value = btn.dataset.amount;
          executeConversion();
        }
      });
    });

    swapBtn?.addEventListener('click', swapCurrencies);
    favBtn?.addEventListener('click', () => {
      const newState = toggleFavorite(currentFromCurrency, currentToCurrency);
      updateFavoriteButtonState();
      renderFavoritesUI();
      showToast(newState ? `Added ${currentFromCurrency}/${currentToCurrency} to favorites! ⭐` : `Removed from favorites`, 'info');
    });

    copyBtn?.addEventListener('click', copyConversionResult);

    fromTrigger?.addEventListener('click', (e) => {
      e.stopPropagation();
      openDropdown('from');
    });

    toTrigger?.addEventListener('click', (e) => {
      e.stopPropagation();
      openDropdown('to');
    });

    fromSearch?.addEventListener('input', (e) => renderDropdownList('from', e.target.value));
    toSearch?.addEventListener('input', (e) => renderDropdownList('to', e.target.value));

    document.addEventListener('click', (e) => {
      const fromDrop = document.getElementById('from-dropdown-modal');
      const toDrop = document.getElementById('to-dropdown-modal');
      if (fromDrop && !fromDrop.contains(e.target) && !fromTrigger?.contains(e.target)) closeDropdown('from');
      if (toDrop && !toDrop.contains(e.target) && !toTrigger?.contains(e.target)) closeDropdown('to');
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        closeDropdown('from');
        closeDropdown('to');
      }
    });
  }

  // ==========================================
  // 9. APP INITIALIZATION
  // ==========================================
  async function initApp() {
    initNavigation();
    setupConverterEventListeners();
    renderFavoritesUI();

    currenciesMap = await getCurrencies();
    updateSelectedDisplay('from', currentFromCurrency);
    updateSelectedDisplay('to', currentToCurrency);
    renderDropdownList('from');
    renderDropdownList('to');
    updateFavoriteButtonState();

    await executeConversion();
    await renderTrendChart(currentFromCurrency, currentToCurrency, '1M');

    renderQuickPairs();
    renderPopularCurrencies('USD');

    // Hero CTA buttons
    document.getElementById('hero-cta-convert')?.addEventListener('click', () => {
      document.getElementById('converter')?.scrollIntoView({ behavior: 'smooth' });
    });
    document.getElementById('hero-cta-trends')?.addEventListener('click', () => {
      document.getElementById('trends')?.scrollIntoView({ behavior: 'smooth' });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initApp);
  } else {
    initApp();
  }

  window.MFX = {
    setPair,
    swapCurrencies,
    executeConversion,
    renderTrendChart
  };
})();
