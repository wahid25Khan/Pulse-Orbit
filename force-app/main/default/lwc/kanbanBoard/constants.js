/**
 * @description Constants and configuration values for Kanban Board
 * Centralizes magic numbers and hard-coded values for maintainability
 */

// Search and Filter Constants
export const SEARCH_DEBOUNCE_MS = 300;
export const SEARCH_MIN_CHARS = 2;
export const SEARCH_MAX_RESULTS = 20;

// Time and Progress Constants
export const MAX_COMPLETION_PERCENT = 100;
export const MIN_COMPLETION_PERCENT = 0;
export const TIME_INCREMENT_MINUTES = 15;
export const DEFAULT_TIME_VALUE = "0.00";

// UI Constants
export const DEFAULT_MAX_EXPANDED_COLUMNS = 8;
export const TOAST_AUTO_CLOSE_MS = 3000;
export const FOCUS_DELAY_MS = 100;
export const SCROLL_BEHAVIOR = "smooth";
export const COMMENT_POLLING_INTERVAL_MS = 30000; // 30 seconds
export const UNDO_TIMEOUT_MS = 30000; // 30 seconds
export const HOVER_DELAY_MS = 300; // Delay before showing hover previews

// Priority Options
export const PRIORITY_HIGH = "High";
export const PRIORITY_MEDIUM = "Medium";
export const PRIORITY_NORMAL = "Normal";
export const PRIORITY_LOW = "Low";

export const PRIORITY_OPTIONS = [
	{ label: PRIORITY_HIGH, value: PRIORITY_HIGH },
	{ label: PRIORITY_MEDIUM, value: PRIORITY_MEDIUM },
	{ label: PRIORITY_LOW, value: PRIORITY_LOW },
];

// Fixed Status Options (UI override)
export const FIXED_STATUS_VALUES = [
	"Not Started",
	"In Progress",
	"Ready for Review",
	"Waiting on Client",
	"On Hold",
	"Reopened",
	"Completed",
	"Closed",
	"Cancelled",
];

export const FIXED_STATUS_OPTIONS = FIXED_STATUS_VALUES.map((v) => ({
	label: v,
	value: v,
}));

// Category Options
export const CATEGORY_OPTIONS = [
	{ label: "Development", value: "Development" },
	{ label: "Configuration", value: "Configuration" },
	{ label: "Admin", value: "Admin" },
	{ label: "Documentation", value: "Documentation" },
	{ label: "Testing", value: "Testing" },
	{ label: "Deployment", value: "Deployment" },
	{ label: "Client Coordination", value: "Client Coordination" },
	{ label: "Bug Fix", value: "Bug Fix" },
	{ label: "Review & Sign-Off", value: "Review & Sign-Off" },
	{ label: "Training / Handoff", value: "Training / Handoff" },
];

// Delay Status Options
export const DELAY_STATUS_OPTIONS = [
	{ label: "Not Started", value: "Not Started" },
	{ label: "In Progress", value: "In Progress" },
	{ label: "Ready for Review", value: "Ready for Review" },
	{ label: "Waiting on Client", value: "Waiting on Client" },
	{ label: "On Hold", value: "On Hold" },
	{ label: "Reopened", value: "Reopened" },
	{ label: "Completed", value: "Completed" },
	{ label: "Closed", value: "Closed" },
];

// Progress Percent Options (0-100 in 5% increments)
export const PROGRESS_PERCENT_OPTIONS = Array.from({ length: 21 }, (_, i) => {
	const value = i * 5;
	return { label: `${value}%`, value: String(value) };
});

// Error Messages
export const ERROR_MESSAGES = {
	SUBJECT_REQUIRED: "Subject is required",
	STATUS_REQUIRED: "Status is required",
	CASE_REQUIRED: "Case is required",
	COMPLETION_REQUIRED: "Completion is required",
	DATE_REQUIRED: "Date is required",
	DESCRIPTION_REQUIRED: "Description is required",
	TIME_POSITIVE: "Time must be greater than 0",
	COMPLETION_EXCEEDS: "Total completion cannot exceed 100%",
	PARENT_SELF_REFERENCE: "A task cannot be its own parent",
	GENERIC_ERROR: "An error occurred. Please try again.",
	LOAD_FAILED: "Failed to load data",
	SAVE_FAILED: "Failed to save changes",
	DELETE_FAILED: "Failed to delete item",
	NETWORK_ERROR: "Network error. Please check your connection.",
};

// Success Messages
export const SUCCESS_MESSAGES = {
	TASK_CREATED: "Task created successfully",
	TASK_UPDATED: "Task updated successfully",
	TASK_DELETED: "Task deleted successfully",
	TIME_LOGGED: "Time logged successfully",
	COMMENT_POSTED: "Comment posted successfully",
	SETTINGS_SAVED: "Settings saved successfully",
	FILTERS_APPLIED: "Filters applied",
	FILTERS_CLEARED: "Filters cleared",
};

// Validation Patterns
export const VALIDATION = {
	TIME_FORMAT: /^\d+:\d{2}$/,
	DECIMAL_FORMAT: /^\d+(\.\d{1,2})?$/,
};

// Keyboard Shortcuts
export const KEYBOARD_SHORTCUTS = {
	NEW_TASK: { key: "k", ctrl: true, alt: false, shift: false },
	FILTER: { key: "f", ctrl: true, alt: false, shift: false },
	REFRESH: { key: "r", ctrl: true, alt: false, shift: false },
	SEARCH: { key: "/", ctrl: false, alt: false, shift: false },
};

// Local Storage Keys
export const STORAGE_KEYS = {
	COLLAPSED_COLUMNS: "kanban_collapsed_columns",
	USER_PREFERENCES: "kanban_user_preferences",
	FILTER_STATE: "kanban_filter_state",
	VIEW_MODE: "kanban_view_mode",
};

// Z-Index Layers
export const Z_INDEX = {
	BASE: 1,
	SIDEBAR: 10,
	DROPDOWN: 100,
	DRAWER: 1000,
	BACKDROP: 1500,
	MODAL: 2000,
	TIME_LOG_MODAL: 9999,
};

// History and Undo Constants (MIN-007)
export const MAX_UNDO_HISTORY_SIZE = 5; // Maximum number of undo operations to keep
export const UNDO_BANNER_TIMEOUT_MS = 30000; // 30 seconds to undo before it expires

// Color Manipulation Constants
export const COLOR_BIT_SHIFT_RED = 16;
export const COLOR_BIT_SHIFT_GREEN = 8;
export const COLOR_MAX_VALUE = 255;
export const HEX_COLOR_PAD_LENGTH = 6;
export const HEX_COLOR_BASE = 16;

// Status Order Numbers (for reference)
export const STATUS_ORDER_INCREMENT = 10; // Standard increment: 10, 20, 30, etc.
