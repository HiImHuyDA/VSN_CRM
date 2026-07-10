import viTranslations from '../locales/vi.json';

/**
 * Clean helper function to fetch nested values from JSON by dot notation
 * @param {string} key e.g. 'app.title'
 * @param {string} defaultValue Optional default fallback
 * @returns {string} The localized string or fallback key
 */
export function t(key, defaultValue = '') {
  const keys = key.split('.');
  let value = viTranslations;
  
  for (const k of keys) {
    if (value && typeof value === 'object' && k in value) {
      value = value[k];
    } else {
      return defaultValue || key;
    }
  }
  
  return value;
}

export default t;
