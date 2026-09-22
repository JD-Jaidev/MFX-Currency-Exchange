/**
 * MFX - UI & Interactive Components Module
 * Controls Theme Toggle, Toast Notifications, Quick Pairs, Favorites, Recents, and Navigation.
 */

import { getThemePreference, saveThemePreference, getFavorites, toggleFavorite, getRecentConversions, removeRecentConversion, clearRecentConversions } from './storage.js';
import { getLatestRates, getCurrencyInfo, CURRENCY_METADATA } from './api.js';
import { setPair, getActivePair } from './converter.js';
import { setChartPeriod, setChartCurrencies, renderTrendChart, formatCurrencyValue } from './chart.js';

/**
 * Toast Notification System
 */
export function showToast(message, type = 'info', duration = 3200) {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;

  const icons = {
    success: '✓',
    error: '✕',
    warning: '⚠',
    info: 'ℹ'
  };

  toast.innerHTML = `
    <div class="toast-icon">${icons[type] || 'ℹ'}</div>
    <div class="toast-message">${message}</div>
    <button class="toast-close" aria-label="Close notification">×</button>
  `;

  toast.querySelector('.toast-close').addEventListener('click', () => {
    removeToast(toast);
  });

  container.appendChild(toast);

  // Trigger entry animation
  requestAnimationFrame(() => {
    toast.classList.add('show');
  });

  const timer = setTimeout(() => {
    removeToast(toast);
  }, duration);

  function removeToast(el) {
    clearTimeout(timer);
    el.classList.remove('show');
    el.classList.add('hide');
    setTimeout(() => {
      if (el.parentNode) el.parentNode.removeChild(el);
    }, 300);
  }
}

/**
 * Theme Management (Dark / Light mode)
 */
export function initTheme() {
  const savedTheme = getThemePreference();
  applyTheme(savedTheme);

  const themeToggleBtn = document.getElementById('theme-toggle-btn');
  const mobileThemeToggleBtn = document.getElementById('mobile-theme-toggle-btn');

  const toggleHandler = () => {
    const currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    applyTheme(newTheme);
    saveThemePreference(newTheme);
    showToast(`Switched to ${newTheme.toUpperCase()} mode`, 'info', 2000);
    
    // Re-render chart to adjust grid colors
    const active = getActivePair();
    renderTrendChart(active.from, active.to);
  };

  if (themeToggleBtn) themeToggleBtn.addEventListener('click', toggleHandler);
  if (mobileThemeToggleBtn) mobileThemeToggleBtn.addEventListener('click', toggleHandler);
}

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  const themeIcons = document.querySelectorAll('.theme-toggle-icon');
  themeIcons.forEach(icon => {
    icon.textContent = theme === 'dark' ? '☀️' : '🌙';
  });
}

/**
 * Quick Currency Pairs Section
 * Displays popular pairs with live exchange rate chips and 1-click convert action.
 */
const POPULAR_PAIRS = [
  { from: 'USD', to: 'INR', name: 'USD / INR' },
  { from: 'EUR', to: 'USD', name: 'EUR / USD' },
  { from: 'GBP', to: 'INR', name: 'GBP / INR' },
  { from: 'USD', to: 'JPY', name: 'USD / JPY' },
  { from: 'EUR', to: 'GBP', name: 'EUR / GBP' },
  { from: 'AUD', to: 'USD', name: 'AUD / USD' },
  { from: 'USD', to: 'CAD', name: 'USD / CAD' },
  { from: 'USD', to: 'CHF', name: 'USD / CHF' }
];

export async function renderQuickPairs() {
  const container = document.getElementById('quick-pairs-grid');
  if (!container) return;

  container.innerHTML = `
    <div class="loading-cards-placeholder">
      <div class="skeleton-card"></div>
      <div class="skeleton-card"></div>
      <div class="skeleton-card"></div>
      <div class="skeleton-card"></div>
    </div>
  `;

  try {
    // Fetch USD and EUR base rates to calculate fast rates
    const [usdRates, eurRates] = await Promise.all([
      getLatestRates('USD'),
      getLatestRates('EUR')
    ]);

    container.innerHTML = '';

    for (const pair of POPULAR_PAIRS) {
      let rate = 1;
      if (pair.from === 'USD' && usdRates?.rates[pair.to]) {
        rate = usdRates.rates[pair.to];
      } else if (pair.from === 'EUR' && eurRates?.rates[pair.to]) {
        rate = eurRates.rates[pair.to];
      } else if (pair.from === 'GBP' && usdRates?.rates['GBP'] && usdRates?.rates[pair.to]) {
        rate = (1 / usdRates.rates['GBP']) * usdRates.rates[pair.to];
      } else if (pair.from === 'AUD' && usdRates?.rates['AUD']) {
        rate = (1 / usdRates.rates['AUD']);
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
          <button class="pair-apply-btn" title="Convert this pair">
            Convert <span>↗</span>
          </button>
        </div>
      `;

      card.addEventListener('click', () => {
        setPair(pair.from, pair.to);
        showToast(`Loaded ${pair.from} → ${pair.to} in Converter`, 'info', 2000);
        document.getElementById('converter')?.scrollIntoView({ behavior: 'smooth' });
      });

      container.appendChild(card);
    }
  } catch (err) {
    console.error('Error rendering quick pairs:', err);
    container.innerHTML = `<div class="error-panel">Live quick pairs temporarily unavailable.</div>`;
  }
}

/**
 * Popular Currencies Showcase Grid
 */
const MAJOR_CURRENCIES = ['USD', 'EUR', 'GBP', 'INR', 'JPY', 'CAD', 'AUD', 'CHF', 'CNY', 'SGD', 'BRL', 'AED'];

export async function renderPopularCurrencies(baseCurrency = 'USD') {
  const container = document.getElementById('popular-currencies-grid');
  if (!container) return;

  try {
    const data = await getLatestRates(baseCurrency);
    container.innerHTML = '';

    MAJOR_CURRENCIES.forEach(code => {
      const meta = getCurrencyInfo(code);
      const rate = code === baseCurrency ? 1.0 : (data.rates[code] || 0);

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
          <button class="pop-trade-btn" title="Convert ${baseCurrency} to ${code}">
            Convert Pair ⇄
          </button>
        </div>
      `;

      card.querySelector('.pop-trade-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        setPair(baseCurrency, code);
        document.getElementById('converter')?.scrollIntoView({ behavior: 'smooth' });
      });

      card.addEventListener('click', () => {
        setPair(baseCurrency, code);
        document.getElementById('converter')?.scrollIntoView({ behavior: 'smooth' });
      });

      container.appendChild(card);
    });
  } catch (err) {
    console.error('Error loading popular currencies:', err);
  }
}

/**
 * Render Favorites Carousel / List
 */
export function renderFavoritesUI() {
  const container = document.getElementById('favorites-list-container');
  if (!container) return;

  const favorites = getFavorites();

  if (favorites.length === 0) {
    container.innerHTML = `
      <div class="empty-state-box">
        <span class="empty-icon">⭐</span>
        <p>No favorite pairs saved yet. Click the star icon on any conversion to save your frequent pairs!</p>
      </div>
    `;
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
      <button class="fav-remove-btn" title="Remove favorite" aria-label="Remove favorite">×</button>
    `;

    chip.querySelector('.fav-chip-content').addEventListener('click', () => {
      setPair(from, to);
      showToast(`Selected favorite pair ${from} → ${to}`, 'info', 2000);
      document.getElementById('converter')?.scrollIntoView({ behavior: 'smooth' });
    });

    chip.querySelector('.fav-remove-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      toggleFavorite(from, to);
      renderFavoritesUI();
      // Update star button in converter
      window.dispatchEvent(new CustomEvent('mfx-favorites-updated'));
      showToast(`Removed ${from}/${to} from favorites`, 'info', 1800);
    });

    container.appendChild(chip);
  });
}

/**
 * Render Recent Conversions History
 */
export function renderRecentConversionsUI() {
  const container = document.getElementById('recent-conversions-list');
  const clearBtn = document.getElementById('btn-clear-recents');
  if (!container) return;

  const recents = getRecentConversions();

  if (recents.length === 0) {
    container.innerHTML = `
      <div class="empty-state-box">
        <span class="empty-icon">🕒</span>
        <p>No conversion history yet. Use the converter above and your calculations will appear here!</p>
      </div>
    `;
    if (clearBtn) clearBtn.style.display = 'none';
    return;
  }

  if (clearBtn) clearBtn.style.display = 'inline-flex';
  container.innerHTML = '';

  recents.forEach(item => {
    const fromMeta = getCurrencyInfo(item.fromCode);
    const toMeta = getCurrencyInfo(item.toCode);
    const timeAgo = formatTimeAgo(item.timestamp);

    const row = document.createElement('div');
    row.className = 'recent-conversion-item glass-panel';
    row.innerHTML = `
      <div class="recent-left">
        <div class="recent-flags">${fromMeta.flag} ➜ ${toMeta.flag}</div>
        <div class="recent-details">
          <div class="recent-amount-line">
            <span class="from-val">${formatCurrencyValue(item.fromAmount, 2)} ${item.fromCode}</span>
            <span class="eq-sign">=</span>
            <span class="to-val">${formatCurrencyValue(item.toAmount, 2)} ${item.toCode}</span>
          </div>
          <div class="recent-rate-meta">
            Rate: 1 ${item.fromCode} = ${formatCurrencyValue(item.rate, 4)} ${item.toCode} • <span class="time-ago">${timeAgo}</span>
          </div>
        </div>
      </div>
      <div class="recent-actions">
        <button class="recent-reapply-btn" title="Re-calculate with this pair">↻ Reuse</button>
        <button class="recent-delete-btn" title="Remove entry" aria-label="Delete">×</button>
      </div>
    `;

    row.querySelector('.recent-reapply-btn').addEventListener('click', () => {
      const amountInput = document.getElementById('converter-amount-input');
      if (amountInput) amountInput.value = item.fromAmount;
      setPair(item.fromCode, item.toCode);
      document.getElementById('converter')?.scrollIntoView({ behavior: 'smooth' });
    });

    row.querySelector('.recent-delete-btn').addEventListener('click', () => {
      removeRecentConversion(item.id);
      renderRecentConversionsUI();
      showToast('Removed entry from history', 'info', 1500);
    });

    container.appendChild(row);
  });
}

function formatTimeAgo(timestamp) {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return 'Just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

/**
 * Initialize Navigation, Mobile Drawer & Smooth Scroll
 */
export function initNavigation() {
  const mobileToggle = document.getElementById('mobile-menu-toggle');
  const mobileMenu = document.getElementById('mobile-menu-drawer');
  const mobileOverlay = document.getElementById('mobile-menu-overlay');
  const mobileCloseBtn = document.getElementById('mobile-drawer-close');
  const navLinks = document.querySelectorAll('.nav-link, .mobile-nav-link');

  const toggleMobileMenu = (open) => {
    if (mobileMenu && mobileOverlay) {
      const isOpen = open !== undefined ? open : !mobileMenu.classList.contains('open');
      mobileMenu.classList.toggle('open', isOpen);
      mobileOverlay.classList.toggle('open', isOpen);
      document.body.style.overflow = isOpen ? 'hidden' : '';
    }
  };

  if (mobileToggle) {
    mobileToggle.addEventListener('click', () => toggleMobileMenu());
  }
  if (mobileCloseBtn) {
    mobileCloseBtn.addEventListener('click', () => toggleMobileMenu(false));
  }
  if (mobileOverlay) {
    mobileOverlay.addEventListener('click', () => toggleMobileMenu(false));
  }

  // Smooth scroll and active section spy
  navLinks.forEach(link => {
    link.addEventListener('click', (e) => {
      const targetId = link.getAttribute('href');
      if (targetId && targetId.startsWith('#')) {
        e.preventDefault();
        const targetEl = document.querySelector(targetId);
        if (targetEl) {
          toggleMobileMenu(false);
          const navHeight = 80;
          const targetPosition = targetEl.getBoundingClientRect().top + window.pageYOffset - navHeight;
          window.scrollTo({
            top: targetPosition,
            behavior: 'smooth'
          });
        }
      }
    });
  });

  // Chart Timeframe Tabs Listeners
  document.querySelectorAll('.timeframe-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.timeframe-tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const period = btn.getAttribute('data-period');
      setChartPeriod(period);
    });
  });

  // Clear all recents button
  const clearRecentsBtn = document.getElementById('btn-clear-recents');
  if (clearRecentsBtn) {
    clearRecentsBtn.addEventListener('click', () => {
      if (confirm('Are you sure you want to clear all recent conversions?')) {
        clearRecentConversions();
        renderRecentConversionsUI();
        showToast('Cleared all conversion history', 'info', 2000);
      }
    });
  }

  // Scroll to Top button
  const scrollToTopBtn = document.getElementById('scroll-to-top-btn');
  if (scrollToTopBtn) {
    window.addEventListener('scroll', () => {
      if (window.scrollY > 450) {
        scrollToTopBtn.classList.add('visible');
      } else {
        scrollToTopBtn.classList.remove('visible');
      }
    });

    scrollToTopBtn.addEventListener('click', () => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  // Live Market Sessions Clock Ticker
  startMarketClockTicker();
}

/**
 * Live Market Ticker & UTC Clock
 */
function startMarketClockTicker() {
  const clockEl = document.getElementById('live-utc-clock');
  const sessionEl = document.getElementById('market-active-session');

  function update() {
    const now = new Date();
    if (clockEl) {
      clockEl.textContent = now.toUTCString().slice(17, 25) + ' UTC';
    }

    if (sessionEl) {
      const utcHour = now.getUTCHours();
      // Market sessions approximate:
      // London: 08:00 - 16:30 UTC
      // New York: 13:00 - 21:00 UTC
      // Tokyo: 00:00 - 09:00 UTC
      // Sydney: 22:00 - 07:00 UTC
      let activeSessions = [];
      if (utcHour >= 8 && utcHour < 17) activeSessions.push('London');
      if (utcHour >= 13 && utcHour < 21) activeSessions.push('New York');
      if (utcHour >= 0 && utcHour < 9) activeSessions.push('Tokyo');
      if (utcHour >= 22 || utcHour < 7) activeSessions.push('Sydney');

      sessionEl.textContent = activeSessions.length > 0 ? activeSessions.join(' & ') + ' Open' : 'Markets Closed';
    }
  }

  update();
  setInterval(update, 1000);
}
