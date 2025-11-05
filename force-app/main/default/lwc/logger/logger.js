/**
 * Logger utility for Kanban Board LWC component
 * Provides centralized logging with debug mode control
 * Addresses Issue #005: Excessive console.error statements
 */

// Debug mode flag - can be controlled via component property or custom setting
let debugMode = false;

/**
 * Set debug mode
 * @param {boolean} enabled - Whether debug logging is enabled
 */
export function setDebugMode(enabled) {
	debugMode = enabled;
}

/**
 * Check if debug mode is enabled
 * @returns {boolean}
 */
export function isDebugMode() {
	return debugMode;
}

/**
 * Log debug message (only in debug mode)
 * @param {string} message - Message to log
 * @param {*} data - Optional data to log
 */
export function debug(message, data) {
	if (debugMode) {
		if (data !== undefined) {
			console.log("[KANBAN DEBUG]", message, data);
		} else {
			console.log("[KANBAN DEBUG]", message);
		}
	}
}

/**
 * Log info message (only in debug mode)
 * @param {string} message - Message to log
 * @param {*} data - Optional data to log
 */
export function info(message, data) {
	if (debugMode) {
		if (data !== undefined) {
			console.info("[KANBAN INFO]", message, data);
		} else {
			console.info("[KANBAN INFO]", message);
		}
	}
}

/**
 * Log warning message (only in debug mode)
 * @param {string} message - Message to log
 * @param {*} data - Optional data to log
 */
export function warn(message, data) {
	if (debugMode) {
		if (data !== undefined) {
			console.warn("[KANBAN WARN]", message, data);
		} else {
			console.warn("[KANBAN WARN]", message);
		}
	}
}

/**
 * Log error message (always logged, even in production)
 * Errors are critical and should always be visible
 * @param {string} message - Message to log
 * @param {*} error - Optional error object
 */
export function error(message, error) {
	if (error !== undefined) {
		console.error("[KANBAN ERROR]", message, error);

		// Log additional error details in debug mode
		if (debugMode && error) {
			if (error.body) {
				console.error("[KANBAN ERROR] Error body:", error.body);
			}
			if (error.stack) {
				console.error("[KANBAN ERROR] Stack trace:", error.stack);
			}
		}
	} else {
		console.error("[KANBAN ERROR]", message);
	}
}

/**
 * Log performance metric (only in debug mode)
 * @param {string} operation - Operation name
 * @param {number} duration - Duration in milliseconds
 */
export function performance(operation, duration) {
	if (debugMode) {
		console.log(`[KANBAN PERF] ${operation}: ${duration}ms`);
	}
}

/**
 * Log user action (only in debug mode)
 * Useful for debugging user interactions
 * @param {string} action - Action name
 * @param {*} details - Action details
 */
export function logAction(action, details) {
	if (debugMode) {
		console.log("[KANBAN ACTION]", action, details);
	}
}
