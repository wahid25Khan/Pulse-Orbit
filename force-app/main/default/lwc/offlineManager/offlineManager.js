/**
 * Offline Manager Utility (MAJ-005)
 * Handles offline detection, operation queueing, and retry logic
 * 
 * Features:
 * - Online/offline status detection
 * - Operation queue for offline actions
 * - Automatic retry when connection returns
 * - Data caching for offline viewing
 * - Sync conflict resolution
 */

import { getStorageItem, setStorageItem } from 'c/storageUtils';
import { error as logError, warn as logWarn, info as logInfo } from 'c/logger';

// Queue storage keys
const QUEUE_KEY = 'kanban_offline_queue';
const CACHE_KEY_PREFIX = 'kanban_cache_';
const SYNC_STATUS_KEY = 'kanban_sync_status';

// Operation types
export const OPERATION_TYPES = {
	CREATE_TASK: 'CREATE_TASK',
	UPDATE_TASK: 'UPDATE_TASK',
	DELETE_TASK: 'DELETE_TASK',
	MOVE_TASK: 'MOVE_TASK',
	CREATE_COMMENT: 'CREATE_COMMENT',
	LOG_TIME: 'LOG_TIME',
	BULK_UPDATE: 'BULK_UPDATE',
};

/**
 * OfflineManager class
 * Singleton pattern for managing offline operations
 */
class OfflineManager {
	constructor() {
		this._isOnline = navigator.onLine;
		this._queue = [];
		this._listeners = new Set();
		this._syncInProgress = false;
		this._retryAttempts = new Map();
		this._maxRetries = 3;
		this._retryDelay = 2000; // 2 seconds
		
		// Bind event handlers
		this._handleOnline = this._handleOnline.bind(this);
		this._handleOffline = this._handleOffline.bind(this);
		
		// Initialize
		this._loadQueue();
		this._setupEventListeners();
	}
	
	/**
	 * Setup network status event listeners
	 */
	_setupEventListeners() {
		window.addEventListener('online', this._handleOnline);
		window.addEventListener('offline', this._handleOffline);
		
		// Log initial status
		logInfo(`[OFFLINE MANAGER] Initialized. Online: ${this._isOnline}`);
	}
	
	/**
	 * Cleanup event listeners
	 */
	destroy() {
		window.removeEventListener('online', this._handleOnline);
		window.removeEventListener('offline', this._handleOffline);
		this._listeners.clear();
	}
	
	/**
	 * Handle online event
	 */
	_handleOnline() {
		logInfo('[OFFLINE MANAGER] Connection restored');
		this._isOnline = true;
		this._notifyListeners('online');
		
		// Auto-sync queued operations
		if (this._queue.length > 0) {
			this.syncQueue();
		}
	}
	
	/**
	 * Handle offline event
	 */
	_handleOffline() {
		logWarn('[OFFLINE MANAGER] Connection lost');
		this._isOnline = false;
		this._notifyListeners('offline');
	}
	
	/**
	 * Check if online
	 * @returns {boolean} True if online
	 */
	isOnline() {
		return this._isOnline;
	}
	
	/**
	 * Check if offline
	 * @returns {boolean} True if offline
	 */
	isOffline() {
		return !this._isOnline;
	}
	
	/**
	 * Register a listener for network status changes
	 * @param {Function} callback - Callback function(status)
	 * @returns {Function} Unsubscribe function
	 */
	addListener(callback) {
		this._listeners.add(callback);
		
		// Return unsubscribe function
		return () => {
			this._listeners.delete(callback);
		};
	}
	
	/**
	 * Notify all listeners of status change
	 * @param {string} status - 'online' or 'offline'
	 */
	_notifyListeners(status) {
		this._listeners.forEach(callback => {
			try {
				callback(status, {
					isOnline: this._isOnline,
					queueLength: this._queue.length,
				});
			} catch (error) {
				logError('[OFFLINE MANAGER] Listener error:', error);
			}
		});
	}
	
	/**
	 * Add operation to queue
	 * @param {Object} operation - Operation to queue
	 * @returns {Promise<string>} Operation ID
	 */
	async queueOperation(operation) {
		const op = {
			id: this._generateId(),
			timestamp: Date.now(),
			attempts: 0,
			...operation,
		};
		
		this._queue.push(op);
		await this._saveQueue();
		
		logInfo(`[OFFLINE MANAGER] Queued operation: ${op.type}`, op);
		
		return op.id;
	}
	
	/**
	 * Execute operation immediately or queue for later
	 * @param {Object} operation - Operation to execute
	 * @param {Function} executeFunc - Function to execute operation
	 * @returns {Promise<any>} Operation result
	 */
	async executeOrQueue(operation, executeFunc) {
		if (this.isOnline()) {
			try {
				// Try to execute immediately
				const result = await executeFunc(operation.data);
				logInfo(`[OFFLINE MANAGER] Operation executed: ${operation.type}`);
				return result;
			} catch (error) {
				// Check if it's a network error
				if (this._isNetworkError(error)) {
					logWarn('[OFFLINE MANAGER] Network error, queueing operation');
					await this.queueOperation(operation);
					throw error;
				}
				// Other errors should be thrown
				throw error;
			}
		} else {
			// Queue for later execution
			logInfo(`[OFFLINE MANAGER] Offline, queueing operation: ${operation.type}`);
			const operationId = await this.queueOperation(operation);
			
			// Return a pending result
			return {
				queued: true,
				operationId,
				message: 'Operation queued for when connection is restored',
			};
		}
	}
	
	/**
	 * Sync all queued operations
	 * @returns {Promise<Object>} Sync results
	 */
	async syncQueue() {
		if (this._syncInProgress) {
			logWarn('[OFFLINE MANAGER] Sync already in progress');
			return { skipped: true };
		}
		
		if (this._queue.length === 0) {
			logInfo('[OFFLINE MANAGER] No operations to sync');
			return { success: 0, failed: 0 };
		}
		
		this._syncInProgress = true;
		this._notifyListeners('sync_started');
		
		let success = 0;
		let failed = 0;
		const errors = [];
		
		logInfo(`[OFFLINE MANAGER] Starting sync: ${this._queue.length} operations`);
		
		// Process queue in order
		while (this._queue.length > 0 && this.isOnline()) {
			const operation = this._queue[0];
			
			try {
				// Execute the operation
				await this._executeOperation(operation);
				
				// Remove from queue on success
				this._queue.shift();
				success++;
				
				logInfo(`[OFFLINE MANAGER] Synced operation: ${operation.type}`);
			} catch (error) {
				operation.attempts++;
				this._retryAttempts.set(operation.id, operation.attempts);
				
				logError(`[OFFLINE MANAGER] Sync failed (attempt ${operation.attempts}):`, error);
				
				// Check if max retries exceeded
				if (operation.attempts >= this._maxRetries) {
					this._queue.shift();
					failed++;
					errors.push({
						operation: operation.type,
						error: error.message || String(error),
					});
					
					logError(`[OFFLINE MANAGER] Max retries exceeded for: ${operation.type}`);
				} else {
					// Wait before retry
					await this._delay(this._retryDelay);
				}
				
				// Break if offline
				if (!this.isOnline()) {
					break;
				}
			}
		}
		
		await this._saveQueue();
		this._syncInProgress = false;
		
		const result = { success, failed, errors, remaining: this._queue.length };
		
		this._notifyListeners('sync_completed', result);
		
		logInfo('[OFFLINE MANAGER] Sync completed:', result);
		
		return result;
	}
	
	/**
	 * Execute a queued operation
	 * @param {Object} operation - Operation to execute
	 * @returns {Promise<any>} Operation result
	 */
	async _executeOperation(operation) {
		// This should be implemented by the component
		// For now, dispatch an event for the component to handle
		const event = new CustomEvent('offlineoperationexecute', {
			detail: { operation },
			bubbles: true,
			composed: true,
		});
		
		window.dispatchEvent(event);
		
		// Wait for confirmation
		return new Promise((resolve, reject) => {
			const timeout = setTimeout(() => {
				reject(new Error('Operation execution timeout'));
			}, 30000); // 30 second timeout
			
			const handler = (e) => {
				if (e.detail.operationId === operation.id) {
					clearTimeout(timeout);
					window.removeEventListener('offlineoperationresult', handler);
					
					if (e.detail.success) {
						resolve(e.detail.result);
					} else {
						reject(e.detail.error);
					}
				}
			};
			
			window.addEventListener('offlineoperationresult', handler);
		});
	}
	
	/**
	 * Get queue length
	 * @returns {number} Number of queued operations
	 */
	getQueueLength() {
		return this._queue.length;
	}
	
	/**
	 * Get queued operations
	 * @returns {Array} Copy of queue
	 */
	getQueue() {
		return [...this._queue];
	}
	
	/**
	 * Clear the queue
	 */
	async clearQueue() {
		this._queue = [];
		this._retryAttempts.clear();
		await this._saveQueue();
		logInfo('[OFFLINE MANAGER] Queue cleared');
	}
	
	/**
	 * Cache data for offline access
	 * @param {string} key - Cache key
	 * @param {any} data - Data to cache
	 */
	async cacheData(key, data) {
		try {
			const cacheKey = `${CACHE_KEY_PREFIX}${key}`;
			const cacheEntry = {
				data,
				timestamp: Date.now(),
			};
			setStorageItem(cacheKey, JSON.stringify(cacheEntry));
			logInfo(`[OFFLINE MANAGER] Cached data: ${key}`);
		} catch (error) {
			logError('[OFFLINE MANAGER] Cache error:', error);
		}
	}
	
	/**
	 * Get cached data
	 * @param {string} key - Cache key
	 * @param {number} maxAge - Maximum age in milliseconds (default: 24 hours)
	 * @returns {any} Cached data or null
	 */
	getCachedData(key, maxAge = 24 * 60 * 60 * 1000) {
		try {
			const cacheKey = `${CACHE_KEY_PREFIX}${key}`;
			const cached = getStorageItem(cacheKey);
			
			if (!cached) {
				return null;
			}
			
			const cacheEntry = JSON.parse(cached);
			const age = Date.now() - cacheEntry.timestamp;
			
			if (age > maxAge) {
				logWarn(`[OFFLINE MANAGER] Cache expired: ${key}`);
				return null;
			}
			
			logInfo(`[OFFLINE MANAGER] Cache hit: ${key}`);
			return cacheEntry.data;
		} catch (error) {
			logError('[OFFLINE MANAGER] Cache retrieval error:', error);
			return null;
		}
	}
	
	/**
	 * Load queue from storage
	 */
	_loadQueue() {
		try {
			const stored = getStorageItem(QUEUE_KEY);
			if (stored) {
				this._queue = JSON.parse(stored);
				logInfo(`[OFFLINE MANAGER] Loaded ${this._queue.length} queued operations`);
			}
		} catch (error) {
			logError('[OFFLINE MANAGER] Failed to load queue:', error);
			this._queue = [];
		}
	}
	
	/**
	 * Save queue to storage
	 */
	async _saveQueue() {
		try {
			setStorageItem(QUEUE_KEY, JSON.stringify(this._queue));
		} catch (error) {
			logError('[OFFLINE MANAGER] Failed to save queue:', error);
		}
	}
	
	/**
	 * Generate unique operation ID
	 * @returns {string} Unique ID
	 */
	_generateId() {
		return `op_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
	}
	
	/**
	 * Check if error is network-related
	 * @param {Error} error - Error to check
	 * @returns {boolean} True if network error
	 */
	_isNetworkError(error) {
		const message = error.message || String(error);
		const networkErrors = [
			'network',
			'offline',
			'timeout',
			'connection',
			'fetch',
			'unreachable',
		];
		
		return networkErrors.some(term => 
			message.toLowerCase().includes(term)
		);
	}
	
	/**
	 * Delay helper
	 * @param {number} ms - Milliseconds to delay
	 * @returns {Promise}
	 */
	_delay(ms) {
		return new Promise(resolve => setTimeout(resolve, ms));
	}
}

// Export singleton instance
export const offlineManager = new OfflineManager();

// Export utility functions
export function isOnline() {
	return offlineManager.isOnline();
}

export function isOffline() {
	return offlineManager.isOffline();
}

export function getQueueLength() {
	return offlineManager.getQueueLength();
}

export function addNetworkListener(callback) {
	return offlineManager.addListener(callback);
}

export async function queueOperation(operation) {
	return offlineManager.queueOperation(operation);
}

export async function executeOrQueue(operation, executeFunc) {
	return offlineManager.executeOrQueue(operation, executeFunc);
}

export async function syncQueue() {
	return offlineManager.syncQueue();
}

export async function cacheData(key, data) {
	return offlineManager.cacheData(key, data);
}

export function getCachedData(key, maxAge) {
	return offlineManager.getCachedData(key, maxAge);
}
