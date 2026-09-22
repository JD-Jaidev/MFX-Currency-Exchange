/**
 * MFX - Currency Converter Module
 * Manages currency selection, conversion calculation, searchable dropdowns, swap, and copy.
 */

import { getCurrencies, getLatestRates, getCurrencyInfo } from './api.js';
import { addRecentConversion, isFavorite, toggleFavorite } from './storage.js';
import { renderTrendChart, formatCurrencyValue } from './chart.js';
import { showToast } from './ui.js';

let currenciesMap = {};
let currentFromCurrency = 'USD';
let currentToCurrency = 'INR';
let currentRate = 1.0;
let currentInvertedRate = 1.0;
let isConverting = false;

/**
 * Initialize converter elements and state.
 */
export async function initConverter() {
  currenciesMap = await getCurrencies();
  populateDropdowns();
  setupConverterEventListeners();
  updateFavoriteButtonState();
  
  // Perform initial conversion
  await executeConversion();
}

/**
 * Populate custom searchable dropdown selectors.
 */
function populateDropdowns() {
  const fromSelected = document.getElementById('from-selected-display');
  const toSelected = document.getElementById('to-selected-display');

  updateSelectedDisplay('from', currentFromCurrency);
  updateSelectedDisplay('to', currentToCurrency);

  renderDropdownList('from');
  renderDropdownList('to');
}

/**
 * Update the button visual representing the currently selected currency.
 */
function updateSelectedDisplay(type, code) {
  const meta = getCurrencyInfo(code);
  const flagEl = document.getElementById(`${type}-currency-flag`);
  const codeEl = document.getElementById(`${type}-currency-code`);
  const nameEl = document.getElementById(`${type}-currency-name`);
  const symbolEl = document.getElementById(`${type}-currency-symbol`);

  if (flagEl) flagEl.textContent = meta.flag || '🌐';
  if (codeEl) codeEl.textContent = code;
  if (nameEl) nameEl.textContent = meta.name || currenciesMap[code] || code;
  if (symbolEl) symbolEl.textContent = meta.symbol || '';
}

/**
 * Render the searchable currency options list.
 */
function renderDropdownList(type, filterQuery = '') {
  const listContainer = document.getElementById(`${type}-currency-list`);
  if (!listContainer) return;

  listContainer.innerHTML = '';
  const query = filterQuery.trim().toLowerCase();

  const entries = Object.entries(currenciesMap);
  // Sort alphabetically by code
  entries.sort(([codeA], [codeB]) => codeA.localeCompare(codeB));

  let matchCount = 0;

  for (const [code, name] of entries) {
    const meta = getCurrencyInfo(code);
    const searchableText = `${code} ${name} ${meta.country || ''} ${meta.symbol || ''}`.toLowerCase();

    if (query && !searchableText.includes(query)) {
      continue;
    }

    matchCount++;
    const isSelected = (type === 'from' ? currentFromCurrency : currentToCurrency) === code;

    const itemBtn = document.createElement('button');
    itemBtn.type = 'button';
    itemBtn.className = `currency-option-item ${isSelected ? 'active' : ''}`;
    itemBtn.setAttribute('data-code', code);
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
    const emptyState = document.createElement('div');
    emptyState.className = 'currency-search-empty';
    emptyState.textContent = `No currencies found for "${filterQuery}"`;
    listContainer.appendChild(emptyState);
  }
}

/**
 * Open dropdown modal/popover
 */
function openDropdown(type) {
  const dropdown = document.getElementById(`${type}-dropdown-modal`);
  const searchInput = document.getElementById(`${type}-currency-search`);
  if (dropdown) {
    // Close any other open dropdowns
    closeDropdown(type === 'from' ? 'to' : 'from');
    dropdown.classList.add('open');
    if (searchInput) {
      searchInput.value = '';
      renderDropdownList(type, '');
      setTimeout(() => searchInput.focus(), 80);
    }
  }
}

/**
 * Close dropdown modal/popover
 */
function closeDropdown(type) {
  const dropdown = document.getElementById(`${type}-dropdown-modal`);
  if (dropdown) {
    dropdown.classList.remove('open');
  }
}

/**
 * Select a currency from dropdown
 */
export async function selectCurrency(type, code) {
  if (type === 'from') {
    if (currentFromCurrency === code) return;
    currentFromCurrency = code;
    updateSelectedDisplay('from', code);
  } else {
    if (currentToCurrency === code) return;
    currentToCurrency = code;
    updateSelectedDisplay('to', code);
  }

  updateFavoriteButtonState();
  await executeConversion();
  // Synchronize Chart
  renderTrendChart(currentFromCurrency, currentToCurrency);
}

/**
 * Set both currencies simultaneously (e.g. from quick pair or favorite click)
 */
export async function setPair(fromCode, toCode) {
  currentFromCurrency = fromCode;
  currentToCurrency = toCode;
  
  updateSelectedDisplay('from', fromCode);
  updateSelectedDisplay('to', toCode);
  
  updateFavoriteButtonState();
  await executeConversion();
  renderTrendChart(currentFromCurrency, currentToCurrency);
}

/**
 * Swap "From" and "To" currencies with smooth animation.
 */
export async function swapCurrencies() {
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
  renderTrendChart(currentFromCurrency, currentToCurrency);
  showToast(`Swapped to ${currentFromCurrency} / ${currentToCurrency}`, 'info');
}

/**
 * Perform conversion calculation.
 */
export async function executeConversion(recordHistory = true) {
  const amountInput = document.getElementById('converter-amount-input');
  const resultDisplay = document.getElementById('converter-result-value');
  const rateDisplay = document.getElementById('converter-rate-info');
  const invertedRateDisplay = document.getElementById('converter-inverted-rate');
  const dateDisplay = document.getElementById('converter-last-updated');
  const converterLoader = document.getElementById('converter-loader');

  let rawAmount = parseFloat(amountInput?.value);
  if (isNaN(rawAmount) || rawAmount < 0) {
    rawAmount = 1;
    if (amountInput) amountInput.value = '1';
  }

  if (converterLoader) converterLoader.classList.remove('hidden');
  isConverting = true;

  try {
    if (currentFromCurrency === currentToCurrency) {
      currentRate = 1.0;
      currentInvertedRate = 1.0;
      const convertedTotal = rawAmount;

      if (resultDisplay) {
        resultDisplay.textContent = `${formatCurrencyValue(convertedTotal, 2)} ${currentToCurrency}`;
      }
      if (rateDisplay) {
        rateDisplay.textContent = `1 ${currentFromCurrency} = 1.0000 ${currentToCurrency}`;
      }
      if (invertedRateDisplay) {
        invertedRateDisplay.textContent = `1 ${currentToCurrency} = 1.0000 ${currentFromCurrency}`;
      }
      if (dateDisplay) {
        dateDisplay.textContent = `Live calculation (identical currency)`;
      }
      return;
    }

    const data = await getLatestRates(currentFromCurrency, currentToCurrency);
    const rate = data.rates[currentToCurrency];

    if (typeof rate !== 'number') {
      throw new Error(`Exchange rate unavailable for ${currentFromCurrency} to ${currentToCurrency}`);
    }

    currentRate = rate;
    currentInvertedRate = rate !== 0 ? 1 / rate : 0;
    const totalAmount = rawAmount * rate;

    // Update Result UI
    if (resultDisplay) {
      resultDisplay.textContent = `${formatCurrencyValue(totalAmount, 2)} ${currentToCurrency}`;
    }

    const fromMeta = getCurrencyInfo(currentFromCurrency);
    const toMeta = getCurrencyInfo(currentToCurrency);

    if (rateDisplay) {
      rateDisplay.textContent = `1 ${currentFromCurrency} = ${formatCurrencyValue(currentRate, 4)} ${currentToCurrency}`;
    }

    if (invertedRateDisplay) {
      invertedRateDisplay.textContent = `1 ${currentToCurrency} = ${formatCurrencyValue(currentInvertedRate, 4)} ${currentFromCurrency}`;
    }

    if (dateDisplay) {
      const rateDate = data.date ? new Date(data.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Today';
      dateDisplay.textContent = `ECB Market Rate as of ${rateDate}`;
    }

    // Add to LocalStorage recents
    if (recordHistory && rawAmount > 0) {
      addRecentConversion({
        fromAmount: rawAmount,
        fromCode: currentFromCurrency,
        toAmount: totalAmount,
        toCode: currentToCurrency,
        rate: currentRate
      });
      // Dispatch custom event to notify UI to refresh recent conversions list
      window.dispatchEvent(new CustomEvent('mfx-recent-updated'));
    }

  } catch (error) {
    console.error('Conversion error:', error);
    if (resultDisplay) {
      resultDisplay.textContent = 'Conversion Failed';
    }
    if (rateDisplay) {
      rateDisplay.textContent = 'Rate unavailable. Check network.';
    }
    showToast(error.message || 'Error fetching current exchange rates', 'error');
  } finally {
    isConverting = false;
    if (converterLoader) converterLoader.classList.add('hidden');
  }
}

/**
 * Update the favorite button (filled star if favorited, outline otherwise)
 */
function updateFavoriteButtonState() {
  const favBtn = document.getElementById('btn-favorite-pair');
  if (!favBtn) return;

  const favorited = isFavorite(currentFromCurrency, currentToCurrency);
  favBtn.classList.toggle('active', favorited);
  favBtn.setAttribute('title', favorited ? 'Remove from favorites' : 'Add pair to favorites');
  favBtn.innerHTML = favorited
    ? `<svg class="icon-star filled" viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>`
    : `<svg class="icon-star outline" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>`;
}

/**
 * Handle Favorite toggle button click.
 */
function handleToggleFavorite() {
  const newState = toggleFavorite(currentFromCurrency, currentToCurrency);
  updateFavoriteButtonState();
  window.dispatchEvent(new CustomEvent('mfx-favorites-updated'));
  
  if (newState) {
    showToast(`Added ${currentFromCurrency}/${currentToCurrency} to favorites! ⭐`, 'success');
  } else {
    showToast(`Removed ${currentFromCurrency}/${currentToCurrency} from favorites`, 'info');
  }
}

/**
 * Copy converted result to clipboard.
 */
export async function copyConversionResult() {
  const amountInput = document.getElementById('converter-amount-input');
  const amount = amountInput ? amountInput.value : '1';
  const totalAmount = parseFloat(amount) * currentRate;

  const copyText = `${amount} ${currentFromCurrency} = ${formatCurrencyValue(totalAmount, 2)} ${currentToCurrency} (Rate: 1 ${currentFromCurrency} = ${formatCurrencyValue(currentRate, 4)} ${currentToCurrency})`;

  try {
    await navigator.clipboard.writeText(copyText);
    showToast(`Copied conversion to clipboard! 📋`, 'success');
  } catch (err) {
    // Fallback for older browsers
    const tempInput = document.createElement('textarea');
    tempInput.value = copyText;
    document.body.appendChild(tempInput);
    tempInput.select();
    document.execCommand('copy');
    document.body.removeChild(tempInput);
    showToast(`Copied conversion to clipboard! 📋`, 'success');
  }
}

/**
 * Setup event listeners for converter form and inputs.
 */
function setupConverterEventListeners() {
  const amountInput = document.getElementById('converter-amount-input');
  const swapBtn = document.getElementById('btn-swap-currencies');
  const favBtn = document.getElementById('btn-favorite-pair');
  const copyBtn = document.getElementById('btn-copy-result');
  const fromTrigger = document.getElementById('from-currency-trigger');
  const toTrigger = document.getElementById('to-currency-trigger');
  const fromSearch = document.getElementById('from-currency-search');
  const toSearch = document.getElementById('to-currency-search');
  const fromClose = document.getElementById('from-dropdown-close');
  const toClose = document.getElementById('to-dropdown-close');

  // Debounced amount input conversion
  let debounceTimeout;
  if (amountInput) {
    amountInput.addEventListener('input', () => {
      clearTimeout(debounceTimeout);
      debounceTimeout = setTimeout(() => {
        executeConversion(true);
      }, 300);
    });

    amountInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        executeConversion(true);
      }
    });
  }

  // Quick Amount preset buttons (+10, +100, +1000, Reset 100)
  document.querySelectorAll('.preset-amount-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const action = btn.dataset.amount;
      let currentVal = parseFloat(amountInput.value) || 0;
      if (action === '100') currentVal = 100;
      else if (action === '1000') currentVal = 1000;
      else if (action === '5000') currentVal = 5000;
      else if (action === '10000') currentVal = 10000;
      
      amountInput.value = currentVal;
      executeConversion(true);
    });
  });

  if (swapBtn) {
    swapBtn.addEventListener('click', swapCurrencies);
  }

  if (favBtn) {
    favBtn.addEventListener('click', handleToggleFavorite);
  }

  if (copyBtn) {
    copyBtn.addEventListener('click', copyConversionResult);
  }

  // Dropdown open triggers
  if (fromTrigger) {
    fromTrigger.addEventListener('click', (e) => {
      e.stopPropagation();
      openDropdown('from');
    });
  }

  if (toTrigger) {
    toTrigger.addEventListener('click', (e) => {
      e.stopPropagation();
      openDropdown('to');
    });
  }

  // Search filter typing
  if (fromSearch) {
    fromSearch.addEventListener('input', (e) => {
      renderDropdownList('from', e.target.value);
    });
  }

  if (toSearch) {
    toSearch.addEventListener('input', (e) => {
      renderDropdownList('to', e.target.value);
    });
  }

  // Dropdown close buttons
  if (fromClose) fromClose.addEventListener('click', () => closeDropdown('from'));
  if (toClose) toClose.addEventListener('click', () => closeDropdown('to'));

  // Close dropdowns on outside click
  document.addEventListener('click', (e) => {
    const fromDropdown = document.getElementById('from-dropdown-modal');
    const toDropdown = document.getElementById('to-dropdown-modal');

    if (fromDropdown && !fromDropdown.contains(e.target) && !fromTrigger?.contains(e.target)) {
      closeDropdown('from');
    }
    if (toDropdown && !toDropdown.contains(e.target) && !toTrigger?.contains(e.target)) {
      closeDropdown('to');
    }
  });

  // Close dropdown on Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeDropdown('from');
      closeDropdown('to');
    }
  });
}

/**
 * Get active converter pair.
 */
export function getActivePair() {
  return {
    from: currentFromCurrency,
    to: currentToCurrency,
    rate: currentRate,
    invertedRate: currentInvertedRate
  };
}
