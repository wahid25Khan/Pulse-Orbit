// Base-60 time math helpers for Logged Time

/**
 * Parse a display value like "1.30" (1 hour 30 minutes) into total minutes (90)
 * Handles overflow minutes (e.g., 1.75 => 2h 15m => 135 minutes) and negatives
 * @param {string|number} val
 * @returns {number} total minutes
 */
export function displayToMinutes(val) {
    if (val === null || val === undefined || val === "") return 0;
    const num = typeof val === "number" ? val : parseFloat(String(val));
    if (!Number.isFinite(num)) return 0;
    const sign = num < 0 ? -1 : 1;
    const abs = Math.abs(num);
    const hours = Math.trunc(abs);
    let minutes = Math.round((abs - hours) * 100);
    // Normalize overflow minutes to base-60
    const carry = Math.trunc(minutes / 60);
    const normMins = minutes % 60;
    return sign * ((hours + carry) * 60 + normMins);
}

/**
 * Convert total minutes to a display value like 1.30 (1 hour 30 minutes)
 * @param {number} totalMinutes
 * @returns {string} hours.mm with two-digit minutes
 */
export function minutesToDisplay(totalMinutes) {
    const mins = Math.max(0, Math.trunc(totalMinutes || 0));
    const hours = Math.floor(mins / 60);
    const rem = mins % 60;
    const mm = rem < 10 ? `0${rem}` : String(rem);
    return `${hours}.${mm}`;
}

/**
 * Add 15 minutes to a display value using base-60 arithmetic
 * @param {string|number} val
 * @returns {string}
 */
export function stepPlus15(val) {
    const mins = displayToMinutes(val) + 15;
    return minutesToDisplay(mins);
}

/**
 * Subtract 15 minutes to a display value using base-60 arithmetic; clamp at 0
 * @param {string|number} val
 * @returns {string}
 */
export function stepMinus15(val) {
    const mins = Math.max(0, displayToMinutes(val) - 15);
    return minutesToDisplay(mins);
}

/**
 * Normalize a user-entered display value to base-60 (minutes 00-59)
 * @param {string|number} val
 * @returns {string}
 */
export function normalizeDisplay(val) {
    return minutesToDisplay(displayToMinutes(val));
}
