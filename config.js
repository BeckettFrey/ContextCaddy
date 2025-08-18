// Configuration constants and utilities for ContextCaddy Enhanced
const CONFIG = {
  // API Configuration
  API: {
    DEFAULT_BASE_URL: 'http://localhost:8000',
    ENDPOINTS: {
      HEALTH: '/health',
      CREATE_CABINET: '/create_cabinet',
      ADD_TO_CABINET: '/add_to_cabinet',
      QUERY_CABINET: '/query_cabinet',
      LIST_CABINETS: '/list_cabinets',
      DELETE_CABINET: '/delete_cabinet'
    },
    TIMEOUT: 10000
  },

  // Default Settings
  DEFAULTS: {
    MIN_SELECTION_LENGTH: 10,
    SEARCH_RESULTS: 10,
    SIMILARITY_THRESHOLD: 0.7,
    AUTO_OPEN: false,
    ANIMATIONS: true,
    COMPACT_MODE: false,
    TOOLTIPS: true,
    THEME: 'auto',
    CACHE_ENABLED: true,
    MAX_CACHE_SIZE: 100
  },

  // UI Constants
  UI: {
    DEBOUNCE_DELAY: 300,
    ANIMATION_DURATION: 200,
    TOAST_DURATION: 3000,
    MAX_PREVIEW_LENGTH: 200
  },

  // Storage Keys
  STORAGE_KEYS: {
    SETTINGS: 'contextcaddy_settings',
    CACHE: 'contextcaddy_cache',
    SELECTED_CABINET: 'selected_cabinet'
  },

  // Message Types
  MESSAGES: {
    ADD_TO_CABINET: 'ADD_TO_CABINET',
    OPEN_SIDEPANEL: 'OPEN_SIDEPANEL',
    TEXT_SELECTED: 'TEXT_SELECTED',
    REFRESH_CABINETS: 'REFRESH_CABINETS',
    SETTINGS_UPDATED: 'SETTINGS_UPDATED'
  }
};

// Utility functions
const Utils = {
  // Debounce function
  debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  },

  // Format timestamp
  formatTimestamp(timestamp) {
    return new Date(timestamp).toLocaleString();
  },

  // Truncate text
  truncateText(text, maxLength = CONFIG.UI.MAX_PREVIEW_LENGTH) {
    if (text.length <= maxLength) return text;
    return text.slice(0, maxLength) + '...';
  },

  // Validate URL
  isValidUrl(string) {
    try {
      new URL(string);
      return true;
    } catch (_) {
      return false;
    }
  },

  // Generate unique ID
  generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  },

  // Sanitize text
  sanitizeText(text) {
    return text.replace(/[<>&"']/g, function(match) {
      const escapeMap = {
        '<': '&lt;',
        '>': '&gt;',
        '&': '&amp;',
        '"': '&quot;',
        "'": '&#x27;'
      };
      return escapeMap[match];
    });
  },

  // Format file size
  formatBytes(bytes, decimals = 2) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  },

  // Get similarity score color
  getSimilarityColor(score) {
    if (score >= 0.9) return '#22c55e'; // green
    if (score >= 0.8) return '#84cc16'; // lime
    if (score >= 0.7) return '#eab308'; // yellow
    if (score >= 0.6) return '#f97316'; // orange
    return '#ef4444'; // red
  }
};

// Settings Manager
class SettingsManager {
  static async get(key = null) {
    try {
      const result = await chrome.storage.sync.get(CONFIG.STORAGE_KEYS.SETTINGS);
      const settings = result[CONFIG.STORAGE_KEYS.SETTINGS] || CONFIG.DEFAULTS;
      
      if (key) {
        return settings[key] !== undefined ? settings[key] : CONFIG.DEFAULTS[key];
      }
      
      return { ...CONFIG.DEFAULTS, ...settings };
    } catch (error) {
      console.error('Error getting settings:', error);
      return key ? CONFIG.DEFAULTS[key] : CONFIG.DEFAULTS;
    }
  }

  static async set(settings) {
    try {
      const current = await this.get();
      const updated = { ...current, ...settings };
      await chrome.storage.sync.set({ [CONFIG.STORAGE_KEYS.SETTINGS]: updated });
      
      // Notify other parts of the extension
      chrome.runtime.sendMessage({
        type: CONFIG.MESSAGES.SETTINGS_UPDATED,
        settings: updated
      }).catch(() => {}); // Ignore errors if no listeners
      
      return updated;
    } catch (error) {
      console.error('Error saving settings:', error);
      throw error;
    }
  }

  static async reset() {
    try {
      await chrome.storage.sync.remove(CONFIG.STORAGE_KEYS.SETTINGS);
      return CONFIG.DEFAULTS;
    } catch (error) {
      console.error('Error resetting settings:', error);
      throw error;
    }
  }

  static async export() {
    const settings = await this.get();
    return JSON.stringify(settings, null, 2);
  }

  static async import(settingsJson) {
    try {
      const settings = JSON.parse(settingsJson);
      // Validate settings against defaults
      const validSettings = {};
      Object.keys(CONFIG.DEFAULTS).forEach(key => {
        if (settings[key] !== undefined) {
          validSettings[key] = settings[key];
        }
      });
      return await this.set(validSettings);
    } catch (error) {
      console.error('Error importing settings:', error);
      throw new Error('Invalid settings format');
    }
  }
}

// Cache Manager
class CacheManager {
  static async get(key) {
    try {
      const result = await chrome.storage.local.get(CONFIG.STORAGE_KEYS.CACHE);
      const cache = result[CONFIG.STORAGE_KEYS.CACHE] || {};
      return cache[key];
    } catch (error) {
      console.error('Error getting cache:', error);
      return null;
    }
  }

  static async set(key, value, ttl = 300000) { // 5 minutes default TTL
    try {
      const result = await chrome.storage.local.get(CONFIG.STORAGE_KEYS.CACHE);
      const cache = result[CONFIG.STORAGE_KEYS.CACHE] || {};
      
      cache[key] = {
        value,
        expires: Date.now() + ttl
      };

      // Cleanup expired entries and enforce max size
      await this._cleanup(cache);
      
      await chrome.storage.local.set({ [CONFIG.STORAGE_KEYS.CACHE]: cache });
    } catch (error) {
      console.error('Error setting cache:', error);
    }
  }

  static async clear() {
    try {
      await chrome.storage.local.remove(CONFIG.STORAGE_KEYS.CACHE);
    } catch (error) {
      console.error('Error clearing cache:', error);
    }
  }

  static async _cleanup(cache) {
    const now = Date.now();
    const entries = Object.entries(cache);
    
    // Remove expired entries
    const validEntries = entries.filter(([_, item]) => item.expires > now);
    
    // Enforce max cache size
    const maxSize = await SettingsManager.get('MAX_CACHE_SIZE');
    if (validEntries.length > maxSize) {
      validEntries.sort((a, b) => b[1].expires - a[1].expires);
      validEntries.splice(maxSize);
    }
    
    // Rebuild cache object
    const cleanCache = {};
    validEntries.forEach(([key, value]) => {
      cleanCache[key] = value;
    });
    
    Object.keys(cache).forEach(key => delete cache[key]);
    Object.assign(cache, cleanCache);
  }
}

// API Client
class ApiClient {
  constructor() {
    this.baseUrl = CONFIG.API.DEFAULT_BASE_URL;
    this.timeout = CONFIG.API.TIMEOUT;
  }

  async updateSettings() {
    this.baseUrl = await SettingsManager.get('API_URL') || CONFIG.API.DEFAULT_BASE_URL;
    this.timeout = await SettingsManager.get('API_TIMEOUT') || CONFIG.API.TIMEOUT;
  }

  async request(endpoint, options = {}) {
    await this.updateSettings();
    
    const url = `${this.baseUrl}${endpoint}`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers
        }
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        throw new Error('Request timeout');
      }
      throw error;
    }
  }

  async get(endpoint, params = {}) {
    const searchParams = new URLSearchParams(params);
    const url = searchParams.toString() ? `${endpoint}?${searchParams}` : endpoint;
    return this.request(url, { method: 'GET' });
  }

  async post(endpoint, data = {}) {
    return this.request(endpoint, {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  async delete(endpoint) {
    return this.request(endpoint, { method: 'DELETE' });
  }
}

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { CONFIG, Utils, SettingsManager, CacheManager, ApiClient };
}