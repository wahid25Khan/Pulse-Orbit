import createLoggedTimeWithOptionalDelay from "@salesforce/apex/KanbanBoardController.createLoggedTimeWithOptionalDelay";
import createTaskCommentFromMap from "@salesforce/apex/KanbanBoardController.createTaskCommentFromMap";
import createTaskFromMap from "@salesforce/apex/KanbanBoardController.createTaskFromMap";
import getAssignableUsers from "@salesforce/apex/KanbanBoardController.getAssignableUsers";
import getCurrentUserContext from "@salesforce/apex/KanbanBoardController.getCurrentUserContext";
import getCurrentUserId from "@salesforce/apex/KanbanBoardController.getCurrentUserId";
import getProjects from "@salesforce/apex/KanbanBoardController.getProjects";
import getStatusColors from "@salesforce/apex/KanbanBoardController.getStatusColors";
import getTaskCommentsAsMaps from "@salesforce/apex/KanbanBoardController.getTaskCommentsAsMaps";
import getTasks from "@salesforce/apex/KanbanBoardController.getTasks";
import getTeamFromTasks from "@salesforce/apex/KanbanBoardController.getTeamFromTasks";
import getTeamStatuses from "@salesforce/apex/KanbanBoardController.getTeamStatuses";
import getTimeLogAggregates from "@salesforce/apex/KanbanBoardController.getTimeLogAggregates";
import getUserPreferences from "@salesforce/apex/KanbanBoardController.getUserPreferences";
import moveTask from "@salesforce/apex/KanbanBoardController.moveTask";
import saveUserPreferences from "@salesforce/apex/KanbanBoardController.saveUserPreferences";
import searchCases from "@salesforce/apex/KanbanBoardController.searchCases";
import updateTaskFromMap from "@salesforce/apex/KanbanBoardController.updateTaskFromMap";
import updateTaskOrder from "@salesforce/apex/KanbanBoardController.updateTaskOrder";
import searchInternalUsersForTagging from "@salesforce/apex/TaskCommentService.searchInternalUsersForTagging";
import searchPortalUsersForTagging from "@salesforce/apex/TaskCommentService.searchPortalUsersForTagging";
import TLG_TASKFEED_OBJECT from "@salesforce/schema/TLG_TaskFeed__c";
import {
	isValidStatus,
	normalizeStatusKey,
	normalizeStatusValue,
	statusEquals,
} from "c/statusHelper";
import { showToast } from "c/toastHelper";
import {
	getObjectInfo,
	getPicklistValuesByRecordType,
} from "lightning/uiObjectInfoApi";
import { api, LightningElement, track, wire } from "lwc";
import {
	COLOR_BIT_SHIFT_GREEN,
	COLOR_BIT_SHIFT_RED,
	COLOR_MAX_VALUE,
	COMMENT_POLLING_INTERVAL_MS,
	FOCUS_DELAY_MS,
	HEX_COLOR_BASE,
	HEX_COLOR_PAD_LENGTH,
	MAX_COMPLETION_PERCENT,
	MAX_UNDO_HISTORY_SIZE,
	PROGRESS_PERCENT_OPTIONS,
	SEARCH_DEBOUNCE_MS,
	SEARCH_MAX_RESULTS,
} from "./constants";
import { formatDateForInput, formatDateISO, getTodayISO } from "./dateUtils";
import { debounce } from "./debounceUtils";
import { KanbanDataService } from "./kanbanDataService";
import {
	getStorageItem,
	setStorageItem,
	getStorageJSON,
	setStorageJSON,
} from "./storageUtils";
import {
	displayToMinutes,
	minutesToDisplay,
	normalizeDisplay,
	stepMinus15,
	stepPlus15,
} from "./timeMath";

export default class KanbanBoard extends LightningElement {
	@track _columns = [];
	@track isLoading = false;
	@track error = null;
	@track currentUser = null;
	@track isPortalUser = false;
	@track _movingCardIds = new Set(); // Track cards being moved

	// UX-002: Undo banner state
	@track showUndoBanner = false;
	@track undoMessage = "";
	_undoTimerId = null;
	_lastMove = null;
	_moveHistory = [];
	_redoStack = [];

	// PERF-001: Virtual scrolling config/state
	enableVirtualScroll = true;
	virtualRowHeight = 240; // px, estimated card wrapper height
	virtualBuffer = 3; // rows buffer before/after viewport
	_minVirtualCards = 50; // threshold per column to enable virtualization
	_boundHandleWindowScroll = null;
	_boundHandleWindowResize = null;

	@track _projects = [];
	@track users = [];

	@track selectedTeamId = "";
	@track selectedAssignedToId = "";
	@track selectedProjectId = "";
	// Tracks if the user explicitly changed the Assigned To filter (so selecting a project can show all tickets by default)
	@track userAdjustedAssignedTo = false;
	@track startDate = "";
	@track endDate = "";
	@track teamOptions = [];
	@track assignableUsersOptions = [];
	@track projectOptions = [];
	@track showFilterDrawer = false;
	@track activeFilterCount = 0;
	@track showSettingsMenu = false;
	@track collapsedColumns = new Set(); // Track which columns are collapsed by ID
	@track manuallyCollapsedColumns = new Set(); // Track user's manual collapse choices
	@track manuallyExpandedColumns = new Set(); // Track user's manual expand choices
	@track selectedNav = "kanban"; // sidebar active item
	@track isCompactView = false; // compact density toggle

	@api isDarkMode = false;
	@api timeLogModalActive = false;
	@api disableAutoInit = false; // allows tests to skip heavy init

	defaultMaxExpandedColumns = 8;
	maxExpandedColumnsSetting = null;
	autoCollapseNoticeShown = false;

	// New Task Drawer state
	@api showNewTaskDrawer = false;
	@track newTaskData = {
		Name: "",
		TLG_Status__c: "Not Started",
		TLG_Priority__c: "Normal",
		TLG_Opportunity__c: "",
		TLG_Team__c: "",
		TLG_Assigned_To__c: "",
		TLG_Due_Date__c: "",
		Total_Estimated_Time__c: "",
		Progress__c: "",
		TLG_Category__c: "",
		TLG_Shared_Notes__c: "",
		TLG_Case__c: "",
		Parent__c: "",
	};

	// Task Detail Drawer state
	@api showTaskDrawer = false;
	@api selectedTaskId = null;
	@track isEditingTask = false;
	@track editTaskData = {};
	@track teamStatusOptionsByTeamId = {};
	// Lookup UI state and save flags
	@track newCaseSearchText = "";
	@track caseResultsNew = [];
	@track showCaseResultsNew = false;
	@track newParentSearchText = "";
	@track parentTaskResultsNew = [];
	@track showParentResultsNew = false;

	@track editCaseSearchText = "";
	@track caseResultsEdit = [];
	@track showCaseResultsEdit = false;
	@track editParentSearchText = "";
	@track parentTaskResultsEdit = [];
	@track showParentResultsEdit = false;

	// Lookup loading indicators
	@track isSearchingCaseNew = false;
	@track isSearchingParentNew = false;
	@track isSearchingCaseEdit = false;
	@track isSearchingParentEdit = false;

	@track isSavingNew = false;
	@track isSavingEdit = false;
	// Logged Time state
	@track logTimeData = {
		Completion__c: "",
		TLG_Date_Record__c: "",
		TLG_Description__c: "",
		TLG_Time_Spent__c: "0.00",
	};
	@track logErrors = {};
	@track isSubmittingLogTime = false; // Prevent race conditions
	// Priority normalization helper
	normalizePriority(value) {
		if (!value) return "";
		const v = String(value).trim();
		return v === "Medium" ? "Normal" : v;
	}
	@track timeAggregates = {
		totalMinutes: 0,
		totalCompletion: 0,
		entryCount: 0,
	};
	@track remainingEstimateMinutes = 0;
	get remainingEstimateDisplay() {
		return minutesToDisplay(this.remainingEstimateMinutes || 0);
	}
	@track showDelayModal = false;
	@track delayForm = {
		Subject: "",
		AssignedToName: "",
		Delay_Origin__c: "",
		Category__c: "",
		Status: "",
		Delay_Days__c: 0,
		Description: "",
	};
	@track delayPicklists = { origins: [], categories: [], dependency: {} };
	delayStatusOptions = [
		{ label: "Not Started", value: "Not Started" },
		{ label: "In Progress", value: "In Progress" },
		{ label: "Ready for Review", value: "Ready for Review" },
		{ label: "Waiting on Client", value: "Waiting on Client" },
		{ label: "On Hold", value: "On Hold" },
		{ label: "Reopened", value: "Reopened" },
		{ label: "Completed", value: "Completed" },
		{ label: "Closed", value: "Closed" },
	];
	// Comments state
	@track comments = [];
	@api newCommentText = "";
	@track isPostingComment = false;
	@track isLoadingComments = false;
	_commentPollingInterval = null; // Interval ID for comment polling
	_commentPollingFrequency = COMMENT_POLLING_INTERVAL_MS;
	// Additional loading indicators
	@track isRefreshingTimeAggregates = false;
	@track isBulkOperating = false;
	// Mentions UI state
	@track mentionSearchText = "";
	@track isSearchingMentions = false;
	@track mentionResults = [];
	@api selectedMentions = [];
	@track taskDrawerFocus = "details";
	@track showTimeLogSection = false;

	// Internal state for drag and filters
	_draggedCardId = null;
	_filters = {};
	_originalTasks = null; // Store original unfiltered tasks
	_allTasks = []; // Current (possibly filtered) task collection
	_rawTasksData = []; // Raw Salesforce task data for re-processing

	// Bulk operations state
	selectedTaskIds = new Set(); // Track selected task IDs for bulk operations
	_lastClickedTaskId = null; // Track last clicked task for shift-click range selection
	@track isBulkMode = false; // Toggle bulk selection mode

	// Quick Filters state (UX-006)
	@track quickFilters = {
		myTasks: false,
		highPriority: false,
		dueSoon: false,
		overdue: false,
		unassigned: false,
	};

	// Confirmation Dialog state (MIN-005)
	@track showConfirmation = false;
	@track confirmationConfig = {
		title: "",
		message: "",
		confirmLabel: "Confirm",
		cancelLabel: "Cancel",
		onConfirm: null,
		onCancel: null,
	};
	_hasUnsavedChanges = false;

	// Computed properties for UI
	get hasCustomColumnOrdering() {
		return this._columns.some(
			(col) => col.orderNumber && col.orderNumber !== col.index
		);
	}

	get columnOrderingInfo() {
		if (!this.hasCustomColumnOrdering) return null;

		const teamColumns = this._columns.filter(
			(col) => col.orderNumber && col.orderNumber !== col.index
		);
		return `${teamColumns.length} column${
			teamColumns.length !== 1 ? "s" : ""
		} using custom order`;
	}

	get isLogTimeFocus() {
		return this.taskDrawerFocus === "logTime";
	}

	get showTaskDetailsSection() {
		return true;
	}

	get showCommentsSection() {
		return true;
	}

	get showLogTimeSection() {
		return true;
	}

	get logTimeSectionClass() {
		const classes = ["log-time-section"];
		if (this.isLogTimeFocus) {
			classes.push("highlighted");
		}
		return classes.join(" ");
	}

	get taskDrawerMainIcon() {
		return this.isLogTimeFocus ? "utility:clock" : "utility:task";
	}

	get taskDrawerMainTitle() {
		return this.isLogTimeFocus ? "Log Time" : "Details";
	}

	// Bulk selection computed properties
	get hasSelectedTasks() {
		return this.selectedTaskIds.size > 0;
	}

	get selectedTaskCount() {
		return this.selectedTaskIds.size;
	}

	get bulkActionLabel() {
		const count = this.selectedTaskCount;
		return count === 1 ? "1 task selected" : `${count} tasks selected`;
	}

	// Sidebar helpers
	get navClassDashboard() {
		return this.selectedNav === "dashboard" ? "active" : "";
	}

	get navClassKanban() {
		return this.selectedNav === "kanban" ? "active" : "";
	}

	get navClassTasks() {
		return this.selectedNav === "tasks" ? "active" : "";
	}

	get themeToggleLabel() {
		return this.isDarkMode ? "Light Mode" : "Dark Mode";
	}

	get isDashboardView() {
		return this.selectedNav === "dashboard";
	}

	get isKanbanView() {
		return this.selectedNav === "kanban";
	}

	get isTasksView() {
		return this.selectedNav === "tasks";
	}

	get computedRootClass() {
		let classes = ["kanban-root"];
		if (this.isDarkMode) classes.push("dark-mode");
		if (this.timeLogModalActive) classes.push("time-log-modal-active");
		if (this.isCompactView) classes.push("compact");
		return classes.join(" ");
	}

	get darkModeTitle() {
		return this.isDarkMode ? "Switch to Light Mode" : "Switch to Dark Mode";
	}

	get hasActiveFilters() {
		return this.activeFilterCount > 0;
	}

	// Quick Filters computed properties (UX-006)
	get activeQuickFilterCount() {
		return Object.values(this.quickFilters).filter(Boolean).length;
	}

	get hasActiveQuickFilters() {
		return this.activeQuickFilterCount > 0;
	}

	get quickFilterChips() {
		return [
			{
				key: "myTasks",
				label: "My Tasks",
				active: this.quickFilters.myTasks,
				chipClass: this.quickFilters.myTasks
					? "quick-filter-chip active"
					: "quick-filter-chip",
				icon: "utility:user",
			},
			{
				key: "highPriority",
				label: "High Priority",
				active: this.quickFilters.highPriority,
				chipClass: this.quickFilters.highPriority
					? "quick-filter-chip active"
					: "quick-filter-chip",
				icon: "utility:priority",
			},
			{
				key: "dueSoon",
				label: "Due Soon",
				active: this.quickFilters.dueSoon,
				chipClass: this.quickFilters.dueSoon
					? "quick-filter-chip active"
					: "quick-filter-chip",
				icon: "utility:warning",
			},
			{
				key: "overdue",
				label: "Overdue",
				active: this.quickFilters.overdue,
				chipClass: this.quickFilters.overdue
					? "quick-filter-chip active"
					: "quick-filter-chip",
				icon: "utility:error",
			},
			{
				key: "unassigned",
				label: "Unassigned",
				active: this.quickFilters.unassigned,
				chipClass: this.quickFilters.unassigned
					? "quick-filter-chip active"
					: "quick-filter-chip",
				icon: "utility:question",
			},
		];
	}

	get teamColumns() {
		return this._columns;
	}

	@api get selectedTaskDetails() {
		return this._selectedTaskDetails;
	}

	set selectedTaskDetails(value) {
		this._selectedTaskDetails = value;
	}

	get statusDisabledInNewTask() {
		// Always enabled per fixed list requirement
		return false;
	}

	get statusDisabledInEdit() {
		// Always enabled per fixed list requirement
		return false;
	}

	get progressPercentOptions() {
		return PROGRESS_PERCENT_OPTIONS;
	}

	// UI helpers
	get hasTeamOptions() {
		return Array.isArray(this.teamOptions) && this.teamOptions.length > 0;
	}

	// Case is Master-Detail with reparent disabled; lock editing if value exists
	get isCaseLockedEdit() {
		return !!(this.editTaskData && this.editTaskData.TLG_Case__c);
	}

	// Unified Drawer computed properties
	get showUnifiedDrawer() {
		return (
			this.showFilterDrawer || this.showNewTaskDrawer || this.showTaskDrawer
		);
	}

	get drawerTitle() {
		if (this.showFilterDrawer) return "Filters";
		if (this.showNewTaskDrawer) return "New Task";
		if (this.showTaskDrawer) return "Task Details";
		return "";
	}

	get drawerIcon() {
		if (this.showFilterDrawer) return "utility:filterList";
		if (this.showNewTaskDrawer) return "utility:add";
		if (this.showTaskDrawer) return "utility:preview";
		return "utility:kanban";
	}

	get closeButtonTitle() {
		if (this.showFilterDrawer) return "Close Filters";
		if (this.showNewTaskDrawer) return "Close New Task";
		if (this.showTaskDrawer) return "Close Task Details";
		return "Close";
	}

	// Unified drawer handlers
	handleDrawerBackdropClick() {
		this.handleCloseDrawer();
	}

	handleCloseDrawer() {
		this.showFilterDrawer = false;
		this.showNewTaskDrawer = false;
		this.showTaskDrawer = false;
		this.isEditingTask = false;
		this.taskDrawerFocus = "details";
		// Stop comment polling when drawer closes
		this.stopCommentPolling();
	}

	handleOpenFilterDrawer() {
		this.handleCloseDrawer();
		this.showFilterDrawer = true;
	}

	handleOpenNewTaskDrawer() {
		this.handleCloseDrawer();
		this.showNewTaskDrawer = true;
		// Reset new task data
		this.newTaskData = {
			Name: "",
			TLG_Status__c: "Not Started",
			TLG_Priority__c: "Normal",
			TLG_Opportunity__c: "",
			TLG_Team__c: "",
			TLG_Assigned_To__c: "",
			TLG_Due_Date__c: "",
			Total_Estimated_Time__c: "",
			Progress__c: "",
			TLG_Category__c: "",
			TLG_Shared_Notes__c: "",
			TLG_Case__c: "",
			Parent__c: "",
		};
		// Reset lookup UI state
		this.newCaseSearchText = "";
		this.caseResultsNew = [];
		this.showCaseResultsNew = false;
		this.newParentSearchText = "";
		this.parentTaskResultsNew = [];
		this.showParentResultsNew = false;
	}

	handleCardClick(event) {
		const taskId = event.detail?.taskId || event.currentTarget?.dataset?.id;
		if (!taskId) return;
		this.openTaskDrawer(taskId, "details");
	}

	async openTaskDrawer(taskId, focusMode = "details") {
		try {
			this.handleCloseDrawer();
			this.selectedTaskId = taskId;
			this.taskDrawerFocus = focusMode;
			const card = this._allTasks.find((t) => t.Id === taskId);
			const raw = (this._rawTasksData || []).find((t) => t.Id === taskId);
			const task = raw || card;
			if (!task) return;

			// Map task to editTaskData for editable display
			const normalizedPriority = this.normalizePriority(
				task.TLG_Priority__c || task.priority || ""
			);
			this.editTaskData = {
				Id: task.Id,
				Name: task.name || "",
				TLG_Status__c: task.status || "",
				TLG_Priority__c: normalizedPriority,
				TLG_Category__c: task.TLG_Category__c || task.category || "",
				TLG_Due_Date__c: task.TLG_Due_Date__c || task.dueDate || "",
				Total_Estimated_Time__c:
					task.Total_Estimated_Time__c || task.estimatedHours || "",
				Progress__c: task.Progress__c || task.progress || "",
				TLG_Assigned_To__c: task.TLG_Assigned_To__c || task.assignedToId || "",
				TLG_Opportunity__c: task.TLG_Opportunity__c || task.opportunityId || "",
				TLG_Team__c: task.TLG_Team__c || task.teamId || "",
				TLG_Shared_Notes__c: task.TLG_Shared_Notes__c || task.notes || "",
				// Preserve if present in base query
				TLG_Case__c: task.TLG_Case__c || "",
				Parent__c: task.Parent__c || "",
			};

			// Also populate selectedTaskDetails for backward compatibility
			this.selectedTaskDetails = {
				Id: task.Id,
				name: task.name,
				status: task.status,
				priority: task.priority,
				category: task.category,
				dueDate: task.dueDate,
				estimatedHours: task.estimatedHours,
				progress: task.progress,
				assignedToName: task.assignedToName,
				projectName: task.opportunityName,
				notes: task.notes,
			};

			// Load team-specific statuses if needed
			if (this.editTaskData.TLG_Team__c) {
				await this.loadTeamStatusOptions(this.editTaskData.TLG_Team__c);
			}

			this.showTaskDrawer = true;
			// Always editable
			this.isEditingTask = true;

			// Initialize Logged Time defaults
			this.logTimeData = {
				Completion__c: "",
				TLG_Date_Record__c: getTodayISO(),
				TLG_Description__c: "",
				TLG_Time_Spent__c: "0.00",
			};
			await this.refreshTimeAggregates();
			this.updateRemainingEstimate();

			// Set initial time log section visibility based on focus mode
			this.showTimeLogSection = this.isLogTimeFocus;

			if (this.isLogTimeFocus) {
				this.scrollLogTimeSectionIntoView();
			}

			// Load comments initially and start polling for updates
			this.loadComments(taskId);
			this.startCommentPolling(taskId);
		} catch (error) {
			console.error("Error opening task drawer:", error);
			showToast(this, "Error", "Unable to load task details.", "error");
		}
	}

	// Toggle time logging section visibility
	handleToggleTimeLog(event) {
		event.stopPropagation();
		this.showTimeLogSection = !this.showTimeLogSection;

		// If showing time log section, scroll it into view
		if (this.showTimeLogSection) {
			setTimeout(() => {
				this.scrollLogTimeSectionIntoView();
			}, FOCUS_DELAY_MS);
		}
	}

	scrollLogTimeSectionIntoView() {
		requestAnimationFrame(() => {
			const logSection = this.template.querySelector(
				'[data-section="log-time"]'
			);
			if (logSection && typeof logSection.scrollIntoView === "function") {
				logSection.scrollIntoView({ behavior: "smooth", block: "start" });
			}
		});
	}

	// ============ Bulk Operations ============

	/**
	 * Toggle bulk selection mode
	 */
	handleToggleBulkMode() {
		this.isBulkMode = !this.isBulkMode;
		if (!this.isBulkMode) {
			// Clear selection when exiting bulk mode
			this.selectedTaskIds.clear();
			this._lastClickedTaskId = null;
		}
		this._announce(
			this.isBulkMode
				? "Bulk selection mode enabled"
				: "Bulk selection mode disabled"
		);
	}

	/**
	 * Handle task selection (checkbox click or card click in bulk mode)
	 * @param {Event} event - Click event
	 */
	handleTaskSelect(event) {
		event.stopPropagation();
		const taskId = event.currentTarget?.dataset?.taskId || event.detail?.taskId;
		if (!taskId) return;

		const isShiftClick = event.shiftKey;

		if (isShiftClick && this._lastClickedTaskId) {
			this.handleRangeSelection(taskId);
		} else {
			this.toggleTaskSelection(taskId);
		}

		this._lastClickedTaskId = taskId;
	}

	/**
	 * Toggle selection of a single task
	 * @param {String} taskId - Task ID to toggle
	 */
	toggleTaskSelection(taskId) {
		if (this.selectedTaskIds.has(taskId)) {
			this.selectedTaskIds.delete(taskId);
		} else {
			this.selectedTaskIds.add(taskId);
		}
		// Force reactivity update
		this.selectedTaskIds = new Set(this.selectedTaskIds);
	}

	/**
	 * Handle shift-click range selection
	 * @param {String} endTaskId - End of range
	 */
	handleRangeSelection(endTaskId) {
		const startTaskId = this._lastClickedTaskId;
		const visibleTasks = this._allTasks;

		const startIndex = visibleTasks.findIndex((t) => t.Id === startTaskId);
		const endIndex = visibleTasks.findIndex((t) => t.Id === endTaskId);

		if (startIndex === -1 || endIndex === -1) return;

		const rangeStart = Math.min(startIndex, endIndex);
		const rangeEnd = Math.max(startIndex, endIndex);

		// Select all tasks in range
		for (let i = rangeStart; i <= rangeEnd; i++) {
			this.selectedTaskIds.add(visibleTasks[i].Id);
		}

		// Force reactivity update
		this.selectedTaskIds = new Set(this.selectedTaskIds);
		this._announce(`Selected ${rangeEnd - rangeStart + 1} tasks`);
	}

	/**
	 * Select all visible tasks
	 */
	handleSelectAllTasks() {
		this._allTasks.forEach((task) => {
			this.selectedTaskIds.add(task.Id);
		});
		this.selectedTaskIds = new Set(this.selectedTaskIds);
		this._announce(`Selected all ${this._allTasks.length} visible tasks`);
	}

	/**
	 * Clear all selected tasks
	 */
	handleClearSelection() {
		this.selectedTaskIds.clear();
		this._lastClickedTaskId = null;
		this.selectedTaskIds = new Set(this.selectedTaskIds);
		this._announce("Selection cleared");
	}

	/**
	 * Check if a task is selected
	 * @param {String} taskId - Task ID to check
	 * @returns {Boolean}
	 */
	isTaskSelected(taskId) {
		return this.selectedTaskIds.has(taskId);
	}

	/**
	 * Bulk update status for selected tasks
	 * @param {Event} event - Change event with new status
	 */
	async handleBulkStatusUpdate(event) {
		const newStatus = event.detail.value || event.target.value;
		if (!newStatus || this.selectedTaskIds.size === 0) return;

		const selectedIds = Array.from(this.selectedTaskIds);
		const taskCount = selectedIds.length;

		this.isBulkOperating = true;
		try {
			this._announce(`Updating status for ${taskCount} tasks...`);
			showToast(
				this,
				"Info",
				`Updating ${taskCount} task${taskCount > 1 ? "s" : ""}...`,
				"info"
			);

			// Update tasks in parallel
			const updatePromises = selectedIds.map((taskId) =>
				this.updateTaskStatus(taskId, newStatus)
			);

			await Promise.all(updatePromises);

			showToast(
				this,
				"Success",
				`Successfully updated ${taskCount} task${taskCount > 1 ? "s" : ""}`,
				"success"
			);

			// Clear selection and refresh
			this.handleClearSelection();
			await this.refreshTasks();
		} catch (error) {
			console.error("Bulk status update error:", error);
			const msg =
				error?.body?.message || error?.message || "Failed to update tasks";
			showToast(this, "Error", msg, "error");
		} finally {
			this.isBulkOperating = false;
		}
	}

	/**
	 * Helper to update a single task's status
	 * @param {String} taskId - Task ID
	 * @param {String} newStatus - New status value
	 */
	async updateTaskStatus(taskId, newStatus) {
		const task = this._allTasks.find((t) => t.Id === taskId);
		if (!task) return;

		const payload = {
			Id: taskId,
			TLG_Status__c: newStatus,
		};

		return updateTask(payload);
	}

	/**
	 * Bulk assign tasks to a user
	 * @param {Event} event - Change event with user ID
	 */
	async handleBulkAssignment(event) {
		const userId = event.detail.value || event.target.value;
		if (!userId || this.selectedTaskIds.size === 0) return;

		const selectedIds = Array.from(this.selectedTaskIds);
		const taskCount = selectedIds.length;

		this.isBulkOperating = true;
		try {
			this._announce(`Assigning ${taskCount} tasks...`);
			showToast(
				this,
				"Info",
				`Assigning ${taskCount} task${taskCount > 1 ? "s" : ""}...`,
				"info"
			);

			// Update tasks in parallel
			const updatePromises = selectedIds.map((taskId) =>
				this.assignTask(taskId, userId)
			);

			await Promise.all(updatePromises);

			showToast(
				this,
				"Success",
				`Successfully assigned ${taskCount} task${taskCount > 1 ? "s" : ""}`,
				"success"
			);

			// Clear selection and refresh
			this.handleClearSelection();
			await this.refreshTasks();
		} catch (error) {
			console.error("Bulk assignment error:", error);
			const msg =
				error?.body?.message || error?.message || "Failed to assign tasks";
			showToast(this, "Error", msg, "error");
		} finally {
			this.isBulkOperating = false;
		}
	}

	/**
	 * Helper to assign a single task to a user
	 * @param {String} taskId - Task ID
	 * @param {String} userId - User ID to assign
	 */
	async assignTask(taskId, userId) {
		const payload = {
			Id: taskId,
			TLG_Assigned_To__c: userId,
		};

		return updateTask(payload);
	}

	// ============ Logged Time Helpers ============
	async refreshTimeAggregates() {
		this.isRefreshingTimeAggregates = true;
		try {
			const agg = await getTimeLogAggregates(this.selectedTaskId);
			this.timeAggregates = {
				totalMinutes: agg?.totalMinutes ?? 0,
				totalCompletion: agg?.totalCompletion ?? 0,
				entryCount: agg?.entryCount ?? 0,
			};
		} catch (e) {
			this.timeAggregates = {
				totalMinutes: 0,
				totalCompletion: 0,
				entryCount: 0,
			};
		} finally {
			this.isRefreshingTimeAggregates = false;
		}
	}

	updateRemainingEstimate() {
		try {
			const rec = this.selectedTaskRecord;
			const estHours = rec
				? rec.Total_Estimated_Time__c ?? rec.estimatedHours ?? 0
				: 0;
			const estMinutes = Number.isFinite(estHours)
				? Math.trunc(estHours) * 60
				: 0;
			this.remainingEstimateMinutes = Math.max(
				0,
				estMinutes - (this.timeAggregates.totalMinutes || 0)
			);
		} catch (e) {
			this.remainingEstimateMinutes = 0;
		}
	}

	handleTimeSpentChange(event) {
		const raw = event.detail?.value ?? event.target?.value ?? "";
		const normalized = normalizeDisplay(raw);
		this.logTimeData = { ...this.logTimeData, TLG_Time_Spent__c: normalized };
	}

	handleTimeStep(event) {
		const dir = event.currentTarget?.dataset?.dir;
		const current = this.logTimeData?.TLG_Time_Spent__c ?? "0.00";
		const next = dir === "plus" ? stepPlus15(current) : stepMinus15(current);
		this.logTimeData = { ...this.logTimeData, TLG_Time_Spent__c: next };
	}

	handleLogFieldChange(event) {
		const name = event.target?.name;
		const value = event.detail?.value ?? event.target?.value;
		if (!name) return;
		this.logTimeData = { ...this.logTimeData, [name]: value };
	}

	handleTimerLogTime(event) {
		// Auto-fill time log form with timer data
		const { elapsedHours, formattedTime, taskName } = event.detail;

		// Convert elapsed hours to h.mm format (e.g., 1.5 hours = 1.30)
		const hours = Math.floor(parseFloat(elapsedHours));
		const decimalPart = parseFloat(elapsedHours) - hours;
		const minutes = Math.round(decimalPart * 60);
		const timeSpent = `${hours}.${String(minutes).padStart(2, "0")}`;

		// Auto-fill the time log form
		this.logTimeData = {
			...this.logTimeData,
			TLG_Time_Spent__c: timeSpent,
			TLG_Description__c:
				this.logTimeData.TLG_Description__c || `Work on ${taskName || "task"}`,
			TLG_Date_Record__c: this.logTimeData.TLG_Date_Record__c || getTodayISO(),
		};

		// Show the time log section if it's hidden
		this.showTimeLogSection = true;

		// Show success toast
		showToast(
			this,
			"Success",
			`Time set to ${timeSpent} hours (${formattedTime})`,
			"success"
		);
	}

	validateLogForm() {
		const errs = {};
		const d = this.logTimeData || {};
		if (!d.Completion__c && d.Completion__c !== 0)
			errs.Completion__c = "Completion is required";
		if (!d.TLG_Date_Record__c) errs.TLG_Date_Record__c = "Date is required";
		if (!d.TLG_Description__c || !String(d.TLG_Description__c).trim())
			errs.TLG_Description__c = "Description is required";
		const mins = displayToMinutes(d.TLG_Time_Spent__c);
		if (mins <= 0) errs.TLG_Time_Spent__c = "Time must be greater than 0";
		this.logErrors = errs;
		return Object.keys(errs).length === 0;
	}

	async handleSubmitLogTime() {
		if (!this.selectedTaskId) return;
		if (!this.validateLogForm()) return;

		// Prevent duplicate submissions
		if (this.isSubmittingLogTime) return;

		try {
			this.isSubmittingLogTime = true;

			// Requery aggregates to avoid race conditions
			await this.refreshTimeAggregates();

			const currentPct = parseInt(this.logTimeData.Completion__c, 10) || 0;
			const totalPct = (this.timeAggregates.totalCompletion || 0) + currentPct;
			if (totalPct > MAX_COMPLETION_PERCENT) {
				this.logErrors = {
					...this.logErrors,
					Completion__c: `Total completion cannot exceed ${MAX_COMPLETION_PERCENT}%`,
				};
				return;
			}

			const addMinutes = displayToMinutes(this.logTimeData.TLG_Time_Spent__c);
			const rec = this.selectedTaskRecord;
			const estHours = rec
				? rec.Total_Estimated_Time__c ?? rec.estimatedHours ?? 0
				: 0;
			const estMinutes = Number.isFinite(estHours)
				? Math.trunc(estHours) * 60
				: 0;
			const newRemaining =
				estMinutes - ((this.timeAggregates.totalMinutes || 0) + addMinutes);

			if (newRemaining < 0) {
				// Open Task Delay modal
				await this.prepareDelayPicklists();
				this.delayForm = {
					Subject: "",
					AssignedToName:
						this.getUserNameById(
							rec?.TLG_Assigned_To__c || rec?.assignedToId
						) || "Current User",
					Delay_Origin__c: "",
					Category__c: "",
					Status: "On Hold",
					Delay_Days__c: 0,
					Description: "",
				};
				this.showDelayModal = true;
				return;
			}

			// Normal create
			await this.persistLoggedTime();
		} catch (error) {
			console.error("Error submitting time log:", error);
			const msg =
				error?.body?.message || error?.message || "Failed to submit time log";
			showToast(this, "Error", msg, "error");
		} finally {
			this.isSubmittingLogTime = false;
		}
	}

	async persistLoggedTime(delayPayload = null) {
		const payload = {
			TLG_Task__c: this.selectedTaskId,
			TLG_Time_Spent__c: parseFloat(this.logTimeData.TLG_Time_Spent__c),
			TLG_Date_Record__c: this.logTimeData.TLG_Date_Record__c,
			TLG_Description__c: this.logTimeData.TLG_Description__c,
			Completion__c: parseInt(this.logTimeData.Completion__c, 10) || 0,
		};
		try {
			await createLoggedTimeWithOptionalDelay(payload, delayPayload);
			showToast(this, "Success", "Time logged", "success");
			await this.refreshTimeAggregates();
			this.updateRemainingEstimate();
			// Reset form
			this.logTimeData = {
				Completion__c: "",
				TLG_Date_Record__c: getTodayISO(),
				TLG_Description__c: "",
				TLG_Time_Spent__c: "0.00",
			};
		} catch (e) {
			const msg = e?.body?.message || e?.message || "Failed to log time";
			showToast(this, "Error", msg, "error");
		}
	}

	// ============ Delay Modal (UI API for dependent picklists) ============
	@track _delayRecordTypeId = null;
	@track _objectInfo = null;
	@track delayPicklists = { origins: [], categories: [], dependency: {} };

	// Wire object info to determine record type id for Logged Time
	@wire(getObjectInfo, { objectApiName: TLG_TASKFEED_OBJECT })
	wiredTaskFeedInfo({ data, error }) {
		if (data) {
			this._objectInfo = data;
			const rti = data?.recordTypeInfos || {};
			let rtId = data?.defaultRecordTypeId || null;
			for (const key in rti) {
				const info = rti[key];
				const dn = (info?.developerName || info?.name || "").toLowerCase();
				if (dn.includes("logged") || dn.includes("tlg_logged_time")) {
					rtId = info.recordTypeId;
					break;
				}
			}
			this._delayRecordTypeId = rtId;
		} else if (error) {
			// leave defaults; picklists wire will remain empty
		}
	}

	// Wire picklist values for the resolved record type id
	@wire(getPicklistValuesByRecordType, {
		objectApiName: TLG_TASKFEED_OBJECT,
		recordTypeId: "$_delayRecordTypeId",
	})
	wiredTaskFeedPicklists({ data, error }) {
		if (data) {
			const origins = data?.picklistFieldValues?.Delay_Origin__c?.values || [];
			const categories = data?.picklistFieldValues?.Category__c?.values || [];
			this.delayPicklists = {
				origins,
				categories,
				dependency: { origins, categories },
			};
		} else if (error) {
			this.delayPicklists = { origins: [], categories: [], dependency: {} };
		}
	}

	@api
	prepareDelayPicklists() {
		// No-op: wired handlers above populate delayPicklists based on _delayRecordTypeId
	}

	get filteredDelayCategories() {
		const origin = this.delayForm?.Delay_Origin__c || "";
		const categories = this.delayPicklists?.categories || [];
		if (!origin) return categories;
		// UI API includes validFor; filter entries with matching validFor bits
		const originIndex = (this.delayPicklists.origins || []).findIndex(
			(o) => o.value === origin
		);
		if (originIndex < 0) return categories;
		return categories.filter((c) =>
			Array.isArray(c.validFor) ? c.validFor.includes(originIndex) : true
		);
	}

	handleDelayFieldChange(event) {
		const name = event.target?.name;
		const value = event.detail?.value ?? event.target?.value;
		if (!name) return;
		this.delayForm = { ...this.delayForm, [name]: value };
	}

	closeDelayModal() {
		this.showDelayModal = false;
	}

	async handleDelaySave() {
		// Basic validation
		const d = this.delayForm || {};
		if (
			!d.Subject ||
			!d.Delay_Origin__c ||
			!d.Category__c ||
			!d.Status ||
			d.Delay_Days__c === null ||
			d.Delay_Days__c === undefined ||
			d.Delay_Days__c < 0 ||
			!d.Description
		) {
			showToast(
				this,
				"Error",
				"Please fill all required fields in Task Delay.",
				"error"
			);
			return;
		}
		const delayPayload = {
			Subject: d.Subject,
			Delay_Origin__c: d.Delay_Origin__c,
			Category__c: d.Category__c,
			Status: d.Status,
			Delay_Days__c: d.Delay_Days__c,
			Description: d.Description,
		};
		await this.persistLoggedTime(delayPayload);
		this.showDelayModal = false;
	}

	connectedCallback() {
		// Initialize debounced search functions
		this._debouncedCaseSearchNew = debounce(
			this.performCaseSearchNew.bind(this),
			SEARCH_DEBOUNCE_MS
		);
		this._debouncedCaseSearchEdit = debounce(
			this.performCaseSearchEdit.bind(this),
			SEARCH_DEBOUNCE_MS
		);
		this._debouncedParentSearchNew = debounce(
			this.performParentSearchNew.bind(this),
			SEARCH_DEBOUNCE_MS
		);
		this._debouncedParentSearchEdit = debounce(
			this.performParentSearchEdit.bind(this),
			SEARCH_DEBOUNCE_MS
		);
		this._debouncedMentionSearch = debounce(
			this.performMentionSearch.bind(this),
			SEARCH_DEBOUNCE_MS
		);

		// Keep drawer offset synced with layout
		if (!this._boundUpdateBoardOffset) {
			this._boundUpdateBoardOffset = this.updateBoardOffset.bind(this);
		}
		window.addEventListener("resize", this._boundUpdateBoardOffset);
		// Load initial board data
		if (!this.disableAutoInit) {
			this.loadInitialData().catch((error) => {
				console.error("Unhandled error in loadInitialData:", error);
				// Error is already handled in loadInitialData() but this prevents unhandled promise rejection
			});
		}

		// Add click outside listener for settings menu
		if (!this._boundHandleDocumentClick) {
			this._boundHandleDocumentClick = this.handleDocumentClick.bind(this);
		}
		document.addEventListener("click", this._boundHandleDocumentClick);

	// Initialize theme from localStorage or system preference
	try {
		const stored = getStorageItem("kanbanTheme");
		if (stored === "dark") {
			this.isDarkMode = true;
		} else if (stored === "light") {
			this.isDarkMode = false;
		} else {
			// Fallback to system preference
			const prefersDark =
				window.matchMedia &&
				window.matchMedia("(prefers-color-scheme: dark)").matches;
			this.isDarkMode = !!prefersDark;
		}
		const compact = getStorageItem("kanbanCompactView");
		this.isCompactView = compact === "true";

		// Load virtual scrolling preference (default true)
		const vsPref = getStorageItem("kanbanVirtualScroll");
		if (vsPref === "true") {
			this.enableVirtualScroll = true;
		} else if (vsPref === "false") {
			this.enableVirtualScroll = false;
		} // else leave default
	} catch (e) {
		// Fallback to system defaults if preferences can't be loaded
		console.warn("Could not load user preferences from storage:", e);
	}		// UX-002: Keyboard shortcuts for undo/redo
		if (!this._boundHandleKeyDown) {
			this._boundHandleKeyDown = this.handleKeyDown.bind(this);
		}
		window.addEventListener("keydown", this._boundHandleKeyDown);

		// UX-011: Dashboard chart filter events
		if (!this._boundHandleChartFilter) {
			this._boundHandleChartFilter = this.handleChartFilter.bind(this);
		}
		this.template.addEventListener("chartfilter", this._boundHandleChartFilter);

		// PERF-001: Virtual scroll listeners
		if (!this._boundHandleWindowScroll) {
			this._boundHandleWindowScroll = this.handleWindowScroll.bind(this);
		}
		if (!this._boundHandleWindowResize) {
			this._boundHandleWindowResize = this.handleWindowResize.bind(this);
		}
		window.addEventListener("scroll", this._boundHandleWindowScroll, {
			passive: true,
		});
		window.addEventListener("resize", this._boundHandleWindowResize);
	}

	disconnectedCallback() {
		// Clean up event listeners
		if (this._boundUpdateBoardOffset) {
			window.removeEventListener("resize", this._boundUpdateBoardOffset);
			this._boundUpdateBoardOffset = null;
		}
		if (this._boundHandleDocumentClick) {
			document.removeEventListener("click", this._boundHandleDocumentClick);
			this._boundHandleDocumentClick = null;
		}

		// Remove keyboard listener
		if (this._boundHandleKeyDown) {
			window.removeEventListener("keydown", this._boundHandleKeyDown);
			this._boundHandleKeyDown = null;
		}

		// UX-011: Remove chart filter listener
		if (this._boundHandleChartFilter) {
			this.template.removeEventListener(
				"chartfilter",
				this._boundHandleChartFilter
			);
			this._boundHandleChartFilter = null;
		}

		// PERF-001: Remove virtual scroll listeners
		if (this._boundHandleWindowScroll) {
			window.removeEventListener("scroll", this._boundHandleWindowScroll);
			this._boundHandleWindowScroll = null;
		}
		if (this._boundHandleWindowResize) {
			window.removeEventListener("resize", this._boundHandleWindowResize);
			this._boundHandleWindowResize = null;
		}

		// Cancel pending debounced calls to prevent memory leaks
		if (this._debouncedCaseSearchNew?.cancel) {
			this._debouncedCaseSearchNew.cancel();
		}
		if (this._debouncedCaseSearchEdit?.cancel) {
			this._debouncedCaseSearchEdit.cancel();
		}
		if (this._debouncedParentSearchNew?.cancel) {
			this._debouncedParentSearchNew.cancel();
		}
		if (this._debouncedParentSearchEdit?.cancel) {
			this._debouncedParentSearchEdit.cancel();
		}
		if (this._debouncedMentionSearch?.cancel) {
			this._debouncedMentionSearch.cancel();
		}

		// Clear debounced function references
		this._debouncedCaseSearchNew = null;
		this._debouncedCaseSearchEdit = null;
		this._debouncedParentSearchNew = null;
		this._debouncedParentSearchEdit = null;
		this._debouncedMentionSearch = null;

		// Clear large data arrays to free memory
		this._originalTasks = null;
		this._allTasks = [];
		this._rawTasksData = [];
		this._columns = [];
		this._projects = [];
		this.users = [];
		this.comments = [];

		// Clear filter and search results
		this.caseResultsNew = [];
		this.caseResultsEdit = [];
		this.parentTaskResultsNew = [];
		this.parentTaskResultsEdit = [];
		this.mentionResults = [];
		this.teamOptions = [];
		this.assignableUsersOptions = [];
		this.projectOptions = [];

		// Clear column collapse tracking
		this.collapsedColumns.clear();
		this.manuallyCollapsedColumns.clear();
		this.manuallyExpandedColumns.clear();

		// Clear bulk selection
		this.selectedTaskIds.clear();
		this._lastClickedTaskId = null;

		// Stop comment polling and clear interval
		this.stopCommentPolling();
	}

	// =====================
	// DEBOUNCED SEARCH IMPLEMENTATIONS
	// =====================
	async performCaseSearchNew(text) {
		try {
			this.isSearchingCaseNew = true;
			this.caseResultsNew = [];
			if (!text || text.trim().length < 2) {
				this.showCaseResultsNew = false;
				return;
			}
			const projectId = this.newTaskData?.TLG_Opportunity__c || null;
			const results = await searchCases(text.trim(), projectId);
			this.caseResultsNew = (results || [])
				.slice(0, SEARCH_MAX_RESULTS)
				.map((c) => ({
					label: `${c.Subject}`,
					value: c.Id,
				}));
			this.showCaseResultsNew = this.caseResultsNew.length > 0;
		} catch (e) {
			this.showCaseResultsNew = false;
			this.caseResultsNew = [];
		} finally {
			this.isSearchingCaseNew = false;
		}
	}

	async performCaseSearchEdit(text) {
		try {
			this.isSearchingCaseEdit = true;
			this.caseResultsEdit = [];
			if (!text || text.trim().length < 2) {
				this.showCaseResultsEdit = false;
				return;
			}
			const projectId = this.editTaskData?.TLG_Opportunity__c || null;
			const results = await searchCases(text.trim(), projectId);
			this.caseResultsEdit = (results || [])
				.slice(0, SEARCH_MAX_RESULTS)
				.map((c) => ({
					label: `${c.Subject}`,
					value: c.Id,
				}));
			this.showCaseResultsEdit = this.caseResultsEdit.length > 0;
		} catch (e) {
			this.showCaseResultsEdit = false;
			this.caseResultsEdit = [];
		} finally {
			this.isSearchingCaseEdit = false;
		}
	}

	async performParentSearchNew(text) {
		try {
			this.isSearchingParentNew = true;
			this.parentTaskResultsNew = [];
			if (!text || text.trim().length < 2) {
				this.showParentResultsNew = false;
				return;
			}
			const params = {
				searchTerm: text.trim(),
				limitCount: SEARCH_MAX_RESULTS,
			};
			const records = await getTasks(params);
			this.parentTaskResultsNew = (records || []).map((t) => ({
				label: t.Name,
				value: t.Id,
			}));
			this.showParentResultsNew = this.parentTaskResultsNew.length > 0;
		} catch (e) {
			this.showParentResultsNew = false;
			this.parentTaskResultsNew = [];
		} finally {
			this.isSearchingParentNew = false;
		}
	}

	async performParentSearchEdit(text) {
		try {
			this.isSearchingParentEdit = true;
			this.parentTaskResultsEdit = [];
			if (!text || text.trim().length < 2) {
				this.showParentResultsEdit = false;
				return;
			}
			const params = {
				searchTerm: text.trim(),
				limitCount: SEARCH_MAX_RESULTS,
			};
			const records = await getTasks(params);
			const currentId = this.selectedTaskId;
			this.parentTaskResultsEdit = (records || [])
				.filter((t) => t.Id !== currentId)
				.map((t) => ({ label: t.Name, value: t.Id }));
			this.showParentResultsEdit = this.parentTaskResultsEdit.length > 0;
		} catch (e) {
			this.showParentResultsEdit = false;
			this.parentTaskResultsEdit = [];
		} finally {
			this.isSearchingParentEdit = false;
		}
	}

	async performMentionSearch(text) {
		try {
			this.mentionResults = [];
			if (!text || text.trim().length < 2) {
				return;
			}
			this.isSearchingMentions = true;
			const [internalUsers, portalUsers] = await Promise.all([
				searchInternalUsersForTagging(text.trim()),
				searchPortalUsersForTagging(text.trim(), null),
			]);
			const merged = [...(internalUsers || []), ...(portalUsers || [])];
			// Unique by Id
			const seen = new Set();
			const results = [];
			merged.forEach((u) => {
				const id = u.Id || u.id;
				if (!id || seen.has(id)) return;
				seen.add(id);
				results.push({
					userId: id,
					name: u.Name || u.name,
					username: u.Username || u.username,
				});
			});
			this.mentionResults = results.slice(0, 10);
		} catch (e) {
			// silent fail
		} finally {
			this.isSearchingMentions = false;
		}
	}

	// Handle sidebar navigation clicks
	handleNavClick(event) {
		const key = event.currentTarget?.dataset?.key;
		if (!key) return;
		this.selectedNav = key;

		// Navigate to the selected view
		if (key === "dashboard") {
			// Dashboard view with timeline
		} else if (key === "tasks") {
			// Task management view (coming soon)
			showToast(
				this,
				"Info",
				"Task management section is coming soon.",
				"info"
			);
		} else if (key === "kanban") {
			// Kanban board view
		}
	}

	renderedCallback() {
		// Apply collapsed styling after render
		this.updateColumnClasses();
		// Apply dashboard dynamic styles when visible
		this.updateDashboardStyles();
		// Update drawer top offset relative to board
		this.updateBoardOffset();
	}

	updateBoardOffset() {
		try {
			// Prefer board container; fallback to header
			const board = this.template.querySelector(".kanban-board-container");
			const header = this.template.querySelector(".kanban-view-header");
			const rect = (board || header)?.getBoundingClientRect();
			const offset = rect ? Math.max(rect.top, 0) : 0;
			this.template.host.style.setProperty(
				"--board-top-offset",
				`${Math.round(offset)}px`
			);
			// Apply desired drawer max height globally for this component
			this.template.host.style.setProperty("--drawer-max-height", "50vh");
		} catch (e) {
			// No-op on errors
		}
	}

	handleDocumentClick(event) {
		// Close settings menu if clicked outside
		if (this.showSettingsMenu) {
			const settingsContainer = this.template.querySelector(
				".settings-dropdown-container"
			);
			if (settingsContainer && !settingsContainer.contains(event.target)) {
				this.showSettingsMenu = false;
			}
		}
	}

	// =====================
	// DASHBOARD COMPUTATIONS
	// =====================

	get dashboardStats() {
		const tasks = this._originalTasks || this._allTasks || [];
		const total = tasks.length;
		const inProgress = tasks.filter((t) =>
			statusEquals(t.status, "In Progress")
		).length;
		const completed = tasks.filter(
			(t) =>
				statusEquals(t.status, "Completed") || statusEquals(t.status, "Done")
		).length;

		// My tasks: compare against selectedAssignedToId if set, else current user from server (loaded earlier)
		const myId =
			this.selectedAssignedToId ||
			(this.currentUser && this.currentUser.Id) ||
			null;
		const mine = myId ? tasks.filter((t) => t.assignedToId === myId).length : 0;

		return { total, inProgress, completed, mine };
	}

	get statusDistribution() {
		const tasks = this._originalTasks || this._allTasks || [];
		if (!tasks.length) return [];
		const byStatus = new Map();
		tasks.forEach((t) => {
			const key = t.status || "Unknown";
			byStatus.set(key, (byStatus.get(key) || 0) + 1);
		});

		const total = tasks.length;
		const palette = [
			"#60a5fa",
			"#f59e0b",
			"#34d399",
			"#f87171",
			"#a78bfa",
			"#fbbf24",
			"#22d3ee",
		];
		let i = 0;
		const segments = [];
		for (const [label, count] of byStatus.entries()) {
			const pct = Math.round((count / total) * 100);
			const color = palette[i % palette.length];
			i++;
			segments.push({
				label,
				count,
				pct,
				title: `${label}: ${count} (${pct}%)`,
				color,
			});
		}
		// Sort segments by count desc for better legend readability
		segments.sort((a, b) => b.count - a.count);
		return segments;
	}

	updateDashboardStyles() {
		if (!this.isDashboardView) return;
		// Update status segments width and color from data attributes
		const segEls = this.template.querySelectorAll(".status-segment");
		segEls.forEach((el) => {
			const pct = parseInt(el.dataset.pct, 10);
			const color = el.dataset.color || "#d1d5db";
			const width = Number.isFinite(pct) ? Math.max(pct, 1) + "%" : "0%";
			el.style.width = width;
			el.style.background = color;
		});

		// Update legend swatches
		const swatches = this.template.querySelectorAll(".legend-swatch");
		swatches.forEach((el) => {
			const color = el.dataset.color || "#d1d5db";
			el.style.background = color;
		});
	}

	async loadInitialData() {
		try {
			await this.loadUserPreferences();
			await this.loadDynamicColors();
			await this.loadBoardData();
		} catch (error) {
			this.isLoading = false;
			this.error = error;

			// Log error details for debugging
			console.error("Error loading initial data:", error);
			if (error?.body) {
				console.error("Error body:", JSON.stringify(error.body, null, 2));
			}

			// Extract message
			let message = "Unknown error occurred";
			try {
				if (error?.body?.message) {
					message = error.body.message;
				} else if (error?.message) {
					message = error.message;
				} else if (typeof error === "string") {
					message = error;
				}
			} catch (e) {
				console.error("Error extracting message:", e);
			}

			showToast(this, "Error", `Failed to load board: ${message}`, "error");
		}
	}

	/**
	 * Safe wrapper for loadInitialData() to prevent unhandled promise rejections
	 * Use this in event handlers where async/await is not appropriate
	 */
	safeLoadInitialData() {
		this.loadInitialData().catch((error) => {
			console.error("Error in safeLoadInitialData:", error);
			// Error already handled in loadInitialData()
		});
	}

	async loadUserPreferences() {
		try {
			const collapsedColumnsString = await getUserPreferences();
			if (collapsedColumnsString) {
				// Convert comma-separated string back to Set
				const collapsedArray = collapsedColumnsString
					.split(",")
					.filter((s) => s.trim());
				this.collapsedColumns = new Set(collapsedArray);
			}
		} catch (error) {
			console.error("Error loading user preferences:", error);
			// Continue with empty collapsed set if error
			this.collapsedColumns = new Set();
		}
	}

	async loadDynamicColors() {
		try {
			const colorConfigs = await getStatusColors();
			this.maxExpandedColumnsSetting =
				this.extractMaxExpandedColumns(colorConfigs);

			if (colorConfigs && colorConfigs.length > 0) {
				// Apply dynamic colors via CSS custom properties
				this.applyDynamicColors(colorConfigs);
			}
		} catch (error) {
			console.error("Error loading dynamic colors:", error);
			// Continue with default CSS colors if error
		}
	}

	applyDynamicColors(colorConfigs) {
		// Create dynamic CSS rules and inject them
		const styleElement = document.createElement("style");
		styleElement.id = "kanban-dynamic-colors";

		// Remove existing dynamic styles if present
		const existing = this.template.querySelector("#kanban-dynamic-colors");
		if (existing) {
			existing.remove();
		}

		let cssRules = "";

		colorConfigs.forEach((config) => {
			const statusName = config.statusName;
			const colorCode = config.colorCode;
			const gradientStart = config.collapsedColorStart;
			const gradientEnd = config.collapsedColorEnd;

			// Add CSS rule for column header
			cssRules += `
                .kanban-column[data-status="${statusName}"] .column-header {
                    background: linear-gradient(180deg, ${colorCode}, ${this.adjustColor(
				colorCode,
				-10
			)});
                    border-bottom: 2px solid ${this.adjustColor(
											colorCode,
											-20
										)};
                }
            `;

			// Add CSS rule for collapsed column
			cssRules += `
                .kanban-column.collapsed[data-status="${statusName}"] {
                    background: linear-gradient(180deg, ${gradientStart}, ${gradientEnd});
                    color: white;
                }
            `;
		});

		styleElement.textContent = cssRules;

		// Append to component's shadow DOM
		// Prefer a stable container in this component; fallback to the first root element
		const container =
			this.template.querySelector(".main-content") ||
			this.template.querySelector(".kanban-root") ||
			this.template.firstChild;
		if (container && typeof container.appendChild === "function") {
			container.appendChild(styleElement);
		} else {
			// As a last resort, append to template (some engines allow this)
			try {
				this.template.appendChild(styleElement);
			} catch (e) {
				// noop - dynamic colors are non-blocking
			}
		}
	}

	// Helper function to adjust color brightness
	adjustColor(color, percent) {
		// Convert hex to RGB
		const num = parseInt(color.replace("#", ""), HEX_COLOR_BASE);
		const r = Math.max(
			0,
			Math.min(COLOR_MAX_VALUE, ((num >> COLOR_BIT_SHIFT_RED) & 0xff) + percent)
		);
		const g = Math.max(
			0,
			Math.min(
				COLOR_MAX_VALUE,
				((num >> COLOR_BIT_SHIFT_GREEN) & 0xff) + percent
			)
		);
		const b = Math.max(0, Math.min(COLOR_MAX_VALUE, (num & 0xff) + percent));

		// Convert back to hex
		return (
			"#" +
			((r << COLOR_BIT_SHIFT_RED) | (g << COLOR_BIT_SHIFT_GREEN) | b)
				.toString(HEX_COLOR_BASE)
				.padStart(HEX_COLOR_PAD_LENGTH, "0")
		);
	}

	extractMaxExpandedColumns(colorConfigs) {
		if (!Array.isArray(colorConfigs) || colorConfigs.length === 0) {
			return null;
		}

		for (const config of colorConfigs) {
			if (
				config &&
				config.maxExpandedColumns !== undefined &&
				config.maxExpandedColumns !== null
			) {
				const parsed = parseInt(config.maxExpandedColumns, 10);
				if (!Number.isNaN(parsed)) {
					return parsed;
				}
			}
		}

		return null;
	}

	async loadBoardData() {
		this.isLoading = true;
		this.error = null;
		this.autoCollapseNoticeShown = false;

		try {
			// Get current user context once for defaulting behavior
			const userContext = await this.resolveCurrentUserContext();
			const currentUserId = userContext.userId;
			const isPortalUser = userContext.isPortalUser;
			this.currentUser = currentUserId
				? {
						Id: currentUserId,
						userType: userContext.userType,
						isPortal: isPortalUser,
				  }
				: null;
			this.isPortalUser = isPortalUser;

			// Build server query params based on filters with sensible defaults:
			// - Default to current user's tasks when no project is selected and no explicit assignee is chosen
			// - When a project is selected and the user didn't explicitly set assignee, show all tickets for that project
			const taskParams = {};

			const hasProject = !!(
				this.selectedProjectId && this.selectedProjectId !== ""
			);
			const hasExplicitAssignee = !!(
				this.selectedAssignedToId && this.selectedAssignedToId !== ""
			);

			if (hasProject) {
				taskParams.projectId = this.selectedProjectId;
				if (this.userAdjustedAssignedTo && hasExplicitAssignee) {
					taskParams.assigneeId = this.selectedAssignedToId;
				}
				// else: omit assigneeId to fetch all tickets for the project
			} else {
				// No project selected: default to current user's tasks unless user explicitly picked someone else
				if (this.userAdjustedAssignedTo && hasExplicitAssignee) {
					taskParams.assigneeId = this.selectedAssignedToId;
				} else if (isPortalUser && currentUserId) {
					taskParams.assigneeId = currentUserId;
				}
			}

			let tasksData;
			try {
				tasksData = await getTasks(taskParams);
			} catch (error) {
				this.handleLoadFailure("tasks", error);
				return;
			}

			let usersData;
			try {
				usersData = await getAssignableUsers();
			} catch (error) {
				this.handleLoadFailure("assignable users", error);
				return;
			}

			let projectsData;
			try {
				projectsData = await getProjects();
			} catch (error) {
				this.handleLoadFailure("projects", error);
				return;
			}

			// Handle data safely with fallbacks
			this._projects = (projectsData || []).map((p) => ({
				id: p.Id,
				name: p.Name,
			}));
			this.projectOptions = [
				{ label: "All Projects", value: "" },
				...this._projects.map((p) => ({
					label: p.name,
					value: p.id,
				})),
			];
			this.users = usersData || [];
			// Map UserOption DTO (id/name) returned by Apex to combobox options
			// Include an "All Users" option to allow clearing the assignee filter
			this.assignableUsersOptions = [
				{ label: "All Users", value: "" },
				...this.users.map((u) => ({
					label: u.name ?? u.Name,
					value: u.id ?? u.Id,
				})),
			];

			// Do not force-select current user in the combobox; keep the control free so
			// selecting a project can show all tickets unless the user sets assignee explicitly.
			// We still default the server query to current user when no project is selected (above).

			// Get team from tasks and load team-specific statuses
			const safeTasksData = tasksData || [];
			const localColumns = await this.createDefaultStatusColumns(); // Use default key statuses
			this.processAndSetData(localColumns, safeTasksData);

			// Build team options from task dataset (unique team IDs)
			this.updateTeamOptions();
		} finally {
			this.isLoading = false;
		}
	}

	handleLoadFailure(step, error) {
		const message = error?.body?.message || error?.message || "Unknown error";
		this.error = error;
		console.error(`Kanban board failed while loading ${step}:`, error);
		showToast(this, "Error", `Failed to load ${step}: ${message}`, "error");

		try {
			const defaultColumns = this.createDefaultStatusColumns();
			this.processAndSetData(defaultColumns, []);
		} catch (fallbackError) {
			console.error("Fallback column rendering failed:", fallbackError);
		}
	}

	async resolveCurrentUserContext() {
		let context = {};
		try {
			const raw = await getCurrentUserContext();
			if (raw && typeof raw === "object") {
				context = raw;
			}
		} catch (error) {
			// Do not block board load when context call fails; fall back to legacy method
			console.warn("Unable to load current user context via Apex:", error);
		}

		let userId = context.userId || context.UserId || context.id || "";
		let userType = context.userType || context.UserType || "";
		if (userType && typeof userType !== "string") {
			userType = String(userType);
		}
		let isPortalUser = context.isPortalUser;

		if (!userId) {
			try {
				const fallbackId = await getCurrentUserId();
				userId = fallbackId || "";
			} catch (error) {
				console.error("Error getting current user ID fallback:", error);
				userId = "";
			}
		}

		if (
			!userType &&
			context.userType === undefined &&
			context.UserType === undefined
		) {
			// Derive user type heuristically from known prefixes (15-char vs 18-char) if possible
			// but keep as empty string when unknown to avoid misleading value
			userType = "";
		}

		if (isPortalUser === undefined || isPortalUser === null) {
			const typeForEval = userType ? userType.toLowerCase() : "";
			if (typeForEval) {
				isPortalUser =
					typeForEval.includes("portal") ||
					typeForEval.includes("community") ||
					typeForEval.includes("network") ||
					typeForEval.includes("customer") ||
					typeForEval.includes("partner") ||
					typeForEval.includes("guest");
			} else {
				isPortalUser = false;
			}
		}

		return {
			userId: userId || "",
			userType: userType || "",
			isPortalUser: !!isPortalUser,
		};
	}

	createDefaultStatusColumns() {
		// Show only key statuses by default (must exist in picklist)
		const keyStatuses = [
			"Not Started",
			"In Progress",
			"Ready for Review",
			"Waiting on Client",
			"On hold",
			"Completed",
			"Closed",
		];

		return keyStatuses.map((statusName, index) =>
			this.createColumnConfig(statusName, index, "default")
		);
	}

	async createTeamBasedColumns(tasksData) {
		try {
			// Get team ID from tasks
			const taskIds = tasksData.map((task) => task.Id);

			if (taskIds.length === 0) {
				return this.createDefaultColumns();
			}

			// Try to get team ID from tasks
			let teamId;
			try {
				teamId = await getTeamFromTasks(taskIds);
			} catch (teamError) {
				teamId = null;
			}

			if (teamId) {
				try {
					// Get team-specific statuses ordered by sequence
					const teamStatuses = await getTeamStatuses(teamId);

					if (teamStatuses && teamStatuses.length > 0) {
						// Client-side guard: filter out statuses not present in task picklist
						const filtered = teamStatuses.filter((s) =>
							isValidStatus(normalizeStatusValue(s.Name))
						);

						if (filtered.length === 0) {
							showToast(
								this,
								"Warning",
								"Team has custom statuses, but none match the Task picklist. Falling back to defaults.",
								"warning"
							);
							return this.createDefaultColumns();
						}

						return filtered.map((status, index) => {
							const displayLabel = status.TLG_Display_Label__c || status.Name;
							return this.createColumnConfig(
								status.Name, // Original status value for data matching
								index,
								"team",
								status.TLG_Order_Number__c,
								displayLabel // Custom display label for UI
							);
						});
					} else {
						showToast(
							this,
							"Info",
							"Team found but no custom statuses configured. Using default columns.",
							"info"
						);
					}
				} catch (statusError) {
					showToast(
						this,
						"Warning",
						"Error loading team statuses: " +
							(statusError.body?.message || statusError.message),
						"warning"
					);
				}
			}

			// Fallback to default statuses
			return this.createDefaultColumns();
		} catch (error) {
			showToast(
				this,
				"Error",
				"Error loading columns: " + (error.body?.message || error.message),
				"error"
			);
			return this.createDefaultColumns();
		}
	}

	createDefaultColumns() {
		const defaultStatuses = KanbanDataService.VALID_STATUSES;
		return defaultStatuses.map((statusName, index) =>
			this.createColumnConfig(statusName, index, "default")
		);
	}

	// Removed normalizeStatusValue - now using shared utility from c/statusHelper

	createColumnConfig(
		statusName,
		index,
		prefix = "column",
		orderNumber = null,
		displayLabel = null
	) {
		const normalizedName = normalizeStatusValue(statusName);
		const displayTitle = displayLabel || normalizedName;
		const shortTitle = this.getShortLabel(displayTitle);
		const slug =
			normalizedName
				.toLowerCase()
				.replace(/[^a-z0-9]+/g, "-")
				.replace(/^-+|-+$/g, "") || `status-${index}`;

		const columnId = `${prefix}-${slug}-${index}`;
		const isCollapsed = this.collapsedColumns.has(columnId);

		return {
			id: columnId,
			title: displayTitle, // Use custom display label for UI
			shortTitle: shortTitle, // Short label for collapsed view
			statusValue: normalizedName, // Keep original status for data matching
			cards: [],
			cardCount: 0,
			orderNumber: orderNumber || index,
			hasCards: false,
			isCollapsed: isCollapsed, // Check if column is collapsed
			ariaExpanded: String(!isCollapsed), // ARIA expanded state
			columnTitleId: `column-title-${index}`,
			columnAriaLabel: `${displayTitle} column with 0 tasks`,
			tooltipTitle: `${displayTitle} • 0`,
			combinedClasses: `kanban-column ${isCollapsed ? "collapsed" : ""}`.trim(),
			toggleTitle: isCollapsed
				? `Expand ${displayTitle}`
				: `Collapse ${displayTitle}`,
		};
	}

	getShortLabel(label) {
		if (!label) return "";
		const map = new Map([
			["Not Started", "Todo"],
			["In Progress", "Doing"],
			["Ready for Review", "Review"],
			["Waiting on Client", "Waiting"],
			["On hold", "Hold"],
			["Completed", "Done"],
			["Closed", "Closed"],
			["Cancelled", "Cancelled"],
			["Pending", "Pending"],
			["QA", "QA"],
		]);
		const direct = map.get(label);
		if (direct) return direct;
		// Fallback: if label is long, truncate sensibly
		if (label.length > 16) {
			return label.slice(0, 14) + "…";
		}
		return label;
	}

	processAndSetData(columnsData, tasksData) {
		// Store raw task data for filtering operations
		this._rawTasksData = tasksData || [];

		const columnsMap = new Map();
		columnsData.forEach((col) => {
			const mapKey = normalizeStatusKey(col.statusValue);
			columnsMap.set(mapKey, { ...col, cards: [] });
		});

		const cards = tasksData.map((task) => this.mapSalesforceTaskToCard(task));

		// Initialize task collections for filtering
		this._allTasks = [...cards];
		if (!this._originalTasks) {
			// Only set original tasks on first load, preserve them across refreshes
			this._originalTasks = [...cards];
		}

		// Keep team options fresh when new data arrives
		this.updateTeamOptions();

		const nextIndexStart = columnsMap.size;
		const dynamicStatuses = [];
		const dynamicStatusSet = new Set();
		cards.forEach((card) => {
			const statusKey = normalizeStatusValue(card.status);
			const mapKey = normalizeStatusKey(card.status);
			if (!columnsMap.has(mapKey) && !dynamicStatusSet.has(mapKey)) {
				dynamicStatusSet.add(mapKey);
				dynamicStatuses.push(statusKey);
			}
		});

		dynamicStatuses.sort().forEach((statusName, offset) => {
			const column = this.createColumnConfig(
				statusName,
				nextIndexStart + offset,
				"dynamic"
			);
			const mapKey = normalizeStatusKey(column.statusValue);
			columnsMap.set(mapKey, column);
		});

		cards.forEach((card) => {
			const statusKey = normalizeStatusKey(card.status);
			const targetColumn = columnsMap.get(statusKey);
			if (targetColumn) {
				targetColumn.cards.push(card);
			}
		});

		// Convert to array and sort by order number for proper sequence
		this._columns = Array.from(columnsMap.values()).sort((a, b) => {
			// Primary sort: by order number (team statuses have proper order, others use index)
			if (a.orderNumber !== b.orderNumber) {
				return (a.orderNumber || 0) - (b.orderNumber || 0);
			}
			// Secondary sort: by title for consistent ordering when order numbers are equal
			return a.title.localeCompare(b.title);
		});

		this.enforceAutoCollapseLimit({ showToastIfCollapsed: true });

		this._columns.forEach((col) => this.updateColumnCounts(col));
	}

	updateTeamOptions() {
		try {
			const tasks = this._originalTasks || this._allTasks || [];
			const teamMap = new Map(); // id -> name
			tasks.forEach((t) => {
				if (t.teamId) {
					const label =
						t.teamName && t.teamName.trim().length > 0
							? t.teamName
							: `Team ${String(t.teamId).slice(-4)}`;
					if (!teamMap.has(t.teamId)) {
						teamMap.set(t.teamId, label);
					}
				}
			});

			const dynamicOptions = Array.from(teamMap.entries())
				.map(([value, label]) => ({ value, label }))
				.sort((a, b) => a.label.localeCompare(b.label));

			// Always include 'All Teams'
			this.teamOptions = [{ label: "All Teams", value: "" }, ...dynamicOptions];
		} catch (e) {
			// If anything goes wrong, keep a safe default
			this.teamOptions = [{ label: "All Teams", value: "" }];
		}
	}

	/**
	 * Re-organize tasks into columns based on current _allTasks collection
	 * Used after filtering to redistribute visible tasks without reloading from server
	 */
	organizeTasksByStatus() {
		// Clear all cards from existing columns
		this._columns.forEach((col) => {
			col.cards = [];
		});

		// Get current column map for efficient lookup
		const columnsMap = new Map();
		this._columns.forEach((col) => {
			const mapKey = normalizeStatusKey(col.statusValue);
			columnsMap.set(mapKey, col);
		});

		// Distribute current tasks into columns
		const dynamicColumns = [];
		this._allTasks.forEach((card) => {
			const statusKey = normalizeStatusKey(card.status);
			let targetColumn = columnsMap.get(statusKey);

			// If column doesn't exist for this status, create it dynamically
			if (!targetColumn) {
				const nextIndex = this._columns.length + dynamicColumns.length;
				targetColumn = this.createColumnConfig(
					card.status,
					nextIndex,
					"dynamic"
				);
				const mapKey = normalizeStatusKey(targetColumn.statusValue);
				columnsMap.set(mapKey, targetColumn);
				dynamicColumns.push(targetColumn);
			}

			targetColumn.cards.push(card);
		});

		// Add any new dynamic columns
		if (dynamicColumns.length > 0) {
			this._columns = [...this._columns, ...dynamicColumns];
		}

		this.enforceAutoCollapseLimit();

		// Update counts and reactivity
		this._columns.forEach((col) => this.updateColumnCounts(col));

		// Force reactivity by creating new array reference
		this._columns = [...this._columns];
	}

	updateColumnCounts(column) {
		if (column) {
			column.cardCount = column.cards.length;
			column.hasCards = column.cards.length > 0;
			const plural = column.cardCount === 1 ? "task" : "tasks";
			column.columnAriaLabel = `${column.title} column with ${column.cardCount} ${plural}`;
			column.tooltipTitle = `${column.title} • ${column.cardCount}`;
			// Update display classes and toggle title based on current state
			column.combinedClasses = `kanban-column ${
				column.isCollapsed ? "collapsed" : ""
			}`.trim();
			column.toggleTitle = column.isCollapsed
				? `Expand ${column.title}`
				: `Collapse ${column.title}`;
		}
	}

	mapSalesforceTaskToCard(task) {
		const statusValue = normalizeStatusValue(
			task.TLG_Status__c || "Not Started"
		);

		return {
			Id: task.Id,
			Name: task.Name,
			title: task.Name,
			description: task.TLG_Shared_Notes__c || "",
			dueDate: task.TLG_Due_Date__c
				? formatDateISO(task.TLG_Due_Date__c)
				: null,
			priority: task.TLG_Priority__c || "Medium",
			status: statusValue,
			sortOrder: task.TLG_Kanban_Sort_Order__c,
			// Additional fields for edit mapping
			estimatedHours: task.Total_Estimated_Time__c,
			progress: task.Progress__c,
			category: task.TLG_Category__c,

			// Project/Opportunity fields
			projectId: task.TLG_Opportunity__c,
			projectName: this.getProjectNameById(task.TLG_Opportunity__c),

			// Team and assignment fields for filtering
			teamId: task.TLG_Team__c,
			teamName:
				(task.TLG_Team__r &&
					(task.TLG_Team__r.Name || task.TLG_Team__r.name)) ||
				"",
			assignedToId: task.TLG_Assigned_To__c,

			// Date fields for filtering
			createdDate: task.CreatedDate,
			lastModifiedDate: task.LastModifiedDate,

			// Additional metadata
			assignees: [],
			comments: [],
			attachments: [],
		};
	}

	// Resolve display helpers for selected task
	get selectedTaskRecord() {
		if (!this.selectedTaskId) return null;
		// Prefer raw Salesforce record for full field access
		const raw = (this._rawTasksData || []).find(
			(t) => t.Id === this.selectedTaskId
		);
		if (raw) return raw;
		// Fallback to mapped card data
		for (const column of this._columns) {
			const found = column.cards.find((c) => c.Id === this.selectedTaskId);
			if (found) return found;
		}
		return null;
	}

	get selectedTaskTitle() {
		const rec = this.selectedTaskRecord;
		return rec ? rec.Name || rec.title || "Task Details" : "Task Details";
	}

	get selectedTaskDetails() {
		const rec = this.selectedTaskRecord;
		if (!rec) return null;

		// Support both raw record fields and mapped card fields
		const projectId = rec.TLG_Opportunity__c || rec.projectId || null;
		const assignedToId = rec.TLG_Assigned_To__c || rec.assignedToId || null;
		const due = rec.TLG_Due_Date__c || rec.dueDate || null;
		const dueDate = due ? formatDateISO(due) : null;

		return {
			id: rec.Id,
			name: rec.Name || rec.title || "",
			status: rec.TLG_Status__c || rec.status || "",
			priority: rec.TLG_Priority__c || rec.priority || "",
			projectId,
			projectName: this.getProjectNameById(projectId),
			assignedToId,
			assignedToName: this.getUserNameById(assignedToId),
			dueDate,
			estimatedHours: rec.Total_Estimated_Time__c ?? null,
			progress: rec.Progress__c ?? null,
			category: rec.TLG_Category__c || "",
			notes: rec.TLG_Shared_Notes__c || rec.description || "",
		};
	}

	getUserNameById(userId) {
		if (!userId) return "";
		const u = (this.users || []).find((x) => (x.id ?? x.Id) === userId);
		return u ? u.name ?? u.Name ?? "" : "";
	}

	getProjectNameById(projectId) {
		if (!projectId) return "";
		const project = this._projects.find((p) => p.id === projectId);
		return project ? project.name : "";
	}

	handleOpenNewTaskDrawer() {
		// Open in-component drawer and also emit event for external listeners
		this.showNewTaskDrawer = true;
		this.newCaseSearchText = "";
		this.caseResultsNew = [];
		this.showCaseResultsNew = false;
		this.newParentSearchText = "";
		this.parentTaskResultsNew = [];
		this.showParentResultsNew = false;
		this.dispatchEvent(
			new CustomEvent("taskcreate", {
				detail: {},
				bubbles: true,
				composed: true,
			})
		);
	}

	handleCloseNewTaskDrawer() {
		this.showNewTaskDrawer = false;
	}

	async handleNewTaskFieldChange(event) {
		const name = event.target.name;
		const value = event.detail?.value ?? event.target.value;
		if (!name) return;
		let coerced = value;
		// Coerce numeric fields to numbers when possible
		if (name === "Total_Estimated_Time__c") {
			coerced =
				value === "" || value === null || value === undefined
					? ""
					: Number(value);
			if (Number.isNaN(coerced)) coerced = "";
		}
		this.newTaskData = { ...this.newTaskData, [name]: coerced };
		if (name === "TLG_Team__c") {
			const teamId = coerced;
			let options = [];
			if (teamId) {
				options = await this.loadTeamStatusOptions(teamId);
			}
			if (Array.isArray(options) && options.length > 0) {
				const current = this.newTaskData.TLG_Status__c;
				const has = options.some((o) => o.value === current);
				if (!has) {
					const fallback = options[0]?.value || "Not Started";
					this.newTaskData = { ...this.newTaskData, TLG_Status__c: fallback };
				}
			} else {
				// Team cleared or no options: clear Status to avoid invalid value
				this.newTaskData = { ...this.newTaskData, TLG_Status__c: "" };
			}
		}
	}

	async handleCreateTask() {
		try {
			// Basic validation: Subject, Status, and Case (master-detail) required
			let valid = true;
			const nameInput = this.template.querySelector(
				'lightning-input[name="Name"]'
			);
			if (nameInput) {
				const v = (this.newTaskData?.Name || "").trim();
				nameInput.setCustomValidity(v ? "" : "Subject is required");
				nameInput.reportValidity();
				if (!v) valid = false;
			}
			const statusInput = this.template.querySelector(
				'lightning-combobox[name="TLG_Status__c"]'
			);
			if (statusInput) {
				const v = (this.newTaskData?.TLG_Status__c || "").trim();
				statusInput.setCustomValidity(v ? "" : "Status is required");
				statusInput.reportValidity();
				if (!v) valid = false;
			}
			// Case (Target) is a Master-Detail; enforce selection
			const caseSearch = this.template.querySelector(
				'lightning-input[name="caseSearchNew"]'
			);
			const hasCase = !!(this.newTaskData && this.newTaskData.TLG_Case__c);
			if (caseSearch) {
				caseSearch.setCustomValidity(hasCase ? "" : "Case is required");
				caseSearch.reportValidity();
			}
			if (!hasCase) valid = false;
			if (!valid) return;
			this.isSavingNew = true;
			const payload = { ...this.newTaskData };
			// Normalize empty strings to null for Id lookups
			[
				"TLG_Opportunity__c",
				"TLG_Assigned_To__c",
				"TLG_Team__c",
				"TLG_Case__c",
			].forEach((k) => {
				if (payload[k] === "") payload[k] = null;
			});
			// Normalize numeric fields
			if (payload.Total_Estimated_Time__c === "") {
				payload.Total_Estimated_Time__c = null;
			} else if (payload.Total_Estimated_Time__c != null) {
				const n = Number(payload.Total_Estimated_Time__c);
				payload.Total_Estimated_Time__c = Number.isNaN(n) ? null : n;
			}
			if (payload.Progress__c === "") {
				payload.Progress__c = null;
			} else if (payload.Progress__c != null) {
				const p = parseInt(payload.Progress__c, 10);
				payload.Progress__c = Number.isNaN(p) ? null : p;
			}
			await createTaskFromMap(payload);
			showToast(this, "Success", "Task created", "success");
			this.showNewTaskDrawer = false;
			// Refresh board data
			await this.loadInitialData();
		} catch (e) {
			const msg = e?.body?.message || e?.message || "Failed to create task";
			showToast(this, "Error", msg, "error");
		} finally {
			this.isSavingNew = false;
		}
	}

	// =====================
	// LOOKUPS: CASE (TARGET) - NEW
	// =====================
	handleCaseSearchInputNew(event) {
		const text = event.target.value || "";
		this.newCaseSearchText = text;
		this.showCaseResultsNew = true;
		// Call debounced search function
		if (this._debouncedCaseSearchNew) {
			this._debouncedCaseSearchNew(text);
		}
	}

	handleSelectCaseNew(event) {
		const id = event.currentTarget?.dataset?.id;
		if (!id) return;
		const opt = this.caseResultsNew.find((o) => o.value === id);
		this.newTaskData = { ...this.newTaskData, TLG_Case__c: id };
		this.newCaseSearchText = opt ? opt.label : "";
		this.showCaseResultsNew = false;
	}

	handleClearCaseNew() {
		this.newTaskData = { ...this.newTaskData, TLG_Case__c: "" };
		this.newCaseSearchText = "";
		this.caseResultsNew = [];
		this.showCaseResultsNew = false;
	}

	// =====================
	// LOOKUPS: CASE (TARGET) - EDIT
	// =====================
	handleCaseSearchInputEdit(event) {
		const text = event.target.value || "";
		this.editCaseSearchText = text;
		this.showCaseResultsEdit = true;
		// Call debounced search function
		if (this._debouncedCaseSearchEdit) {
			this._debouncedCaseSearchEdit(text);
		}
	}

	handleSelectCaseEdit(event) {
		const id = event.currentTarget?.dataset?.id;
		if (!id) return;
		const opt = this.caseResultsEdit.find((o) => o.value === id);
		this.editTaskData = { ...this.editTaskData, TLG_Case__c: id };
		this.editCaseSearchText = opt ? opt.label : "";
		this.showCaseResultsEdit = false;
	}

	handleClearCaseEdit() {
		this.editTaskData = { ...this.editTaskData, TLG_Case__c: "" };
		this.editCaseSearchText = "";
		this.caseResultsEdit = [];
		this.showCaseResultsEdit = false;
	}

	// =====================
	// LOOKUPS: PARENT TASK - NEW
	// =====================
	handleParentSearchInputNew(event) {
		const text = event.target.value || "";
		this.newParentSearchText = text;
		this.showParentResultsNew = true;
		// Call debounced search function
		if (this._debouncedParentSearchNew) {
			this._debouncedParentSearchNew(text);
		}
	}

	handleSelectParentNew(event) {
		const id = event.currentTarget?.dataset?.id;
		if (!id) return;
		const opt = this.parentTaskResultsNew.find((o) => o.value === id);
		this.newTaskData = { ...this.newTaskData, Parent__c: id };
		this.newParentSearchText = opt ? opt.label : "";
		this.showParentResultsNew = false;
	}

	handleClearParentNew() {
		this.newTaskData = { ...this.newTaskData, Parent__c: "" };
		this.newParentSearchText = "";
		this.parentTaskResultsNew = [];
		this.showParentResultsNew = false;
	}

	// =====================
	// LOOKUPS: PARENT TASK - EDIT
	// =====================
	handleParentSearchInputEdit(event) {
		const text = event.target.value || "";
		this.editParentSearchText = text;
		this.showParentResultsEdit = true;
		// Call debounced search function
		if (this._debouncedParentSearchEdit) {
			this._debouncedParentSearchEdit(text);
		}
	}

	// =====================
	// BLUR-TIME VALIDATION
	// =====================
	handleNewFieldBlur(event) {
		const name = event.target?.name;
		if (!name) return;
		this.validateNewField(name);
	}

	handleEditFieldBlur(event) {
		const name = event.target?.name;
		if (!name) return;
		this.validateEditField(name);
	}

	validateNewField(name) {
		if (name === "Name") {
			const inp = this.template.querySelector('lightning-input[name="Name"]');
			if (inp) {
				const v = (this.newTaskData?.Name || "").trim();
				inp.setCustomValidity(v ? "" : "Subject is required");
				inp.reportValidity();
			}
		}
		if (name === "TLG_Status__c") {
			const cb = this.template.querySelector(
				'lightning-combobox[name="TLG_Status__c"]'
			);
			if (cb) {
				const v = (this.newTaskData?.TLG_Status__c || "").trim();
				cb.setCustomValidity(v ? "" : "Status is required");
				cb.reportValidity();
			}
		}
	}

	validateEditField(name) {
		if (name === "Name") {
			const inp = this.template.querySelector('lightning-input[name="Name"]');
			if (inp) {
				const v = (this.editTaskData?.Name || "").trim();
				inp.setCustomValidity(v ? "" : "Subject is required");
				inp.reportValidity();
			}
		}
		if (name === "TLG_Status__c") {
			const cb = this.template.querySelector(
				'lightning-combobox[name="TLG_Status__c"]'
			);
			if (cb) {
				const v = (this.editTaskData?.TLG_Status__c || "").trim();
				cb.setCustomValidity(v ? "" : "Status is required");
				cb.reportValidity();
			}
		}
		if (name === "parentSearchEdit") {
			const ps = this.template.querySelector(
				'lightning-input[name="parentSearchEdit"]'
			);
			if (ps) {
				if (
					this.editTaskData?.Parent__c &&
					this.selectedTaskId &&
					this.editTaskData.Parent__c === this.selectedTaskId
				) {
					ps.setCustomValidity("A task cannot be its own parent.");
				} else {
					ps.setCustomValidity("");
				}
				ps.reportValidity();
			}
		}
	}

	handleSelectParentEdit(event) {
		const id = event.currentTarget?.dataset?.id;
		if (!id) return;
		if (this.selectedTaskId && id === this.selectedTaskId) {
			showToast(this, "Error", "A task cannot be its own parent.", "error");
			return;
		}
		const opt = this.parentTaskResultsEdit.find((o) => o.value === id);
		this.editTaskData = { ...this.editTaskData, Parent__c: id };
		this.editParentSearchText = opt ? opt.label : "";
		this.showParentResultsEdit = false;
	}

	handleClearParentEdit() {
		this.editTaskData = { ...this.editTaskData, Parent__c: "" };
		this.editParentSearchText = "";
		this.parentTaskResultsEdit = [];
		this.showParentResultsEdit = false;
	}

	// =====================
	// FIXED STATUS OPTIONS (UI override)
	// =====================
	get fixedStatusOptions() {
		const values = [
			"Not Started",
			"In Progress",
			"Ready for Review",
			"Waiting on Client",
			"On hold",
			"Reopened",
			"Completed",
			"Closed",
			"Cancelled",
		];
		return values.map((v) => ({ label: v, value: v }));
	}

	get newTaskStatusOptions() {
		return this.fixedStatusOptions;
	}

	get editTaskStatusOptions() {
		return this.fixedStatusOptions;
	}

	// Small public helper for tests
	@api getFixedStatusLabels() {
		return (this.fixedStatusOptions || []).map((o) => o.label);
	}

	// =====================
	// RTE IMAGE UPLOAD HANDLER
	// =====================
	async handleNotesImageUploadFinished(event) {
		try {
			const files = event?.detail?.files || [];
			const count = files.length;
			if (!this.selectedTaskId || count === 0) {
				showToast(this, "Success", "Upload complete.", "success");
				return;
			}
			// Build img tags pointing to download URLs and append to notes
			const docIds = files.map((f) => f.documentId).filter(Boolean);
			let notes = this.editTaskData?.TLG_Shared_Notes__c || "";
			docIds.forEach((id) => {
				const url = `/sfc/servlet.shepherd/document/download/${id}`;
				notes += `\n<p><img src="${url}" alt="uploaded image"/></p>`;
			});
			this.editTaskData = { ...this.editTaskData, TLG_Shared_Notes__c: notes };
			showToast(this, "Success", `${count} image(s) uploaded.`, "success");
		} catch (e) {
			showToast(
				this,
				"Warning",
				"Images uploaded. Refresh if they don't appear immediately.",
				"warning"
			);
		}
	}

	handleNewTaskInColumn(event) {
		const columnStatus = event.currentTarget.dataset.columnStatus;
		const columnId = event.currentTarget.dataset.columnId;

		// Attempt to extract project context from the column cards
		let defaultProjectId = null;
		const targetColumn = this._columns.find((col) => col.id === columnId);

		if (
			targetColumn &&
			Array.isArray(targetColumn.cards) &&
			targetColumn.cards.length > 0
		) {
			const firstCardWithProject = targetColumn.cards.find(
				(card) => card.projectId
			);
			if (firstCardWithProject) {
				defaultProjectId = firstCardWithProject.projectId;
			}
		}

		// Open internal drawer with sensible defaults and also emit event
		this.newTaskData = {
			...this.newTaskData,
			TLG_Status__c: columnStatus || this.newTaskData.TLG_Status__c,
			TLG_Opportunity__c:
				defaultProjectId || this.newTaskData.TLG_Opportunity__c,
		};
		this.showNewTaskDrawer = true;

		this.dispatchEvent(
			new CustomEvent("taskcreate", {
				detail: {
					columnStatus,
					defaultProjectId,
				},
				bubbles: true,
				composed: true,
			})
		);
	}

	// Note: handleCardClick is defined earlier for unified drawer
	// Keeping this section for any additional card-click related logic

	handleCloseTaskDrawer() {
		// Check for unsaved changes before closing (MIN-005)
		if (this.isEditingTask && this._hasUnsavedChanges) {
			this.showConfirmation = true;
			this.confirmationConfig = {
				title: "Unsaved Changes",
				message:
					"You have unsaved changes. Are you sure you want to close without saving?",
				confirmLabel: "Discard Changes",
				cancelLabel: "Keep Editing",
				onConfirm: () => {
					this._forceCloseDrawer();
					this.showConfirmation = false;
				},
				onCancel: () => {
					this.showConfirmation = false;
				},
			};
			return;
		}

		this._forceCloseDrawer();
	}

	_forceCloseDrawer() {
		this.showTaskDrawer = false;
		this.selectedTaskId = null;
		this.isEditingTask = false;
		this.editTaskData = {};
		this.comments = [];
		this.newCommentText = "";
		this._hasUnsavedChanges = false;
	}

	// Confirmation Dialog handlers (MIN-005)
	handleConfirmationConfirm() {
		if (typeof this.confirmationConfig.onConfirm === "function") {
			this.confirmationConfig.onConfirm();
		}
	}

	handleConfirmationCancel() {
		if (typeof this.confirmationConfig.onCancel === "function") {
			this.confirmationConfig.onCancel();
		}
	}

	// =====================
	// TASK EDITING
	// =====================
	handleEditTaskClick() {
		const rec = this.selectedTaskRecord;
		if (!rec) return;
		// Prefill editable data from raw record if available
		const due = rec.TLG_Due_Date__c || rec.dueDate || null;
		const dueDate = due ? formatDateForInput(due) : "";

		this.editTaskData = {
			Name: rec.Name || rec.title || "",
			TLG_Status__c: rec.TLG_Status__c || rec.status || "Not Started",
			TLG_Priority__c: rec.TLG_Priority__c || rec.priority || "Normal",
			TLG_Opportunity__c: rec.TLG_Opportunity__c || rec.projectId || "",
			TLG_Team__c: rec.TLG_Team__c || rec.teamId || "",
			TLG_Assigned_To__c: rec.TLG_Assigned_To__c || rec.assignedToId || "",
			TLG_Due_Date__c: dueDate,
			Total_Estimated_Time__c: rec.Total_Estimated_Time__c ?? "",
			Progress__c: rec.Progress__c != null ? String(rec.Progress__c) : "",
			TLG_Category__c: rec.TLG_Category__c || "",
			TLG_Shared_Notes__c: rec.TLG_Shared_Notes__c || rec.description || "",
		};
		// Ensure current team appears in options when editing, even if not present in dataset
		try {
			const currentTeamId = this.editTaskData.TLG_Team__c;
			if (
				currentTeamId &&
				!this.teamOptions.some((opt) => opt.value === currentTeamId)
			) {
				const currentTeamLabel =
					(rec.TLG_Team__r && (rec.TLG_Team__r.Name || rec.TLG_Team__r.name)) ||
					rec.teamName ||
					"Current Team";
				const withoutDup = (this.teamOptions || []).filter(
					(opt) => opt.value !== currentTeamId
				);
				this.teamOptions = [
					{ label: "All Teams", value: "" },
					...withoutDup,
					{ label: currentTeamLabel, value: currentTeamId },
				];
			}
		} catch (e) {
			// non-blocking
		}
		// Ensure current project appears in options when editing
		try {
			const currentProjectId = this.editTaskData.TLG_Opportunity__c;
			if (
				currentProjectId &&
				!this.projectOptions.some((opt) => opt.value === currentProjectId)
			) {
				const currentProjectLabel =
					this.getProjectNameById(currentProjectId) || "Current Project";
				const withoutDupProj = (this.projectOptions || []).filter(
					(opt) => opt.value !== currentProjectId
				);
				this.projectOptions = [
					{ label: "All Projects", value: "" },
					...withoutDupProj,
					{ label: currentProjectLabel, value: currentProjectId },
				];
			}
		} catch (e) {
			// non-blocking
		}
		// Ensure current assignee appears in options when editing
		try {
			const currentAssigneeId = this.editTaskData.TLG_Assigned_To__c;
			if (
				currentAssigneeId &&
				!this.assignableUsersOptions.some(
					(opt) => opt.value === currentAssigneeId
				)
			) {
				const currentAssigneeLabel =
					this.getUserNameById(currentAssigneeId) || "Current User";
				const withoutDupUsers = (this.assignableUsersOptions || []).filter(
					(opt) => opt.value !== currentAssigneeId
				);
				this.assignableUsersOptions = [
					{ label: "All Users", value: "" },
					...withoutDupUsers,
					{ label: currentAssigneeLabel, value: currentAssigneeId },
				];
			}
		} catch (e) {
			// non-blocking
		}
		this.isEditingTask = true;
		// Preload team-specific statuses so the Status combobox reflects selected team
		try {
			const teamId = this.editTaskData.TLG_Team__c;
			if (teamId) {
				this.loadTeamStatusOptions(teamId);
			}
		} catch (e) {
			// non-blocking
		}
	}

	async handleEditTaskFieldChange(event) {
		const name = event.target.name;
		const value = event.detail?.value ?? event.target.value;
		if (!name) return;
		let coerced = value;
		if (name === "Total_Estimated_Time__c") {
			coerced =
				value === "" || value === null || value === undefined
					? ""
					: Number(value);
			if (Number.isNaN(coerced)) coerced = "";
		}
		this.editTaskData = { ...this.editTaskData, [name]: coerced };
		this._hasUnsavedChanges = true; // Mark as dirty when any field changes (MIN-005)
		if (name === "TLG_Team__c") {
			const teamId = coerced;
			let options = [];
			if (teamId) {
				options = await this.loadTeamStatusOptions(teamId);
			}
			if (Array.isArray(options) && options.length > 0) {
				const current = this.editTaskData.TLG_Status__c;
				const has = options.some((o) => o.value === current);
				if (!has) {
					const fallback = options[0]?.value || "Not Started";
					this.editTaskData = { ...this.editTaskData, TLG_Status__c: fallback };
				}
			} else {
				// Team cleared or no options: clear Status to avoid invalid value
				this.editTaskData = { ...this.editTaskData, TLG_Status__c: "" };
			}
		}
	}

	async handleSaveTaskEdits() {
		if (!this.selectedTaskId) return;
		try {
			// Basic validation: Subject and Status required; Parent != self; Case required
			let valid = true;
			const nameInput = this.template.querySelector(
				'lightning-input[name="Name"]'
			);
			if (nameInput) {
				const v = (this.editTaskData?.Name || "").trim();
				nameInput.setCustomValidity(v ? "" : "Subject is required");
				nameInput.reportValidity();
				if (!v) valid = false;
			}
			const statusInput = this.template.querySelector(
				'lightning-combobox[name="TLG_Status__c"]'
			);
			if (statusInput) {
				const v = (this.editTaskData?.TLG_Status__c || "").trim();
				statusInput.setCustomValidity(v ? "" : "Status is required");
				statusInput.reportValidity();
				if (!v) valid = false;
			}
			// Enforce Case on edit as well (still MD)
			const caseSearch = this.template.querySelector(
				'lightning-input[name="caseSearchEdit"]'
			);
			const hasCase = !!(this.editTaskData && this.editTaskData.TLG_Case__c);
			if (caseSearch) {
				caseSearch.setCustomValidity(hasCase ? "" : "Case is required");
				caseSearch.reportValidity();
			}
			if (!hasCase) valid = false;
			if (
				this.editTaskData?.Parent__c &&
				this.selectedTaskId &&
				this.editTaskData.Parent__c === this.selectedTaskId
			) {
				showToast(this, "Error", "A task cannot be its own parent.", "error");
				valid = false;
			}
			if (!valid) return;
			this.isSavingEdit = true;
			const payload = { ...this.editTaskData };
			[
				"TLG_Opportunity__c",
				"TLG_Assigned_To__c",
				"TLG_Team__c",
				"TLG_Case__c",
			].forEach((k) => {
				if (payload[k] === "") payload[k] = null;
			});
			if (payload.Total_Estimated_Time__c === "") {
				payload.Total_Estimated_Time__c = null;
			} else if (payload.Total_Estimated_Time__c != null) {
				const n = Number(payload.Total_Estimated_Time__c);
				payload.Total_Estimated_Time__c = Number.isNaN(n) ? null : n;
			}
			if (payload.Progress__c === "") {
				payload.Progress__c = null;
			} else if (payload.Progress__c != null) {
				const p = parseInt(payload.Progress__c, 10);
				payload.Progress__c = Number.isNaN(p) ? null : p;
			}
			await updateTaskFromMap(this.selectedTaskId, payload);
			showToast(this, "Success", "Task updated", "success");
			this.isEditingTask = false;
			this._hasUnsavedChanges = false; // Clear unsaved changes flag after save
			// Reload board and keep drawer open to show updated details
			await this.loadInitialData();
		} catch (e) {
			const msg = e?.body?.message || e?.message || "Failed to update task";
			showToast(this, "Error", msg, "error");
		} finally {
			this.isSavingEdit = false;
		}
	}

	handleCancelTaskEdits() {
		// Check for unsaved changes (MIN-005)
		if (this._hasUnsavedChanges) {
			this.showConfirmation = true;
			this.confirmationConfig = {
				title: "Discard Changes?",
				message:
					"You have unsaved changes. Are you sure you want to discard them?",
				confirmLabel: "Discard",
				cancelLabel: "Keep Editing",
				onConfirm: () => {
					this.isEditingTask = false;
					this.editTaskData = {};
					this._hasUnsavedChanges = false;
					this.showConfirmation = false;
				},
				onCancel: () => {
					this.showConfirmation = false;
				},
			};
			return;
		}

		// Discard edits and revert to read-only view
		this.isEditingTask = false;
		this.editTaskData = {};
	}

	// (duplicate getters removed; single definitions exist earlier in file)

	handleColumnClick(event) {
		// Ignore clicks on buttons or interactive elements
		if (
			event.target.tagName === "BUTTON" ||
			event.target.closest("button") ||
			event.target.closest(".column-action-btn")
		) {
			return;
		}

		// Only handle click if the column is collapsed (to expand it)
		const columnElement = event.currentTarget;
		const isCollapsed = columnElement.dataset.collapsed === "true";

		if (isCollapsed) {
			event.preventDefault();
			event.stopPropagation();
			const columnId = columnElement.dataset.columnId;
			this.handleColumnCollapseToggle({
				preventDefault: () => {},
				stopPropagation: () => {},
				currentTarget: { dataset: { columnId } },
			});
		}
	}

	handleColumnToggle(event) {
		this.handleColumnCollapseToggle(event);
	}

	handleColumnCollapseToggle(event) {
		// Prevent event bubbling to avoid triggering handleColumnClick
		event.preventDefault();
		event.stopPropagation();

		const columnId = event.currentTarget.dataset.columnId;
		const column = this._columns.find((col) => col.id === columnId);

		if (!column) {
			return;
		}

		const wasCollapsed =
			column.isCollapsed || this.collapsedColumns.has(columnId);

		if (wasCollapsed) {
			const limit = this.getAutoCollapseLimit();
			if (limit && this.countExpandedColumns() >= limit) {
				showToast(
					this,
					"Info",
					`Only ${limit} columns can remain expanded. Collapse another column before expanding "${column.title}".`,
					"info"
				);
				return;
			}

			// User manually expanded - track this preference
			this.collapsedColumns.delete(columnId);
			this.manuallyCollapsedColumns.delete(columnId);
			this.manuallyExpandedColumns.add(columnId);
			column.isCollapsed = false;
			column.ariaExpanded = "true";
		} else {
			// User manually collapsed - track this preference
			this.collapsedColumns.add(columnId);
			this.manuallyExpandedColumns.delete(columnId);
			this.manuallyCollapsedColumns.add(columnId);
			column.isCollapsed = true;
			column.ariaExpanded = "false";
		}

		// Refresh derived UI properties so template bindings stay in sync
		this.updateColumnCounts(column);

		// Force reactivity
		this._columns = [...this._columns];

		// Persist preference changes
		this.saveCollapsedPreferences();

		// Show toast notification
		const action = column.isCollapsed ? "collapsed" : "expanded";
		showToast(
			this,
			"Column Updated",
			`${column.title} column ${action}`,
			"success"
		);

		// Update DOM classes for visual styling
		this.updateColumnClasses();
	}

	async saveCollapsedPreferences() {
		try {
			// Convert Set to comma-separated string of status names
			const collapsedStatusNames = Array.from(this.collapsedColumns).join(",");
			await saveUserPreferences({ collapsedColumns: collapsedStatusNames });
		} catch (error) {
			console.error("Error saving user preferences:", error);
			// Silently fail - don't show error toast for background save
		}
	}

	updateColumnClasses() {
		// Use setTimeout to ensure DOM is updated after column re-render
		setTimeout(() => {
			const columnElements = this.template.querySelectorAll(".kanban-column");
			columnElements.forEach((columnEl) => {
				const id = columnEl.dataset.columnId;
				const model = this._columns.find((c) => c.id === id);
				if (!model) return;
				// Keep a data attribute in sync for event logic and CSS hooks
				columnEl.dataset.collapsed = model.isCollapsed ? "true" : "false";
				columnEl.dataset.status = model.statusValue;
				columnEl.dataset.statusLabel = model.title;
				columnEl.classList.toggle("collapsed", model.isCollapsed);
			});
		}, 0);
	}

	getAutoCollapseLimit() {
		const configuredLimit = parseInt(this.maxExpandedColumnsSetting, 10);
		if (!Number.isNaN(configuredLimit) && configuredLimit > 0) {
			return configuredLimit;
		}

		const defaultLimit = parseInt(this.defaultMaxExpandedColumns, 10);
		if (!Number.isNaN(defaultLimit) && defaultLimit > 0) {
			return defaultLimit;
		}

		return null;
	}

	countExpandedColumns() {
		if (!Array.isArray(this._columns)) {
			return 0;
		}

		return this._columns.reduce((count, column) => {
			return column.isCollapsed ? count : count + 1;
		}, 0);
	}

	enforceAutoCollapseLimit({ showToastIfCollapsed = false } = {}) {
		const limit = this.getAutoCollapseLimit();

		if (!limit || !Array.isArray(this._columns) || this._columns.length === 0) {
			return { limit, collapsedCount: 0 };
		}

		let expandedCount = 0;
		const columnsToCollapse = [];

		this._columns.forEach((column) => {
			// Skip columns that user manually expanded - respect user preference!
			if (this.manuallyExpandedColumns.has(column.id)) {
				if (!column.isCollapsed) {
					expandedCount += 1;
				}
				return;
			}

			// Skip columns already collapsed
			if (column.isCollapsed) {
				return;
			}

			expandedCount += 1;

			// Only auto-collapse if over limit AND user hasn't manually interacted with this column
			if (
				expandedCount > limit &&
				!this.manuallyCollapsedColumns.has(column.id)
			) {
				columnsToCollapse.push(column);
			}
		});

		if (columnsToCollapse.length === 0) {
			return { limit, collapsedCount: 0 };
		}

		columnsToCollapse.forEach((column) => {
			column.isCollapsed = true;
			column.ariaExpanded = "false";
			this.collapsedColumns.add(column.id);
			// Don't add to manuallyCollapsedColumns - this is auto-collapse
		});

		this._columns = [...this._columns];

		this.saveCollapsedPreferences();
		this.updateColumnClasses();

		const shouldNotify = showToastIfCollapsed || !this.autoCollapseNoticeShown;

		if (shouldNotify) {
			const subject =
				columnsToCollapse.length === 1 ? "column was" : "columns were";
			showToast(
				this,
				"Columns Collapsed",
				`${columnsToCollapse.length} ${subject} automatically collapsed to keep the board within the configured limit of ${limit}.`,
				"info"
			);
			this.autoCollapseNoticeShown = true;
		}

		return { limit, collapsedCount: columnsToCollapse.length };
	}

	handleRefreshBoard(event) {
		if (event) {
			event.stopPropagation();
		}
		this.safeLoadInitialData();
	}

	// ========================================
	// SETTINGS MENU HANDLERS
	// ========================================

	handleToggleSettingsMenu(event) {
		event.stopPropagation();
		this.showSettingsMenu = !this.showSettingsMenu;
	}

	handleCloseSettingsMenu(event) {
		if (event) {
			event.stopPropagation();
		}
		this.showSettingsMenu = false;
	}

	// Column Management Actions
	handleManageStatuses(event) {
		event.stopPropagation();
		// Open Filters drawer and focus the Columns to Show control
		this.showFilterDrawer = true;
		setTimeout(() => {
			try {
				const el = this.template.querySelector(
					'lightning-dual-listbox[name="columns"]'
				);
				if (el && typeof el.scrollIntoView === "function") {
					el.scrollIntoView({ behavior: "smooth", block: "center" });
				}
			} catch (e) {
				/* no-op */
			}
		}, 0);
		this.showSettingsMenu = false;
	}

	handleReorderColumns(event) {
		event.stopPropagation();
		showToast(
			this,
			"Info",
			"Column Reordering feature coming soon! Currently set order numbers in team status records (${STATUS_ORDER_INCREMENT}, ${STATUS_ORDER_INCREMENT*2}, ${STATUS_ORDER_INCREMENT*3}, etc.).",
			"info"
		);
		this.showSettingsMenu = false;
	}

	handleCustomizeLabels(event) {
		event.stopPropagation();
		showToast(
			this,
			"Info",
			"Label Customization feature coming soon! Edit Display Labels in team status records.",
			"info"
		);
		this.showSettingsMenu = false;
	}

	// Team Settings Actions
	handleTeamStatusConfig(event) {
		event.stopPropagation();
		showToast(
			this,
			"Info",
			"Navigate to Setup → Custom Objects → TLG Team Status to configure team-specific status columns.",
			"info"
		);
		this.showSettingsMenu = false;
	}

	handleExportConfig(event) {
		event.stopPropagation();
		showToast(
			this,
			"Info",
			"Configuration Export feature coming soon!",
			"info"
		);
		this.showSettingsMenu = false;
	}

	handleImportConfig(event) {
		event.stopPropagation();
		showToast(
			this,
			"Info",
			"Configuration Import feature coming soon!",
			"info"
		);
		this.showSettingsMenu = false;
	}

	handleRefreshColumns(event) {
		event.stopPropagation();
		try {
			// Refresh the board data
			this.loadKanbanData();
			showToast(
				this,
				"Success",
				"Board data refreshed successfully!",
				"success"
			);
		} catch (error) {
			console.error("Error refreshing board:", error);
			showToast(
				this,
				"Error",
				"Failed to refresh board data. Please try again.",
				"error"
			);
		}
		this.showSettingsMenu = false;
	}

	handleToggleColumnOrdering(event) {
		event.stopPropagation();
		// This would toggle custom column ordering mode
		showToast(
			this,
			"Info",
			"Custom column ordering feature coming soon!",
			"info"
		);
		this.showSettingsMenu = false;
	}

	handleBulkActions(event) {
		event.stopPropagation();
		this.handleToggleBulkMode();
		this.showSettingsMenu = false;
	}

	// Display Options Actions
	handleToggleDarkMode(event) {
		event.stopPropagation();
		// Toggle locally for immediate feedback
		const newDarkMode = !this.isDarkMode;
		this.isDarkMode = newDarkMode;

		// Persist preference using safe storage utility
		setStorageItem("kanbanTheme", newDarkMode ? "dark" : "light");

		// Also notify parent (optional) in case layout wants to sync globally
		this.dispatchEvent(
			new CustomEvent("themetoggle", {
				detail: { isDarkMode: newDarkMode },
				bubbles: true,
			})
		);
		this.showSettingsMenu = false;
	}

	handleCompactView(event) {
		event.stopPropagation();
		const next = !this.isCompactView;
		this.isCompactView = next;
		setStorageItem("kanbanCompactView", String(next));
		showToast(
			this,
			"Success",
			next ? "Compact view enabled" : "Compact view disabled",
			"success"
		);
		this.showSettingsMenu = false;
	}

	handleResetLayout() {
		// Reset any layout customizations
		this.collapsedColumns.clear(); // Also reset collapsed state
		this.saveCollapsedPreferences(); // Save empty state
		this.safeLoadInitialData();
		showToast(this, "Success", "Layout reset successfully", "success");
		this.showSettingsMenu = false;
	}

	handleExpandAllColumns() {
		this.collapsedColumns.clear();
		this._columns = this._columns.map((col) => ({
			...col,
			isCollapsed: false,
			ariaExpanded: "true",
		}));

		const result = this.enforceAutoCollapseLimit({
			showToastIfCollapsed: true,
		});

		if (!result || result.collapsedCount === 0) {
			showToast(this, "Success", "All columns expanded", "success");
			this.saveCollapsedPreferences();
		}

		this.showSettingsMenu = false;
		if (!result || result.collapsedCount === 0) {
			this.updateColumnClasses();
		}
	}

	handleCollapseAllColumns() {
		this.collapsedColumns.clear();
		this._columns.forEach((col) => {
			this.collapsedColumns.add(col.id);
		});
		this._columns = this._columns.map((col) => ({ ...col, isCollapsed: true }));
		showToast(this, "Success", "All columns collapsed", "success");
		this.showSettingsMenu = false;
		this.updateColumnClasses();
	}

	get computedRootClass() {
		const classes = [
			"kanban-root",
			this.isDarkMode ? "dark-mode" : "light-mode",
		];
		if (this.timeLogModalActive) {
			classes.push("time-log-modal-active");
		}
		if (this.isCompactView) {
			classes.push("compact");
		}
		return classes.join(" ");
	}

	get hasActiveFilters() {
		return this.activeFilterCount > 0;
	}

	// Removed showToast - now using shared utility from c/toastHelper

	// Public API used by parent layout
	@api
	refreshBoard() {
		this.handleRefreshBoard();
	}

	// Update only one card's logged time badge without full board refresh
	@api
	updateCardLoggedTime(taskId) {
		try {
			if (!taskId) return;
			// Find the specific card component by data-id on the host element
			const cardCmp = this.template.querySelector(
				`c-kanban-card[data-id="${taskId}"]`
			);
			if (cardCmp && typeof cardCmp.reloadLoggedTime === "function") {
				cardCmp.reloadLoggedTime();
				return;
			}
			// If the card isn't in the DOM (e.g., collapsed column or virtualized), fallback to a lightweight refresh
			this.handleRefreshBoard();
		} catch (e) {
			// As a safety net, do a standard refresh if the targeted update fails
			this.handleRefreshBoard();
		}
	}

	@api
	getColumnsSnapshot() {
		return this._columns.map((col) => ({
			id: col.id,
			title: col.title,
			statusValue: col.statusValue,
			orderNumber: col.orderNumber,
			isCollapsed: col.isCollapsed,
		}));
	}

	@api
	getProjectsSnapshot() {
		return this._projects.map((project) => ({ ...project }));
	}

	@api
	updateFilters(filters = {}) {
		// Store and reflect incoming filters from parent layout
		this._filters = { ...filters };
		// Map well-known keys if present
		if (typeof filters.teamId === "string")
			this.selectedTeamId = filters.teamId;
		if (typeof filters.assignedToId === "string")
			this.selectedAssignedToId = filters.assignedToId;
		if (typeof filters.projectId === "string")
			this.selectedProjectId = filters.projectId;
		if (typeof filters.startDate === "string")
			this.startDate = filters.startDate;
		if (typeof filters.endDate === "string") this.endDate = filters.endDate;
		this.updateActiveFilterCount();
		// For now, reload with current server logic
		this.safeLoadInitialData();
	}

	@api
	toggleFilterDrawer() {
		this.showFilterDrawer = !this.showFilterDrawer;
	}

	@api
	toggleBulkActions() {
		// Placeholder for future bulk actions UI
		showToast(this, "Info", "Bulk actions are not available yet.", "info");
	}

	// Drag and drop handlers (HTML5 DnD)
	handleCardDragStart(event) {
		// Custom event from c-kanban-card or native drag event
		const detailId = event.detail && event.detail.issueId;
		const targetId =
			event.currentTarget &&
			event.currentTarget.dataset &&
			event.currentTarget.dataset.id;
		this._draggedCardId = detailId || targetId || this._draggedCardId;

		// Add dragging class for visual feedback
		if (event.currentTarget) {
			event.currentTarget.classList.add("dragging");
		}
	}

	handleDragEnd(event) {
		// Clean up drag state to prevent stuck UI
		this._draggedCardId = null;

		// Remove dragging class
		if (event.currentTarget) {
			event.currentTarget.classList.remove("dragging");
		}

		// Remove drag-over class from all drop zones
		const dropZones = this.template.querySelectorAll(".drop-zone.drag-over");
		dropZones.forEach((zone) => {
			zone.classList.remove("drag-over");
		});
	}

	handleDragOver(event) {
		event.preventDefault();
		event.dataTransfer.dropEffect = "move";

		const zone = event.currentTarget;
		if (zone && !zone.classList.contains("drag-over")) {
			zone.classList.add("drag-over");
		}
	}

	handleDragLeave(event) {
		const zone = event.currentTarget;
		if (zone) {
			zone.classList.remove("drag-over");
		}
	}

	handleDrop(event) {
		event.preventDefault();
		const zone = event.currentTarget;
		if (zone) zone.classList.remove("drag-over");

		const dataId =
			event.dataTransfer && event.dataTransfer.getData("text/plain");
		const cardId = dataId || this._draggedCardId;

		// Always clear drag state even if drop fails
		const draggedCard = this._draggedCardId;
		this._draggedCardId = null;

		if (!cardId) {
			console.warn("Drop failed: No card ID available");
			return;
		}

		const targetColumnId = zone ? zone.dataset.columnId : null;
		if (!targetColumnId) {
			console.warn("Drop failed: No target column ID");
			return;
		}

		// Find target and source columns
		const targetCol = this._columns.find((c) => c.id === targetColumnId);
		if (!targetCol) return;

		let sourceCol = null;
		let movedCard = null;
		for (const col of this._columns) {
			const idx = col.cards.findIndex((c) => c.Id === cardId);
			if (idx > -1) {
				sourceCol = col;
				movedCard = col.cards.splice(idx, 1)[0];
				this.updateColumnCounts(col);
				break;
			}
		}

		if (!movedCard) return;

		// Check if status actually changed
		const oldStatus = movedCard.status;
		const newStatus = targetCol.statusValue || movedCard.status;

		if (oldStatus === newStatus) {
			// Same column - reorder visually and persist new sort order at end of column
			// Compute a next sort order based on existing cards in the target column
			const existingMax = targetCol.cards
				.filter((c) => c && c.Id !== movedCard.Id)
				.reduce((max, c) => {
					const val =
						typeof c.sortOrder === "number"
							? c.sortOrder
							: parseInt(c.sortOrder, 10);
					return Number.isFinite(val) ? Math.max(max, val) : max;
				}, 0);

			const nextOrder = (Number.isFinite(existingMax) ? existingMax : 0) + 10;
			movedCard.sortOrder = nextOrder;
			targetCol.cards.push(movedCard);
			this.updateColumnCounts(targetCol);
			this._columns = [...this._columns];

			// Persist to server (best-effort; UI remains optimistic on failure)
			this.persistTaskOrder(movedCard.Id, nextOrder, targetCol.statusValue);
			return;
		}

		// Update status in local card object
		movedCard.status = newStatus;

		// Optimistic UI update - show change immediately
		targetCol.cards.push(movedCard);
		this.updateColumnCounts(targetCol);
		this._columns = [...this._columns];

		// Persist to Salesforce
		this.persistTaskMove(
			cardId,
			newStatus,
			oldStatus,
			sourceCol,
			targetCol,
			movedCard
		);
	}

	/**
	 * Persist task order change to Salesforce
	 * @param {String} taskId - Salesforce task ID
	 * @param {Number} newOrder - New integer order value
	 * @param {String} columnStatus - Status value of the column the task resides in
	 */
	async persistTaskOrder(taskId, newOrder, columnStatus) {
		try {
			await updateTaskOrder({ taskId, newOrder, columnId: columnStatus });
		} catch (error) {
			const errorMessage =
				error?.body?.message || error?.message || "Failed to update task order";
			showToast(
				this,
				"Warning",
				`Couldn't persist order: ${errorMessage}`,
				"warning"
			);
		}
	}

	/**
	 * Persist task status change to Salesforce
	 * @param {String} taskId - Salesforce task ID
	 * @param {String} newStatus - New status value
	 * @param {String} oldStatus - Previous status value (for rollback)
	 * @param {Object} sourceCol - Source column object (for rollback)
	 * @param {Object} targetCol - Target column object (for rollback)
	 * @param {Object} movedCard - Card object (for rollback)
	 */
	async persistTaskMove(
		taskId,
		newStatus,
		oldStatus,
		sourceCol,
		targetCol,
		movedCard
	) {
		// Add to moving cards set
		this._movingCardIds.add(taskId);
		this._columns = [...this._columns]; // Trigger reactivity

		try {
			// Call Apex to update task status
			await moveTask({ taskId, newStatus });

			// Show success message
			showToast(this, "Success", `Task moved to ${targetCol.title}`, "success");

			// After successful status update, persist a new sort order at end of target column
			const existingMax = targetCol.cards
				.filter((c) => c && c.Id !== movedCard.Id)
				.reduce((max, c) => {
					const val =
						typeof c.sortOrder === "number"
							? c.sortOrder
							: parseInt(c.sortOrder, 10);
					return Number.isFinite(val) ? Math.max(max, val) : max;
				}, 0);
			const nextOrder = (Number.isFinite(existingMax) ? existingMax : 0) + 10;
			movedCard.sortOrder = nextOrder;
			// Fire and forget; if it fails, user keeps visual order and can retry by moving again
			try {
				await updateTaskOrder({
					taskId,
					newOrder: nextOrder,
					columnId: newStatus,
				});
			} catch (orderErr) {
				// Non-fatal warning
				const msg =
					orderErr?.body?.message ||
					orderErr?.message ||
					"Failed to persist order";
				showToast(this, "Warning", `Couldn't persist order: ${msg}`, "warning");
			}

			// UX-002: Prepare undo for this move (last-move undo)
			const moveEntry = {
				taskId,
				fromStatus: oldStatus,
				toStatus: newStatus,
				sourceColumnId: sourceCol.id,
				targetColumnId: targetCol.id,
			};
			this._lastMove = moveEntry;
			this._moveHistory.push(moveEntry);
			if (this._moveHistory.length > MAX_UNDO_HISTORY_SIZE) {
				this._moveHistory.shift(); // keep small history buffer
			}
			// clear redo stack on new action
			this._redoStack = [];
			this.undoMessage = `Task moved to ${targetCol.title}`;
			this.showUndoBanner = true;
			if (this._undoTimerId) {
				clearTimeout(this._undoTimerId);
			}
			// Auto-hide after 30 seconds
			this._undoTimerId = setTimeout(() => {
				this.clearUndoBanner();
			}, 30000);
		} catch (error) {
			// Rollback optimistic update on error
			this.rollbackTaskMove(movedCard, oldStatus, sourceCol, targetCol);

			// Show error to user
			const errorMessage =
				error.body?.message || error.message || "Failed to update task status";
			showToast(this, "Error", `Failed to move task: ${errorMessage}`, "error");
		} finally {
			// Remove from moving cards set
			this._movingCardIds.delete(taskId);
			this._columns = [...this._columns]; // Trigger reactivity
		}
	}

	/**
	 * Rollback task move on server error
	 * @param {Object} movedCard - Card that was moved
	 * @param {String} oldStatus - Original status to restore
	 * @param {Object} sourceCol - Original column
	 * @param {Object} targetCol - Target column (to remove from)
	 */
	rollbackTaskMove(movedCard, oldStatus, sourceCol, targetCol) {
		// Remove from target column
		const targetIdx = targetCol.cards.findIndex((c) => c.Id === movedCard.Id);
		if (targetIdx > -1) {
			targetCol.cards.splice(targetIdx, 1);
		}

		// Restore to source column
		movedCard.status = oldStatus;
		sourceCol.cards.push(movedCard);

		// Update counts
		this.updateColumnCounts(sourceCol);
		this.updateColumnCounts(targetCol);

		// Trigger reactivity
		this._columns = [...this._columns];
	}

	// UX-002: Clear undo banner and state
	clearUndoBanner() {
		this.showUndoBanner = false;
		this.undoMessage = "";
		this._lastMove = null;
		if (this._undoTimerId) {
			clearTimeout(this._undoTimerId);
			this._undoTimerId = null;
		}
	}

	// UX-002: Undo the last move action
	async handleUndoLastMove() {
		const last = this._lastMove;
		if (!last) return;

		// Optimistically revert in UI
		const { taskId, fromStatus, toStatus, sourceColumnId, targetColumnId } =
			last;
		const sourceCol = this._columns.find((c) => c.id === sourceColumnId);
		const targetCol = this._columns.find((c) => c.id === targetColumnId);
		if (!sourceCol || !targetCol) {
			this.clearUndoBanner();
			return;
		}

		// Find moved card in target column
		const idx = targetCol.cards.findIndex((c) => c.Id === taskId);
		if (idx === -1) {
			this.clearUndoBanner();
			return;
		}

		const card = targetCol.cards.splice(idx, 1)[0];
		card.status = fromStatus;
		sourceCol.cards.push(card);
		this.updateColumnCounts(sourceCol);
		this.updateColumnCounts(targetCol);
		this._columns = [...this._columns];

		// Hide banner immediately
		this.clearUndoBanner();

		// Persist revert to server
		try {
			await moveTask({ taskId, newStatus: fromStatus });
			showToast(
				this,
				"Info",
				`Move undone. Returned to ${sourceCol.title}.`,
				"info"
			);
		} catch (err) {
			// If server revert fails, restore previous state to keep UI consistent
			const srcIdx = sourceCol.cards.findIndex((c) => c.Id === taskId);
			if (srcIdx > -1) {
				const c2 = sourceCol.cards.splice(srcIdx, 1)[0];
				c2.status = toStatus;
				targetCol.cards.push(c2);
				this.updateColumnCounts(sourceCol);
				this.updateColumnCounts(targetCol);
				this._columns = [...this._columns];
			}
			const msg = err?.body?.message || err?.message || "Failed to undo move";
			showToast(this, "Error", msg, "error");
		}
	}

	// UX-002: Redo the last undone move
	async handleRedoLastMove() {
		const entry = this._redoStack?.pop();
		if (!entry) return;
		const { taskId, toStatus, fromStatus, sourceColumnId, targetColumnId } =
			entry;
		const sourceCol = this._columns.find((c) => c.id === sourceColumnId);
		const targetCol = this._columns.find((c) => c.id === targetColumnId);
		if (!sourceCol || !targetCol) return;

		const idx = sourceCol.cards.findIndex((c) => c.Id === taskId);
		if (idx === -1) return;
		const card = sourceCol.cards.splice(idx, 1)[0];
		card.status = toStatus;
		targetCol.cards.push(card);
		this.updateColumnCounts(sourceCol);
		this.updateColumnCounts(targetCol);
		this._columns = [...this._columns];

		try {
			await moveTask({ taskId, newStatus: toStatus });
			showToast(
				this,
				"Info",
				`Redo applied: moved back to ${targetCol.title}.`,
				"info"
			);
		} catch (err) {
			// Rollback redo
			const tIdx = targetCol.cards.findIndex((c) => c.Id === taskId);
			if (tIdx > -1) {
				const c2 = targetCol.cards.splice(tIdx, 1)[0];
				c2.status = fromStatus;
				sourceCol.cards.push(c2);
				this.updateColumnCounts(sourceCol);
				this.updateColumnCounts(targetCol);
				this._columns = [...this._columns];
			}
			const msg = err?.body?.message || err?.message || "Failed to redo move";
			showToast(this, "Error", msg, "error");
		}
	}

	// UX-002 + MIN-008: Keyboard handler (Ctrl+Z / Ctrl+Y + shortcuts)
	handleKeyDown(event) {
		// Avoid interfering with input fields
		const target = event.target;
		const tag = (target?.tagName || "").toLowerCase();
		if (tag === "input" || tag === "textarea" || target?.isContentEditable) {
			return;
		}
		const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;
		const mod = isMac ? event.metaKey : event.ctrlKey;
		// Ctrl/Cmd-based shortcuts
		if (!mod) {
			// Non-modifier single-key shortcuts can be added here if desired
			return;
		}

		if (event.key === "z" || event.key === "Z") {
			// Ctrl+Z: Undo
			event.preventDefault();
			// When we undo, push the last move into redo stack
			if (this._lastMove) {
				this._redoStack.push(this._lastMove);
			}
			this.handleUndoLastMove();
		} else if (
			event.key === "y" ||
			(event.shiftKey && (event.key === "Z" || event.key === "z"))
		) {
			// Ctrl+Y or Ctrl+Shift+Z: Redo
			event.preventDefault();
			this.handleRedoLastMove();
		} else if (event.key === "k" || event.key === "K") {
			// Ctrl+K: Open New Task
			event.preventDefault();
			this.handleOpenNewTaskDrawer();
		} else if ((event.key === "f" || event.key === "F") && event.shiftKey) {
			// Ctrl+Shift+F: Open Filters (avoid conflict with browser Ctrl+F)
			event.preventDefault();
			this.handleOpenFilterDrawer();
		}
	}

	// Bubble time log requests up to layout while opening drawer in log-time focus
	async handleTimeLogRequest(event) {
		event.stopPropagation();
		const taskId = event.detail?.taskId;
		if (taskId) {
			await this.openTaskDrawer(taskId, "logTime");
		}
		this.dispatchEvent(
			new CustomEvent("timelogrequest", {
				detail: event.detail,
				bubbles: true,
				composed: true,
			})
		);
	}

	// ============================================================================
	// FILTER FUNCTIONALITY
	// ============================================================================

	// Handle opening filter drawer
	handleOpenFilterDrawer() {
		this.showFilterDrawer = true;
	}

	// Handle closing filter drawer
	handleCloseFilterDrawer() {
		this.showFilterDrawer = false;
	}

	// Handle filter drawer backdrop click
	handleFilterDrawerBackdropClick(event) {
		if (event.target === event.currentTarget) {
			this.showFilterDrawer = false;
		}
	}

	// Handle filter form input changes
	handleFilterChange(event) {
		// Lightning components emit values via event.detail, not event.target
		const name = event.target.name;
		const value = event.detail.value;

		// Map component names to filter keys
		const filterKeyMap = {
			team: "teamId",
			assignedTo: "assignedToId",
			project: "projectId",
			startDate: "startDate",
			endDate: "endDate",
		};

		const filterKey = filterKeyMap[name] || name;

		// Update the _filters object
		this._filters[filterKey] = value;

		// Also update legacy state properties for backward compatibility with template bindings
		if (name === "team") {
			this.selectedTeamId = value;
		} else if (name === "assignedTo") {
			this.selectedAssignedToId = value;
			// Mark that the user explicitly changed assignee so project selection won't override it
			this.userAdjustedAssignedTo = true;
		} else if (name === "project") {
			this.selectedProjectId = value;
		} else if (name === "startDate") {
			this.startDate = value;
		} else if (name === "endDate") {
			this.endDate = value;
		}

		this.updateActiveFilterCount();
	}

	// Handle applying filters
	handleApplyFilters() {
		// Reload from server so project/assignee filters are reflected in the dataset
		this.safeLoadInitialData();
		// Then apply any client-side only filters (e.g., status/priority/date) to the refreshed dataset
		this.applyFilters();
		this.showFilterDrawer = false;
		showToast(this, "Success", "Filters applied successfully", "success");
	}

	// UX-011: Handle chart filter events from dashboard
	handleChartFilter(event) {
		const { filterType, filterValue, filterLabel } = event.detail;

		if (!filterType || !filterValue) {
			return;
		}

		// Initialize filter arrays if needed
		if (!this._filters[filterType]) {
			this._filters[filterType] = [];
		}

		// Toggle the filter value (add if not present, remove if present)
		const currentFilters = this._filters[filterType];
		const index = currentFilters.indexOf(filterValue);

		if (index === -1) {
			// Add filter
			currentFilters.push(filterValue);
			showToast(
				this,
				"Filter Applied",
				`Filtered by ${filterLabel}`,
				"success",
				"dismissible"
			);
		} else {
			// Remove filter
			currentFilters.splice(index, 1);
			showToast(
				this,
				"Filter Removed",
				`Removed filter: ${filterLabel}`,
				"info",
				"dismissible"
			);
		}

		// Apply the updated filters
		this.applyFilters();
		this.updateActiveFilterCount();
	}

	// Handle clearing all filters
	handleClearFilters() {
		// Clear the _filters object
		this._filters = {};

		// Clear legacy state properties (used by template bindings)
		this.selectedTeamId = "";
		this.selectedAssignedToId = "";
		this.selectedProjectId = "";
		this.startDate = "";
		this.endDate = "";
		this.activeFilterCount = 0;
		this.userAdjustedAssignedTo = false;

		// Clear quick filters
		this.quickFilters = {
			myTasks: false,
			highPriority: false,
			dueSoon: false,
			overdue: false,
			unassigned: false,
		};

		// Reset Lightning component values
		// Lightning components will reflect changes via their bound properties above
		// No need to manually manipulate DOM for Lightning components

		// Reload default dataset (back to current user's tasks by default), then apply filters (none)
		this.safeLoadInitialData();
		this.applyFilters();

		showToast(this, "Success", "All filters cleared", "success");
	}

	// PERF-001: Virtualization helpers
	renderedCallback() {
		// After render, initialize virtualization slices and positions
		this.initVirtualization();
	}

	initVirtualization() {
		if (!Array.isArray(this._columns) || this._columns.length === 0) return;
		const columnEls = this.template.querySelectorAll(".column-content");
		const viewportH = window.innerHeight || 800;
		columnEls.forEach((el) => {
			const colId = el.dataset.columnId;
			const col = this._columns.find((c) => c.id === colId);
			if (!col) return;
			// Measure top relative to page
			const rect = el.getBoundingClientRect();
			const top = rect.top + window.scrollY;
			col._vsTop = top;
			col._vsViewportH = viewportH;
			// Try to measure actual row height from the first rendered card-wrapper
			let measured = null;
			try {
				const firstCard = el.querySelector(".card-wrapper");
				if (firstCard && firstCard.offsetHeight) {
					measured = firstCard.offsetHeight;
				}
			} catch (e) {
				/* no-op */
			}
			if (measured && measured > 40) {
				col._vsRowHeight = measured;
			} else {
				col._vsRowHeight = this.virtualRowHeight;
			}
			const cards = Array.isArray(col.cards) ? col.cards : [];
			if (!this.enableVirtualScroll || cards.length < this._minVirtualCards) {
				col.renderedCards = cards;
				col.vsTopStyle = "height:0px;";
				col.vsBottomStyle = "height:0px;";
				return;
			}
			this.computeColumnSlice(col);
		});
		// Trigger template update
		this._columns = [...this._columns];
	}

	handleWindowScroll() {
		if (!this.enableVirtualScroll) return;
		let changed = false;
		for (const col of this._columns) {
			if (!col || !Array.isArray(col.cards)) continue;
			if (col.cards.length < this._minVirtualCards) continue;
			changed = this.computeColumnSlice(col) || changed;
		}
		if (changed) {
			this._columns = [...this._columns];
		}
	}

	handleWindowResize() {
		// Re-initialize measurements on resize
		this.initVirtualization();
	}

	computeColumnSlice(col) {
		const viewportTop = window.scrollY;
		const viewportBottom = viewportTop + (window.innerHeight || 800);
		const listTop = col._vsTop || 0;
		const rowH = col._vsRowHeight || this.virtualRowHeight;
		const buffer = this.virtualBuffer;
		const total = col.cards.length;
		const start = Math.max(
			0,
			Math.floor((viewportTop - listTop) / rowH) - buffer
		);
		const end = Math.min(
			total,
			Math.ceil((viewportBottom - listTop) / rowH) + buffer
		);
		const curStart = col._vsStart ?? -1;
		const curEnd = col._vsEnd ?? -1;
		if (start === curStart && end === curEnd && col.renderedCards) return false;
		col._vsStart = start;
		col._vsEnd = Math.max(end, start);
		col.renderedCards = col.cards.slice(start, end);
		const topPad = Math.max(0, start * rowH);
		const bottomPad = Math.max(0, (total - end) * rowH);
		col.vsTopStyle = `height:${topPad}px;`;
		col.vsBottomStyle = `height:${bottomPad}px;`;
		return true;
	}

	get virtualScrollLabel() {
		return this.enableVirtualScroll
			? "Disable Virtual Scrolling"
			: "Enable Virtual Scrolling";
	}

	handleToggleVirtualScroll(event) {
		if (event) {
			event.stopPropagation();
		}
		this.enableVirtualScroll = !this.enableVirtualScroll;
		setStorageItem(
			"kanbanVirtualScroll",
			this.enableVirtualScroll ? "true" : "false"
		);
		if (!this.enableVirtualScroll) {
			// Render all cards and clear spacers
			this._columns = this._columns.map((col) => ({
				...col,
				renderedCards: Array.isArray(col.cards) ? col.cards : [],
				vsTopStyle: "height:0px;",
				vsBottomStyle: "height:0px;",
				_vsStart: 0,
				_vsEnd: Array.isArray(col.cards) ? col.cards.length : 0,
			}));
		} else {
			// Reinitialize virtualization slices
			this.initVirtualization();
		}
		this.showSettingsMenu = false;
	}

	// Quick Filter handlers (UX-006)
	handleQuickFilterToggle(event) {
		const filterKey = event.currentTarget.dataset.filterKey;
		if (!filterKey) return;

		// Toggle the filter
		this.quickFilters = {
			...this.quickFilters,
			[filterKey]: !this.quickFilters[filterKey],
		};

		// Apply filters immediately
		this.applyFilters();
	}

	handleClearQuickFilters() {
		this.quickFilters = {
			myTasks: false,
			highPriority: false,
			dueSoon: false,
			overdue: false,
			unassigned: false,
		};
		this.applyFilters();
		showToast(this, "Success", "Quick filters cleared", "success");
	}

	// Apply current filters to the task list
	applyFilters() {
		// Safety check - ensure we have original tasks to filter from
		if (!this._originalTasks || this._originalTasks.length === 0) {
			return;
		}

		// Start with original unfiltered tasks
		let filteredTasks = [...this._originalTasks];

		// Apply team filter
		if (this._filters.teamId && this._filters.teamId !== "") {
			filteredTasks = filteredTasks.filter(
				(task) => task.teamId === this._filters.teamId
			);
		}

		// Apply assignee filter
		if (this._filters.assignedToId && this._filters.assignedToId !== "") {
			filteredTasks = filteredTasks.filter(
				(task) => task.assignedToId === this._filters.assignedToId
			);
		}

		// Apply project filter
		if (this._filters.projectId && this._filters.projectId !== "") {
			filteredTasks = filteredTasks.filter(
				(task) => task.projectId === this._filters.projectId
			);
		}

		// Apply status filters
		if (this._filters.status && this._filters.status.length > 0) {
			filteredTasks = filteredTasks.filter((task) =>
				this._filters.status.includes(task.status)
			);
		}

		// Apply priority filters
		if (this._filters.priority && this._filters.priority.length > 0) {
			filteredTasks = filteredTasks.filter((task) =>
				this._filters.priority.includes(task.priority)
			);
		}

		// Apply date range filter
		if (this._filters.startDate) {
			const startDate = new Date(this._filters.startDate);
			filteredTasks = filteredTasks.filter((task) => {
				const taskDate = new Date(task.createdDate || task.lastModifiedDate);
				return taskDate >= startDate;
			});
		}

		if (this._filters.endDate) {
			const endDate = new Date(this._filters.endDate);
			filteredTasks = filteredTasks.filter((task) => {
				const taskDate = new Date(task.createdDate || task.lastModifiedDate);
				return taskDate <= endDate;
			});
		}

		// Apply Quick Filters (UX-006)
		if (this.quickFilters.myTasks) {
			const currentUserId = this.currentUser?.Id;
			filteredTasks = filteredTasks.filter(
				(task) => task.assignedToId === currentUserId
			);
		}

		if (this.quickFilters.highPriority) {
			filteredTasks = filteredTasks.filter((task) => {
				const priority = (task.priority || "").toLowerCase();
				return (
					priority === "high" ||
					priority === "critical" ||
					priority === "urgent"
				);
			});
		}

		if (this.quickFilters.dueSoon) {
			const today = new Date();
			today.setHours(0, 0, 0, 0);
			const threeDaysFromNow = new Date(
				today.getTime() + 3 * 24 * 60 * 60 * 1000
			);

			filteredTasks = filteredTasks.filter((task) => {
				if (!task.dueDate) return false;
				const dueDate = new Date(task.dueDate);
				dueDate.setHours(0, 0, 0, 0);
				return dueDate >= today && dueDate <= threeDaysFromNow;
			});
		}

		if (this.quickFilters.overdue) {
			const today = new Date();
			today.setHours(0, 0, 0, 0);

			filteredTasks = filteredTasks.filter((task) => {
				if (!task.dueDate) return false;
				const dueDate = new Date(task.dueDate);
				dueDate.setHours(0, 0, 0, 0);
				return dueDate < today;
			});
		}

		if (this.quickFilters.unassigned) {
			filteredTasks = filteredTasks.filter(
				(task) => !task.assignedToId || task.assignedToId === ""
			);
		}

		// Update the current task collection and reorganize columns
		this._allTasks = filteredTasks;
		this.organizeTasksByStatus();
	}

	// Update active filter count for UI indicator
	updateActiveFilterCount() {
		let count = 0;

		Object.keys(this._filters).forEach((key) => {
			const value = this._filters[key];
			if (value && value !== "" && value !== null && value !== undefined) {
				if (Array.isArray(value) && value.length > 0) {
					count++;
				} else if (!Array.isArray(value)) {
					count++;
				}
			}
		});

		this.activeFilterCount = count;
	}

	// Handle filter checkbox selection for status/priority
	handleFilterCheckboxChange(event) {
		// Lightning input checkbox uses event.detail.checked
		const checked = event.detail.checked;

		// Get filter metadata from the lightning-input element's dataset
		const target = event.target;
		const filterType = target.dataset.filterType;
		const filterValue = target.dataset.filterValue;

		if (!filterType || !filterValue) {
			return;
		}

		// Initialize array if needed
		if (!this._filters[filterType]) {
			this._filters[filterType] = [];
		}

		if (checked) {
			// Add to filter array if not already present
			if (!this._filters[filterType].includes(filterValue)) {
				this._filters[filterType] = [...this._filters[filterType], filterValue];
			}
		} else {
			// Remove from filter array
			this._filters[filterType] = this._filters[filterType].filter(
				(item) => item !== filterValue
			);
		}

		this.updateActiveFilterCount();

		// Force re-render of checkbox options to reflect new checked states
		// By reassigning the _filters object, we trigger getters to recompute
		this._filters = { ...this._filters };
	}

	// Update visual states of checkbox items (legacy - may not be needed with reactive getters)
	updateCheckboxItemStates() {
		// This method is now handled reactively via statusFilterOptions and priorityFilterOptions getters
		// which recompute checked state whenever _filters changes
		// Keeping method for potential future use
	}

	// Get filter values for template rendering
	get currentFilters() {
		return this._filters;
	}

	// Check if a filter value is active (used programmatically, not in template)
	isFilterActive(filterType, filterValue) {
		return (
			this._filters[filterType] &&
			this._filters[filterType].includes(filterValue)
		);
	}

	// Get available status options for filtering
	get statusFilterOptions() {
		// Use original tasks if available, otherwise fall back to current tasks
		const tasksToCheck = this._originalTasks || this._allTasks || [];
		const presentStatuses = new Set();
		tasksToCheck.forEach((task) => {
			const s = task && task.status;
			if (s) presentStatuses.add(s);
		});

		// Prefer board column order for sequence, but only include statuses present in dataset
		const inColumnOrder = [];
		const seen = new Set();
		(this._columns || []).forEach((col) => {
			const s = col && col.statusValue;
			if (!s) return;
			// Normalize against mapped card status values
			if (presentStatuses.has(s) && !seen.has(s)) {
				seen.add(s);
				inColumnOrder.push(s);
			}
		});

		// Append any remaining statuses (should be rare) in alpha order
		const leftovers = Array.from(presentStatuses)
			.filter((s) => !seen.has(s))
			.sort();
		const ordered = [...inColumnOrder, ...leftovers];

		return ordered.map((status) => ({
			value: status,
			label: status,
			checked: this._filters.status && this._filters.status.includes(status),
		}));
	}

	// Get available priority options for filtering
	get priorityFilterOptions() {
		const tasksToCheck = this._originalTasks || this._allTasks || [];
		const priorities = new Set();
		tasksToCheck.forEach((task) => {
			if (task.priority) {
				priorities.add(task.priority);
			}
		});

		return Array.from(priorities)
			.sort()
			.map((priority) => ({
				value: priority,
				label: priority,
				checked:
					this._filters.priority && this._filters.priority.includes(priority),
			}));
	}

	// Priority options for form dropdown
	get priorityOptions() {
		return [
			{ label: "High", value: "High" },
			{ label: "Normal", value: "Normal" },
			{ label: "Low", value: "Low" },
		];
	}

	// Status options for form dropdown (board-wide fallback)
	get statusOptions() {
		return this._columns.map((column) => ({
			label: column.title,
			value: column.statusValue,
		}));
	}

	// ==========================
	// COLUMN VISIBILITY (Filters)
	// ==========================
	get columnVisibilityOptions() {
		// Preserve board sequence and labels
		return (this._columns || []).map((c) => ({ label: c.title, value: c.id }));
	}

	get selectedColumnIds() {
		// Columns that are currently expanded (visible)
		return (this._columns || []).filter((c) => !c.isCollapsed).map((c) => c.id);
	}

	handleColumnVisibilityChange(event) {
		const selected = new Set(event?.detail?.value || []);
		// Compute which columns should be collapsed (complement of selected)
		const allIds = new Set((this._columns || []).map((c) => c.id));
		const toCollapse = new Set();
		allIds.forEach((id) => {
			if (!selected.has(id)) toCollapse.add(id);
		});

		// Apply state to columns and collapsedColumns set
		this.collapsedColumns.clear();
		(this._columns || []).forEach((col) => {
			const collapse = toCollapse.has(col.id);
			col.isCollapsed = collapse;
			col.ariaExpanded = collapse ? "false" : "true";
			if (collapse) this.collapsedColumns.add(col.id);
		});

		// Reactivity + persist + update classes
		this._columns = [...this._columns];
		this.saveCollapsedPreferences();
		this.updateColumnClasses();
	}

	// Status options for drawers - now overridden to a fixed UI list
	// (definitions moved earlier in file)

	// Fetch and cache team-specific status options for drawers
	@api async loadTeamStatusOptions(teamId) {
		try {
			if (!teamId) return [];
			if (
				this.teamStatusOptionsByTeamId &&
				this.teamStatusOptionsByTeamId[teamId]
			) {
				return this.teamStatusOptionsByTeamId[teamId];
			}
			const records = await getTeamStatuses(teamId);
			// Client-side guard: filter to only valid task picklist statuses
			const safe = (records || []).filter((s) =>
				isValidStatus(normalizeStatusValue(s.Name))
			);
			const options = safe
				.sort((a, b) => {
					const ao = a.TLG_Order_Number__c ?? 0;
					const bo = b.TLG_Order_Number__c ?? 0;
					if (ao !== bo) return ao - bo;
					const an = (a.TLG_Display_Label__c || a.Name || "").toLowerCase();
					const bn = (b.TLG_Display_Label__c || b.Name || "").toLowerCase();
					return an.localeCompare(bn);
				})
				.map((s) => ({
					label: s.TLG_Display_Label__c || s.Name,
					value: normalizeStatusValue(s.Name),
				}));
			this.teamStatusOptionsByTeamId = {
				...this.teamStatusOptionsByTeamId,
				[teamId]: options,
			};
			return options;
		} catch (e) {
			return [];
		}
	}

	// Category options for form dropdown (derived from raw task data; with sensible defaults)
	get categoryOptions() {
		// Restricted picklist values from metadata for TLG_Category__c
		return [
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
	}

	// Get formatted active filter count text
	get activeFilterCountText() {
		const count = this.activeFilterCount;
		const plural = count > 1 ? "s" : "";
		return `${count} filter${plural} active`;
	}

	// Empty state computed properties
	get hasNoTasks() {
		return (
			!this.isLoading &&
			(!this._rawTasksData || this._rawTasksData.length === 0)
		);
	}

	get hasNoFilterResults() {
		return (
			!this.isLoading &&
			this._rawTasksData &&
			this._rawTasksData.length > 0 &&
			this._allTasks &&
			this._allTasks.length === 0 &&
			this.hasActiveFilters
		);
	}

	get hasLoadError() {
		return !this.isLoading && this.error != null;
	}

	get showEmptyState() {
		return this.hasNoTasks || this.hasNoFilterResults || this.hasLoadError;
	}

	get emptyStateIcon() {
		if (this.hasLoadError) return "utility:error";
		if (this.hasNoFilterResults) return "utility:filterList";
		return "standard:kanban";
	}

	get emptyStateTitle() {
		if (this.hasLoadError) return "Error Loading Tasks";
		if (this.hasNoFilterResults) return "No Tasks Match Filters";
		return "No Tasks Yet";
	}

	get emptyStateMessage() {
		if (this.hasLoadError) {
			return (
				this.error?.body?.message ||
				this.error?.message ||
				"Unable to load tasks. Please try again."
			);
		}
		if (this.hasNoFilterResults) {
			return "Try adjusting your filters or clearing them to see all tasks.";
		}
		return "Get started by creating your first task to track your work.";
	}

	get emptyStateAction() {
		if (this.hasLoadError) return "Refresh Board";
		if (this.hasNoFilterResults) return "Clear Filters";
		return "Create Task";
	}

	// =====================
	// COMMENTS (UI scaffold)
	// =====================
	loadComments(taskId) {
		if (!taskId) return;
		this.isLoadingComments = true;
		getTaskCommentsAsMaps(taskId)
			.then((items) => {
				const mapped = (items || []).map((c) => ({
					id: c.id,
					text: c.text,
					createdByName: c.createdByName,
					createdByPhotoUrl: c.createdByPhotoUrl,
					createdDate: c.createdDate,
					createdDateFormatted: c.createdDate
						? new Date(c.createdDate).toLocaleString()
						: "",
					mentions: c.mentions || [],
				}));
				this.comments = mapped;
				this._announce(
					`${mapped.length} comment${mapped.length === 1 ? "" : "s"} loaded`
				);
			})
			.catch((e) => {
				const msg = e?.body?.message || e?.message || "Failed to load comments";
				showToast(this, "Error", msg, "error");
			})
			.finally(() => {
				this.isLoadingComments = false;
			});
	}

	/**
	 * Start polling for comment updates
	 * @param {String} taskId - Task ID to poll comments for
	 */
	startCommentPolling(taskId) {
		// Stop any existing polling first
		this.stopCommentPolling();

		if (!taskId) return;

		// Set up polling interval
		this._commentPollingInterval = setInterval(() => {
			// Only poll if we have a valid task and are not already loading
			if (this.selectedTaskId && !this.isLoadingComments) {
				this.loadComments(this.selectedTaskId);
			}
		}, this._commentPollingFrequency);
	}

	/**
	 * Stop polling for comment updates
	 */
	stopCommentPolling() {
		if (this._commentPollingInterval) {
			clearInterval(this._commentPollingInterval);
			this._commentPollingInterval = null;
		}
	}

	handleNewCommentChange(event) {
		this.newCommentText = event.detail?.value ?? event.target?.value ?? "";
	}

	@api async handlePostComment() {
		const text = (this.newCommentText || "").trim();
		if (!text) {
			showToast(this, "Info", "Please enter a comment.", "info");
			return;
		}
		try {
			this.isPostingComment = true;
			const payload = {
				text,
				taskId: this.selectedTaskId,
				mentions: this.selectedMentions.map((m) => ({
					userId: m.userId,
					name: m.name,
					username: m.username,
				})),
			};
			const result = await createTaskCommentFromMap(payload);
			const created = {
				id: result?.id,
				text: result?.text || text,
				createdByName: result?.createdByName || "You",
				createdDate: result?.createdDate || new Date().toISOString(),
				createdDateFormatted: result?.createdDate
					? new Date(result.createdDate).toLocaleString()
					: new Date().toLocaleString(),
				mentions: result?.mentions || [],
			};
			this.comments = [created, ...this.comments];
			this.newCommentText = "";
			this.selectedMentions = [];
			this._announce("Comment posted");
			showToast(this, "Success", "Comment posted", "success");
		} catch (e) {
			const msg = e?.body?.message || e?.message || "Failed to post comment";
			showToast(this, "Error", msg, "error");
		} finally {
			this.isPostingComment = false;
		}
	}

	// Mentions search
	handleMentionInput(event) {
		const text = event.target.value || "";
		this.mentionSearchText = text;
		this.mentionResults = [];
		// Call debounced search function
		if (this._debouncedMentionSearch) {
			this._debouncedMentionSearch(text);
		}
	}

	handleSelectMention(event) {
		const id = event.currentTarget?.dataset?.id;
		if (!id) return;
		const found = this.mentionResults.find((m) => m.userId === id);
		if (!found) return;
		if (!this.selectedMentions.some((m) => m.userId === id)) {
			this.selectedMentions = [...this.selectedMentions, found];
		}
		this.mentionSearchText = "";
		this.mentionResults = [];
	}

	handleRemoveMention(event) {
		const id = event.currentTarget?.dataset?.id;
		if (!id) return;
		this.selectedMentions = this.selectedMentions.filter(
			(m) => m.userId !== id
		);
	}

	_announce(message) {
		try {
			const live = this.template.querySelector(".sr-only");
			if (live) {
				live.textContent = message;
			}
		} catch (e) {
			// no-op
		}
	}
}
