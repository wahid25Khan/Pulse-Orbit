/**
 * @description Debouncing utility for search and input handlers
 * Reduces excessive function calls and API requests
 */

/**
 * Create a debounced version of a function
 * @param {Function} func - Function to debounce
 * @param {number} wait - Wait time in milliseconds
 * @returns {Function} Debounced function with cancel method
 */
export function debounce(func, wait) {
	let timeout;

	const debouncedFunction = function executedFunction(...args) {
		const later = () => {
			clearTimeout(timeout);
			timeout = null;
			func(...args);
		};

		clearTimeout(timeout);
		timeout = setTimeout(later, wait);
	};

	// Add cancel method to clear pending timeout
	debouncedFunction.cancel = function () {
		if (timeout) {
			clearTimeout(timeout);
			timeout = null;
		}
	};

	return debouncedFunction;
}

/**
 * Create a throttled version of a function
 * @param {Function} func - Function to throttle
 * @param {number} limit - Time limit in milliseconds
 * @returns {Function} Throttled function
 */
export function throttle(func, limit) {
	let inThrottle;

	return function executedFunction(...args) {
		if (!inThrottle) {
			func(...args);
			inThrottle = true;
			setTimeout(() => (inThrottle = false), limit);
		}
	};
}

/**
 * Debounce with immediate execution option
 * @param {Function} func - Function to debounce
 * @param {number} wait - Wait time in milliseconds
 * @param {boolean} immediate - Execute immediately on first call
 * @returns {Function} Debounced function
 */
export function debounceImmediate(func, wait, immediate = false) {
	let timeout;

	return function executedFunction(...args) {
		const callNow = immediate && !timeout;

		const later = () => {
			timeout = null;
			if (!immediate) func(...args);
		};

		clearTimeout(timeout);
		timeout = setTimeout(later, wait);

		if (callNow) func(...args);
	};
}
