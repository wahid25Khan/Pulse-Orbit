/**
 * Toast notification helper utility
 * Provides consistent toast messaging across all Kanban components
 *
 * @module shared/utils/toastHelper
 */

import { ShowToastEvent } from "lightning/platformShowToastEvent";

/**
 * Display a toast notification
 * @param {Object} context - The LWC component context (this)
 * @param {string} title - Toast title
 * @param {string} message - Toast message
 * @param {string} variant - Toast variant: 'success', 'error', 'warning', 'info'
 */
export function showToast(
	context,
	title,
	message,
	variant = "info",
	mode = "dismissible"
) {
	if (!context) {
		console.error("showToast: context is required");
		return;
	}

	const event = new ShowToastEvent({
		title,
		message,
		variant,
		mode,
	});

	context.dispatchEvent(event);
}

/**
 * Show success toast
 * @param {Object} context - The LWC component context (this)
 * @param {string} title - Toast title
 * @param {string} message - Toast message
 */
export function showSuccess(context, title, message, mode = "dismissible") {
	showToast(context, title, message, "success", mode);
}

/**
 * Show error toast
 * @param {Object} context - The LWC component context (this)
 * @param {string} title - Toast title
 * @param {string} message - Toast message
 */
export function showError(context, title, message, mode = "dismissible") {
	showToast(context, title, message, "error", mode);
}

/**
 * Show warning toast
 * @param {Object} context - The LWC component context (this)
 * @param {string} title - Toast title
 * @param {string} message - Toast message
 */
export function showWarning(context, title, message, mode = "dismissible") {
	showToast(context, title, message, "warning", mode);
}

/**
 * Show info toast
 * @param {Object} context - The LWC component context (this)
 * @param {string} title - Toast title
 * @param {string} message - Toast message
 */
export function showInfo(context, title, message, mode = "dismissible") {
	showToast(context, title, message, "info", mode);
}
