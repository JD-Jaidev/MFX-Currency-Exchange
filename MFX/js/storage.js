/**
 * MFX - LocalStorage & State Persistence Module
 * Manages favorites, recent conversion history, and theme settings.
 */

const STORAGE_KEYS = {
  THEME: 'mfx_theme_preference',
  FAVORITES: 'mfx_favorite_pairs',
  RECENTS: 'mfx_recent_conversions'
};

const DEFAULT_FAVORITES = [
  { from: 'USD', to: 'INR' },
  { from: 'EUR', to: 'USD' },
  { from: 'GBP', to: 'INR' },
  { from: 'USD', to: 'JPY' },
  { from: 'AUD', to: 'USD' },
  { from: 'EUR', to: 'GBP' }
];

/**
 * Get saved theme preference ('dark' | 'light'). Defaults to 'dark'.
 * @returns {string}
 */
export function getThemePreference() {
  try {
    const saved = localStorage.getItem(STORAGE_KEYS.THEME);
    if (saved) return saved;
    // Check system preference
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) {
      return 'light';
    }
    return 'dark';
  } catch (e) {
    console.warn('LocalStorage error reading theme:', e);
    return 'dark';
  }
}

/**
 * Save theme preference.
 * @param {string} theme - 'dark' | 'light'
 */
export function saveThemePreference(theme) {
  try {
    localStorage.setItem(STORAGE_KEYS.THEME, theme);
  } catch (e) {
    console.warn('LocalStorage error saving theme:', e);
  }
}

/**
 * Get list of favorite pairs.
 * @returns {Array<{ from: string, to: string }>}
 */
export function getFavorites() {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.FAVORITES);
    if (!data) {
      saveFavorites(DEFAULT_FAVORITES);
      return DEFAULT_FAVORITES;
    }
    return JSON.parse(data);
  } catch (e) {
    console.warn('LocalStorage error reading favorites:', e);
    return DEFAULT_FAVORITES;
  }
}

/**
 * Save favorites array.
 * @param {Array<{ from: string, to: string }>} favorites
 */
export function saveFavorites(favorites) {
  try {
    localStorage.setItem(STORAGE_KEYS.FAVORITES, JSON.stringify(favorites));
  } catch (e) {
    console.warn('LocalStorage error saving favorites:', e);
  }
}

/**
 * Check if a pair is currently favorited.
 * @param {string} from
 * @param {string} to
 * @returns {boolean}
 */
export function isFavorite(from, to) {
  const favorites = getFavorites();
  return favorites.some(fav => fav.from === from && fav.to === to);
}

/**
 * Toggle a pair in favorites.
 * @param {string} from
 * @param {string} to
 * @returns {boolean} New favorite state (true if added, false if removed)
 */
export function toggleFavorite(from, to) {
  const favorites = getFavorites();
  const index = favorites.findIndex(fav => fav.from === from && fav.to === to);
  
  if (index >= 0) {
    favorites.splice(index, 1);
    saveFavorites(favorites);
    return false;
  } else {
    favorites.unshift({ from, to });
    saveFavorites(favorites);
    return true;
  }
}

/**
 * Get recent conversions list.
 * @returns {Array<{ id: string, timestamp: number, fromAmount: number, fromCode: string, toAmount: number, toCode: string, rate: number }>}
 */
export function getRecentConversions() {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.RECENTS);
    return data ? JSON.parse(data) : [];
  } catch (e) {
    console.warn('LocalStorage error reading recents:', e);
    return [];
  }
}

/**
 * Add a conversion item to recent history.
 * @param {Object} item
 */
export function addRecentConversion({ fromAmount, fromCode, toAmount, toCode, rate }) {
  try {
    let recents = getRecentConversions();
    
    // Avoid exact duplicate right at top
    if (recents.length > 0) {
      const top = recents[0];
      if (
        top.fromCode === fromCode &&
        top.toCode === toCode &&
        Math.abs(top.fromAmount - fromAmount) < 0.0001
      ) {
        return recents;
      }
    }

    const newItem = {
      id: `${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      timestamp: Date.now(),
      fromAmount: Number(fromAmount),
      fromCode,
      toAmount: Number(toAmount),
      toCode,
      rate: Number(rate)
    };

    // Keep top 12 items
    recents = [newItem, ...recents.filter(r => r.id !== newItem.id)].slice(0, 12);
    localStorage.setItem(STORAGE_KEYS.RECENTS, JSON.stringify(recents));
    return recents;
  } catch (e) {
    console.warn('LocalStorage error adding recent conversion:', e);
    return [];
  }
}

/**
 * Remove a specific recent conversion by ID.
 * @param {string} id
 * @returns {Array}
 */
export function removeRecentConversion(id) {
  try {
    const recents = getRecentConversions().filter(r => r.id !== id);
    localStorage.setItem(STORAGE_KEYS.RECENTS, JSON.stringify(recents));
    return recents;
  } catch (e) {
    console.warn('LocalStorage error removing recent:', e);
    return [];
  }
}

/**
 * Clear all recent conversions.
 */
export function clearRecentConversions() {
  try {
    localStorage.removeItem(STORAGE_KEYS.RECENTS);
  } catch (e) {
    console.warn('LocalStorage error clearing recents:', e);
  }
}
