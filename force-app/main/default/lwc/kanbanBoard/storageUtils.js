/**
 * Storage Utility Service for Kanban Board
 * Provides safe localStorage access with error handling and fallback mechanisms
 * Addresses Issue #007: localStorage usage without error handling
 */

/**
 * Check if localStorage is available
 * @returns {boolean} True if localStorage is accessible
 */
export function isStorageAvailable() {
    try {
        const testKey = '__storage_test__';
        window.localStorage.setItem(testKey, 'test');
        window.localStorage.removeItem(testKey);
        return true;
    } catch (e) {
        // localStorage is not available (private browsing, quota exceeded, etc.)
        return false;
    }
}

/**
 * Safely get item from localStorage
 * @param {string} key - Storage key
 * @param {*} defaultValue - Default value if key doesn't exist or storage unavailable
 * @returns {*} Stored value or default value
 */
export function getStorageItem(key, defaultValue = null) {
    if (!isStorageAvailable()) {
        console.warn(`Storage unavailable, using default for key: ${key}`);
        return defaultValue;
    }

    try {
        const item = window.localStorage.getItem(key);
        return item !== null ? item : defaultValue;
    } catch (e) {
        console.error(`Error reading from storage (key: ${key}):`, e);
        return defaultValue;
    }
}

/**
 * Safely set item in localStorage
 * @param {string} key - Storage key
 * @param {*} value - Value to store
 * @returns {boolean} True if successful, false otherwise
 */
export function setStorageItem(key, value) {
    if (!isStorageAvailable()) {
        console.warn(`Storage unavailable, cannot save key: ${key}`);
        return false;
    }

    try {
        window.localStorage.setItem(key, value);
        return true;
    } catch (e) {
        console.error(`Error writing to storage (key: ${key}):`, e);
        return false;
    }
}

/**
 * Safely remove item from localStorage
 * @param {string} key - Storage key
 * @returns {boolean} True if successful, false otherwise
 */
export function removeStorageItem(key) {
    if (!isStorageAvailable()) {
        console.warn(`Storage unavailable, cannot remove key: ${key}`);
        return false;
    }

    try {
        window.localStorage.removeItem(key);
        return true;
    } catch (e) {
        console.error(`Error removing from storage (key: ${key}):`, e);
        return false;
    }
}

/**
 * Safely get JSON item from localStorage
 * @param {string} key - Storage key
 * @param {*} defaultValue - Default value if key doesn't exist or parsing fails
 * @returns {*} Parsed JSON value or default value
 */
export function getStorageJSON(key, defaultValue = null) {
    const item = getStorageItem(key, null);
    
    if (item === null) {
        return defaultValue;
    }

    try {
        return JSON.parse(item);
    } catch (e) {
        console.error(`Error parsing JSON from storage (key: ${key}):`, e);
        return defaultValue;
    }
}

/**
 * Safely set JSON item in localStorage
 * @param {string} key - Storage key
 * @param {*} value - Value to store as JSON
 * @returns {boolean} True if successful, false otherwise
 */
export function setStorageJSON(key, value) {
    try {
        const jsonString = JSON.stringify(value);
        return setStorageItem(key, jsonString);
    } catch (e) {
        console.error(`Error stringifying JSON for storage (key: ${key}):`, e);
        return false;
    }
}

/**
 * Safely clear all items from localStorage
 * @returns {boolean} True if successful, false otherwise
 */
export function clearStorage() {
    if (!isStorageAvailable()) {
        console.warn('Storage unavailable, cannot clear');
        return false;
    }

    try {
        window.localStorage.clear();
        return true;
    } catch (e) {
        console.error('Error clearing storage:', e);
        return false;
    }
}

/**
 * Get storage keys matching a pattern
 * @param {string} pattern - Pattern to match (substring)
 * @returns {string[]} Array of matching keys
 */
export function getStorageKeys(pattern = '') {
    if (!isStorageAvailable()) {
        return [];
    }

    try {
        const keys = [];
        for (let i = 0; i < window.localStorage.length; i++) {
            const key = window.localStorage.key(i);
            if (!pattern || key.includes(pattern)) {
                keys.push(key);
            }
        }
        return keys;
    } catch (e) {
        console.error('Error getting storage keys:', e);
        return [];
    }
}
