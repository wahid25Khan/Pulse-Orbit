/**
 * @description Utility functions for date formatting and manipulation
 * Provides consistent date handling across all Kanban components
 */

/**
 * Format date in ISO format (YYYY-MM-DD)
 * @param {Date|string} date - Date to format
 * @returns {string} Formatted date string or empty string if invalid
 */
export function formatDateISO(date) {
	if (!date) return "";

	try {
		const d = date instanceof Date ? date : new Date(date);
		if (isNaN(d.getTime())) return "";

		const year = d.getFullYear();
		const month = String(d.getMonth() + 1).padStart(2, "0");
		const day = String(d.getDate()).padStart(2, "0");

		return `${year}-${month}-${day}`;
	} catch (e) {
		console.error("Error formatting date:", e);
		return "";
	}
}

/**
 * Format date for display with localization
 * @param {Date|string} date - Date to format
 * @param {string} locale - Locale string (default: user's locale)
 * @returns {string} Formatted date string
 */
export function formatDateDisplay(date, locale = undefined) {
	if (!date) return "";

	try {
		const d = date instanceof Date ? date : new Date(date);
		if (isNaN(d.getTime())) return "";

		return d.toLocaleDateString(locale, {
			year: "numeric",
			month: "short",
			day: "numeric",
		});
	} catch (e) {
		console.error("Error formatting date for display:", e);
		return "";
	}
}

/**
 * Format date and time for display
 * @param {Date|string} datetime - DateTime to format
 * @param {string} locale - Locale string
 * @returns {string} Formatted datetime string
 */
export function formatDateTimeDisplay(datetime, locale = undefined) {
	if (!datetime) return "";

	try {
		const d = datetime instanceof Date ? datetime : new Date(datetime);
		if (isNaN(d.getTime())) return "";

		return d.toLocaleString(locale, {
			year: "numeric",
			month: "short",
			day: "numeric",
			hour: "2-digit",
			minute: "2-digit",
		});
	} catch (e) {
		console.error("Error formatting datetime:", e);
		return "";
	}
}

/**
 * Check if date is in the past
 * @param {Date|string} date - Date to check
 * @returns {boolean} True if date is before today
 */
export function isOverdue(date) {
	if (!date) return false;

	try {
		const d = date instanceof Date ? date : new Date(date);
		if (isNaN(d.getTime())) return false;

		const today = new Date();
		today.setHours(0, 0, 0, 0);
		d.setHours(0, 0, 0, 0);

		return d < today;
	} catch (e) {
		return false;
	}
}

/**
 * Get date N days ago from today
 * @param {number} days - Number of days in the past
 * @returns {Date} Date object
 */
export function getDaysAgo(days) {
	const date = new Date();
	date.setDate(date.getDate() - days);
	return date;
}

/**
 * Calculate days between two dates
 * @param {Date|string} startDate - Start date
 * @param {Date|string} endDate - End date
 * @returns {number} Number of days (can be negative if start > end)
 */
export function daysBetween(startDate, endDate) {
	try {
		const start = startDate instanceof Date ? startDate : new Date(startDate);
		const end = endDate instanceof Date ? endDate : new Date(endDate);

		if (isNaN(start.getTime()) || isNaN(end.getTime())) return 0;

		const diffMs = end.getTime() - start.getTime();
		return Math.floor(diffMs / (24 * 60 * 60 * 1000));
	} catch (e) {
		return 0;
	}
}

/**
 * Get start and end dates for relative date range
 * @param {string} range - Range identifier ('7', '30', '90', 'ALL')
 * @returns {Object} Object with from and to dates
 */
export function getDateRangeFromString(range) {
	const to = new Date();
	let from = null;

	if (range === "7" || range === "30" || range === "90") {
		const days = parseInt(range, 10);
		from = getDaysAgo(days);
	}

	return { from, to };
}

/**
 * Check if date is within range
 * @param {Date|string} date - Date to check
 * @param {Date|string} from - Start of range (null for no lower bound)
 * @param {Date|string} to - End of range (null for no upper bound)
 * @returns {boolean} True if date is within range
 */
export function isDateInRange(date, from, to) {
	if (!date) return true; // Unknown dates pass through

	try {
		const d = date instanceof Date ? date : new Date(date);
		if (isNaN(d.getTime())) return true;

		if (from) {
			const fromDate = from instanceof Date ? from : new Date(from);
			if (!isNaN(fromDate.getTime()) && d < fromDate) return false;
		}

		if (to) {
			const toDate = to instanceof Date ? to : new Date(to);
			if (!isNaN(toDate.getTime()) && d > toDate) return false;
		}

		return true;
	} catch (e) {
		return true;
	}
}

/**
 * Parse ISO date string safely
 * @param {string} dateString - ISO date string (YYYY-MM-DD)
 * @returns {Date|null} Date object or null if invalid
 */
export function parseISODate(dateString) {
	if (!dateString) return null;

	try {
		const d = new Date(dateString);
		return isNaN(d.getTime()) ? null : d;
	} catch (e) {
		return null;
	}
}

/**
 * Get today's date in ISO format
 * @returns {string} Today's date as YYYY-MM-DD
 */
export function getTodayISO() {
	return formatDateISO(new Date());
}

/**
 * Format date for input fields (ensures proper format for lightning-input type="date")
 * @param {Date|string} date - Date to format
 * @returns {string} Date in YYYY-MM-DD format for inputs
 */
export function formatDateForInput(date) {
	return formatDateISO(date);
}

/**
 * Format date as relative time ("2 days ago", "Tomorrow", "Today")
 * @param {Date|string} date - Date to format
 * @param {string} locale - Locale string
 * @returns {string} Relative date string
 */
export function formatDateRelative(date, locale = undefined) {
	if (!date) return "";

	try {
		const d = date instanceof Date ? date : new Date(date);
		if (isNaN(d.getTime())) return "";

		const now = new Date();
		const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
		const targetDate = new Date(d.getFullYear(), d.getMonth(), d.getDate());
		const diffDays = Math.floor(
			(targetDate.getTime() - today.getTime()) / (24 * 60 * 60 * 1000)
		);

		// Today
		if (diffDays === 0) return "Today";

		// Tomorrow
		if (diffDays === 1) return "Tomorrow";

		// Yesterday
		if (diffDays === -1) return "Yesterday";

		// Within a week (past)
		if (diffDays > -7 && diffDays < 0) {
			return `${Math.abs(diffDays)} day${
				Math.abs(diffDays) > 1 ? "s" : ""
			} ago`;
		}

		// Within a week (future)
		if (diffDays > 0 && diffDays < 7) {
			return `In ${diffDays} day${diffDays > 1 ? "s" : ""}`;
		}

		// More than a week
		return formatDateDisplay(d, locale);
	} catch (e) {
		console.error("Error formatting relative date:", e);
		return "";
	}
}

/**
 * Format date for display with time if today, otherwise just date
 * @param {Date|string} datetime - DateTime to format
 * @param {string} locale - Locale string
 * @returns {string} Smart formatted string
 */
export function formatDateTimeSmart(datetime, locale = undefined) {
	if (!datetime) return "";

	try {
		const d = datetime instanceof Date ? datetime : new Date(datetime);
		if (isNaN(d.getTime())) return "";

		const now = new Date();
		const isToday =
			d.getFullYear() === now.getFullYear() &&
			d.getMonth() === now.getMonth() &&
			d.getDate() === now.getDate();

		if (isToday) {
			// Show only time for today
			return d.toLocaleTimeString(locale, {
				hour: "2-digit",
				minute: "2-digit",
			});
		} else {
			// Show full date and time
			return formatDateTimeDisplay(d, locale);
		}
	} catch (e) {
		console.error("Error in smart datetime formatting:", e);
		return "";
	}
}

/**
 * Check if date is due soon (within specified days)
 * @param {Date|string} date - Date to check
 * @param {number} withinDays - Number of days to consider "soon" (default: 3)
 * @returns {boolean} True if date is within the next N days
 */
export function isDueSoon(date, withinDays = 3) {
	if (!date) return false;

	try {
		const d = date instanceof Date ? date : new Date(date);
		if (isNaN(d.getTime())) return false;

		const today = new Date();
		today.setHours(0, 0, 0, 0);
		d.setHours(0, 0, 0, 0);

		const diffDays = Math.floor(
			(d.getTime() - today.getTime()) / (24 * 60 * 60 * 1000)
		);

		return diffDays >= 0 && diffDays <= withinDays;
	} catch (e) {
		return false;
	}
}
