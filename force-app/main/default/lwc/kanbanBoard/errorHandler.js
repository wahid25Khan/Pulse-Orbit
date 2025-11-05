/**
 * Centralized Error Handling Utility (MIN-002)
 * Provides consistent error messaging across the Kanban board application
 */

/**
 * Error message templates for common scenarios
 */
const ERROR_MESSAGES = {
	// Network/Server Errors
	NETWORK_ERROR: {
		title: "Connection Error",
		message:
			"Unable to connect to the server. Please check your internet connection and try again.",
		variant: "error",
	},
	TIMEOUT_ERROR: {
		title: "Request Timeout",
		message: "The request took too long to complete. Please try again.",
		variant: "error",
	},
	SERVER_ERROR: {
		title: "Server Error",
		message:
			"An unexpected server error occurred. Our team has been notified. Please try again later.",
		variant: "error",
	},

	// Authentication/Permission Errors
	UNAUTHORIZED: {
		title: "Access Denied",
		message:
			"You don't have permission to perform this action. Please contact your administrator.",
		variant: "error",
	},
	SESSION_EXPIRED: {
		title: "Session Expired",
		message:
			"Your session has expired. Please refresh the page and log in again.",
		variant: "warning",
	},

	// Data Validation Errors
	VALIDATION_ERROR: {
		title: "Validation Error",
		message: "Please check your input and try again.",
		variant: "error",
	},
	REQUIRED_FIELD: {
		title: "Required Field Missing",
		message: "Please fill in all required fields.",
		variant: "error",
	},
	INVALID_DATA: {
		title: "Invalid Data",
		message: "The data you entered is invalid. Please check and try again.",
		variant: "error",
	},

	// Task Operation Errors
	TASK_NOT_FOUND: {
		title: "Task Not Found",
		message: "The task you're looking for doesn't exist or has been deleted.",
		variant: "error",
	},
	TASK_UPDATE_FAILED: {
		title: "Update Failed",
		message: "Failed to update the task. Please try again.",
		variant: "error",
	},
	TASK_CREATE_FAILED: {
		title: "Creation Failed",
		message:
			"Failed to create the task. Please check your input and try again.",
		variant: "error",
	},
	TASK_DELETE_FAILED: {
		title: "Deletion Failed",
		message: "Failed to delete the task. Please try again.",
		variant: "error",
	},

	// Comment Errors
	COMMENT_LOAD_FAILED: {
		title: "Comments Unavailable",
		message: "Failed to load comments. Please refresh the page.",
		variant: "warning",
	},
	COMMENT_POST_FAILED: {
		title: "Comment Failed",
		message: "Failed to post your comment. Please try again.",
		variant: "error",
	},

	// File Operations
	FILE_UPLOAD_FAILED: {
		title: "Upload Failed",
		message: "Failed to upload file. Please check the file size and format.",
		variant: "error",
	},
	FILE_TOO_LARGE: {
		title: "File Too Large",
		message:
			"The file exceeds the maximum allowed size. Please choose a smaller file.",
		variant: "error",
	},

	// Bulk Operations
	BULK_OPERATION_FAILED: {
		title: "Bulk Operation Failed",
		message:
			"Some tasks could not be updated. Please try again or update them individually.",
		variant: "error",
	},

	// General
	UNKNOWN_ERROR: {
		title: "Unexpected Error",
		message:
			"An unexpected error occurred. Please try again or contact support if the problem persists.",
		variant: "error",
	},
};

/**
 * Parse Salesforce error object into user-friendly message
 * @param {Object} error - Error object from Salesforce
 * @returns {Object} Normalized error with title, message, and variant
 */
export function parseError(error) {
	if (!error) {
		return ERROR_MESSAGES.UNKNOWN_ERROR;
	}

	// Extract error message from various Salesforce error formats
	let errorMessage = "";
	let errorCode = "";

	// Check for common Salesforce error structures
	if (error.body) {
		if (error.body.message) {
			errorMessage = error.body.message;
		} else if (error.body.pageErrors && error.body.pageErrors.length > 0) {
			errorMessage = error.body.pageErrors[0].message;
		} else if (error.body.fieldErrors) {
			const fieldErrors = Object.values(error.body.fieldErrors).flat();
			if (fieldErrors.length > 0) {
				errorMessage = fieldErrors[0].message;
			}
		}
		if (error.body.statusCode) {
			errorCode = error.body.statusCode;
		}
	} else if (error.message) {
		errorMessage = error.message;
	} else if (typeof error === "string") {
		errorMessage = error;
	}

	// Match error to predefined categories
	if (
		errorCode === "401" ||
		errorMessage.toLowerCase().includes("unauthorized")
	) {
		return ERROR_MESSAGES.UNAUTHORIZED;
	}

	if (errorCode === "403" || errorMessage.toLowerCase().includes("forbidden")) {
		return ERROR_MESSAGES.UNAUTHORIZED;
	}

	if (errorCode === "404" || errorMessage.toLowerCase().includes("not found")) {
		return ERROR_MESSAGES.TASK_NOT_FOUND;
	}

	if (
		errorCode === "500" ||
		errorMessage.toLowerCase().includes("server error")
	) {
		return ERROR_MESSAGES.SERVER_ERROR;
	}

	if (errorMessage.toLowerCase().includes("timeout")) {
		return ERROR_MESSAGES.TIMEOUT_ERROR;
	}

	if (
		errorMessage.toLowerCase().includes("network") ||
		errorMessage.toLowerCase().includes("connection")
	) {
		return ERROR_MESSAGES.NETWORK_ERROR;
	}

	if (
		errorMessage.toLowerCase().includes("validation") ||
		errorMessage.toLowerCase().includes("required")
	) {
		return {
			...ERROR_MESSAGES.VALIDATION_ERROR,
			message: errorMessage || ERROR_MESSAGES.VALIDATION_ERROR.message,
		};
	}

	// Return custom message if available, otherwise unknown error
	if (errorMessage) {
		return {
			title: "Error",
			message: errorMessage,
			variant: "error",
		};
	}

	return ERROR_MESSAGES.UNKNOWN_ERROR;
}

/**
 * Get specific error message template
 * @param {string} key - Error message key
 * @returns {Object} Error message object
 */
export function getErrorMessage(key) {
	return ERROR_MESSAGES[key] || ERROR_MESSAGES.UNKNOWN_ERROR;
}

/**
 * Format error for display with optional custom message
 * @param {Object} error - Error object
 * @param {string} customMessage - Optional custom message to append
 * @returns {Object} Formatted error
 */
export function formatError(error, customMessage = null) {
	const parsed = parseError(error);

	if (customMessage) {
		return {
			...parsed,
			message: `${parsed.message}\n\n${customMessage}`,
		};
	}

	return parsed;
}

/**
 * Log error for debugging (in non-production environments)
 * @param {string} context - Context where error occurred
 * @param {Object} error - Error object
 */
export function logError(context, error) {
	// Only log in development/debug mode
	if (
		window.location.hostname === "localhost" ||
		window.location.search.includes("debug=true")
	) {
		console.group(`❌ Error in ${context}`);
		console.error("Error object:", error);
		if (error?.body) {
			console.error("Error body:", error.body);
		}
		if (error?.stack) {
			console.error("Stack trace:", error.stack);
		}
		console.groupEnd();
	}
}
