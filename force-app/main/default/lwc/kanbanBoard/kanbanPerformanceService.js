/**
 * Performance utility service for Kanban Board optimization
 * Addresses large dataset handling and reactive update issues
 */

export class KanbanPerformanceService {
	/**
	 * Debounce utility to prevent excessive function calls (LWC compatible)
	 * @param {Function} func - Function to debounce
	 * @param {number} wait - Wait time in milliseconds
	 * @returns {Function} Debounced function
	 */
	static debounce(func, wait) {
		let timeout;
		return function executedFunction(...args) {
			const later = () => {
				clearTimeout(timeout);
				func(...args);
			};
			clearTimeout(timeout);
			timeout = setTimeout(later, wait);
		};
	}

	/**
	 * Throttle utility to limit function execution frequency (LWC compatible)
	 * @param {Function} func - Function to throttle
	 * @param {number} limit - Time limit in milliseconds
	 * @returns {Function} Throttled function
	 */
	static throttle(func, limit) {
		let inThrottle;
		return function (...args) {
			if (!inThrottle) {
				func.apply(this, args);
				inThrottle = true;
				setTimeout(() => {
					inThrottle = false;
				}, limit);
			}
		};
	}

	/**
	 * Virtual scrolling implementation for large task lists
	 * @param {Array} items - All items to virtualize
	 * @param {number} containerHeight - Container height in pixels
	 * @param {number} itemHeight - Individual item height in pixels
	 * @param {number} scrollTop - Current scroll position
	 * @returns {Object} Virtualized data
	 */
	static getVirtualizedData(items, containerHeight, itemHeight, scrollTop) {
		if (!Array.isArray(items) || items.length === 0) {
			return {
				visibleItems: [],
				totalHeight: 0,
				startIndex: 0,
				endIndex: 0,
				offsetY: 0,
			};
		}

		const totalHeight = items.length * itemHeight;
		const visibleCount = Math.ceil(containerHeight / itemHeight);
		const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight));
		const endIndex = Math.min(items.length - 1, startIndex + visibleCount);

		const visibleItems = items.slice(startIndex, endIndex + 1);
		const offsetY = startIndex * itemHeight;

		return {
			visibleItems,
			totalHeight,
			startIndex,
			endIndex,
			offsetY,
		};
	}

	/**
	 * Efficient array update using shallow comparison
	 * @param {Array} oldArray - Previous array
	 * @param {Array} newArray - New array
	 * @returns {boolean} Whether arrays are different
	 */
	static hasArrayChanged(oldArray, newArray) {
		if (!oldArray || !newArray || oldArray.length !== newArray.length) {
			return true;
		}

		return oldArray.some((item, index) => {
			const newItem = newArray[index];
			return !this.shallowEqual(item, newItem);
		});
	}

	/**
	 * Shallow equality check for objects
	 * @param {Object} obj1 - First object
	 * @param {Object} obj2 - Second object
	 * @returns {boolean} Whether objects are shallowly equal
	 */
	static shallowEqual(obj1, obj2) {
		if (obj1 === obj2) return true;
		if (!obj1 || !obj2) return false;

		const keys1 = Object.keys(obj1);
		const keys2 = Object.keys(obj2);

		if (keys1.length !== keys2.length) return false;

		return keys1.every((key) => obj1[key] === obj2[key]);
	}

	/**
	 * Memory-efficient DOM query caching
	 */
	static createDOMCache() {
		const cache = new Map();

		return {
			get: (selector, templateRef) => {
				if (!cache.has(selector)) {
					if (templateRef && templateRef.querySelector) {
						const element = templateRef.querySelector(selector);
						if (element) {
							cache.set(selector, element);
						}
					}
				}
				return cache.get(selector);
			},
			set: (selector, element) => {
				cache.set(selector, element);
			},
			clear: () => {
				cache.clear();
			},
			size: () => cache.size,
		};
	}

	/**
	 * Performance monitoring utility
	 */
	static createPerformanceMonitor() {
		const metrics = new Map();

		return {
			start(name) {
				metrics.set(name, performance.now());
			},

			end(name) {
				const startTime = metrics.get(name);
				if (startTime) {
					const duration = performance.now() - startTime;
					// Performance metric recorded: ${name}
					metrics.delete(name);
					return duration;
				}
				return null;
			},

			measure(name, fn) {
				this.start(name);
				const result = fn();
				this.end(name);
				return result;
			},
		};
	}

	/**
	 * Batch DOM updates to prevent layout thrashing (LWC compatible)
	 * @param {Function[]} updates - Array of update functions
	 */
	static batchDOMUpdates(updates) {
		return new Promise((resolve) => {
			// Use Promise.resolve().then() for next tick execution
			Promise.resolve().then(() => {
				updates.forEach((update) => update());
				resolve();
			});
		});
	}

	/**
	 * Memory usage monitoring
	 */
	static getMemoryUsage() {
		if (performance.memory) {
			return {
				used: Math.round(performance.memory.usedJSHeapSize / 1024 / 1024),
				total: Math.round(performance.memory.totalJSHeapSize / 1024 / 1024),
				limit: Math.round(performance.memory.jsHeapSizeLimit / 1024 / 1024),
			};
		}
		return null;
	}

	/**
	 * Cleanup utility for memory leaks prevention
	 */
	static createCleanupManager() {
		const cleanupTasks = [];

		return {
			add(cleanupFn) {
				cleanupTasks.push(cleanupFn);
			},

			cleanup() {
				cleanupTasks.forEach((task) => {
					try {
						task();
					} catch (error) {
						console.error("Cleanup error:", error);
					}
				});
				cleanupTasks.length = 0;
			},
		};
	}

	/**
	 * Start performance monitor for a specific operation
	 * @param {string} operationName - Name of the operation to monitor
	 * @returns {Object} Performance monitor
	 */
	static startPerformanceMonitor(operationName) {
		return this.createPerformanceMonitor(operationName);
	}

	/**
	 * BatchRequestManager for optimizing API calls
	 * Allows batching and deduplication of server requests
	 */
	static createBatchRequestManager(batchWindow = 50) {
		return new BatchRequestManager(batchWindow);
	}
}

/**
 * BatchRequestManager Class
 * Handles batching of API requests to reduce server calls
 */
class BatchRequestManager {
	constructor(batchWindow = 50) {
		this.batchWindow = batchWindow;
		this.queue = [];
		this.timeoutId = null;
		this.pendingRequests = new Map();
		this.requestCache = new Map();
		this.cacheLifetimeMs = 5000; // 5 second cache lifetime
	}

	/**
	 * Add a request to the batch queue
	 * @param {Object} requestInfo - Information about the request
	 * @param {Function} apiMethod - The API method to call
	 * @returns {Promise} Promise that resolves with the request result
	 */
	addRequest(requestInfo, apiMethod) {
		// Generate a cache key from the request info
		const cacheKey = this._generateCacheKey(requestInfo);

		// Check if we have a cached response
		const cachedResponse = this._getFromCache(cacheKey);
		if (cachedResponse) {
			return Promise.resolve(cachedResponse);
		}

		// Check if we already have a pending request for this
		if (this.pendingRequests.has(cacheKey)) {
			return this.pendingRequests.get(cacheKey);
		}

		// Create a new promise for this request
		const requestPromise = new Promise((resolve, reject) => {
			this.queue.push({
				requestInfo,
				apiMethod,
				resolve,
				reject,
				cacheKey,
			});

			// Schedule processing if not already scheduled
			this._scheduleProcessing();
		});

		// Store in pending requests
		this.pendingRequests.set(cacheKey, requestPromise);

		return requestPromise;
	}

	/**
	 * Schedule batch processing
	 */
	_scheduleProcessing() {
		if (this.timeoutId) {
			return; // Already scheduled
		}

		this.timeoutId = setTimeout(() => {
			this._processBatch();
		}, this.batchWindow);
	}

	/**
	 * Process the current batch of requests
	 */
	_processBatch() {
		if (this.queue.length === 0) {
			this.timeoutId = null;
			return;
		}

		const batch = [...this.queue];
		this.queue = [];
		this.timeoutId = null;

		// Process batch requests in parallel
		batch.forEach(async (item) => {
			try {
				const result = await item.apiMethod(item.requestInfo);

				// Cache the result
				this._addToCache(item.cacheKey, result);

				// Resolve the promise
				item.resolve(result);

				// Remove from pending requests
				this.pendingRequests.delete(item.cacheKey);
			} catch (error) {
				item.reject(error);
				this.pendingRequests.delete(item.cacheKey);
			}
		});
	}

	/**
	 * Generate a cache key from request info
	 */
	_generateCacheKey(requestInfo) {
		return JSON.stringify(requestInfo);
	}

	/**
	 * Add a response to the cache
	 */
	_addToCache(cacheKey, response) {
		this.requestCache.set(cacheKey, {
			response,
			timestamp: Date.now(),
		});
	}

	/**
	 * Get a response from cache if valid
	 */
	_getFromCache(cacheKey) {
		const cacheEntry = this.requestCache.get(cacheKey);

		if (!cacheEntry) {
			return null;
		}

		// Check if cache entry is still valid
		if (Date.now() - cacheEntry.timestamp > this.cacheLifetimeMs) {
			this.requestCache.delete(cacheKey);
			return null;
		}

		return cacheEntry.response;
	}

	/**
	 * Clear the cache
	 */
	clearCache() {
		this.requestCache.clear();
	}
}
