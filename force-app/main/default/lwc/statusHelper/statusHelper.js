/**
 * Status helper utilities
 * Provides status normalization and validation for Kanban components
 * 
 * @module shared/utils/statusHelper
 */

/**
 * Valid Kanban status values
 * Centralized list of acceptable status values
 */
export const VALID_STATUSES = [
    'Not Started',
    'In Progress',
    'Ready for Review',
    'Waiting on Client',
    'On hold',
    'Reopened',
    'Completed',
    'Closed',
    'Cancelled'
];

/**
 * Normalize status value for consistent comparison
 * Ensures status values match canonical format from VALID_STATUSES
 * 
 * @param {string} statusName - Raw status value to normalize
 * @returns {string} Normalized status value or "Uncategorized"
 */
export function normalizeStatusValue(statusName) {
    if (!statusName || typeof statusName !== "string") {
        return "Uncategorized";
    }

    const trimmed = statusName.trim();
    if (trimmed.length === 0) {
        return "Uncategorized";
    }

    // Find canonical match (case-insensitive)
    const canonicalMatch = VALID_STATUSES.find(
        (validStatus) =>
            typeof validStatus === "string" &&
            validStatus.toLowerCase() === trimmed.toLowerCase()
    );

    return canonicalMatch || trimmed;
}

/**
 * Check if a status value is valid
 * @param {string} status - Status to validate
 * @returns {boolean} True if status is in VALID_STATUSES
 */
export function isValidStatus(status) {
    if (!status || typeof status !== 'string') return false;

    return VALID_STATUSES.some(
        validStatus => validStatus.toLowerCase() === status.trim().toLowerCase()
    );
}

/**
 * Get display label for status
 * Can be extended to support custom labels in the future
 * @param {string} status - Status value
 * @returns {string} Display label
 */
export function getStatusLabel(status) {
    return normalizeStatusValue(status);
}