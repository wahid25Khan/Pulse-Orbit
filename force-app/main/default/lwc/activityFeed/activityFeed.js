import { refreshApex } from "@salesforce/apex";
import getEnhancedActivity from "@salesforce/apex/ActivityFeedService.getEnhancedActivity";
import getTaskActivity from "@salesforce/apex/ActivityFeedService.getTaskActivity";
import Id from "@salesforce/user/Id";
import { LightningElement, api, track, wire } from "lwc";

export default class ActivityFeed extends LightningElement {
	@api teamId;
	@api taskId; // If provided, show activity for specific task
	@api limitCount = 20;
	@api showHeader = false;
	@api height = "400px";
	@api enableAutoRefresh = false;
	@api refreshInterval = 30000; // 30 seconds

	@track activities = [];
	@track filteredActivities = [];
	@track selectedFilter = "all";
	@track error;
	@track isLoading = true;
	@track lastUpdated;

	wiredActivitiesResult;
	currentUserId = Id;
	refreshIntervalId;

	get containerStyle() {
		return `height: ${this.height}; overflow-y: auto;`;
	}

	get emptyMessage() {
		return this.taskId ? "No activity yet for this task" : "No recent activity";
	}

	get feedTitle() {
		return this.taskId ? "Task Activity" : "Recent Activity";
	}

	// Wire to get enhanced activities
	@wire(getEnhancedActivity, { limitCount: "$limitCount", teamId: "$teamId" })
	wiredActivities(result) {
		if (this.taskId) {
			// Skip wire if we're showing task-specific activity
			return;
		}

		this.wiredActivitiesResult = result;
		const { data, error } = result;

		if (data) {
			this.activities = this.processActivities(data);
			this.applyFilter();
			this.lastUpdated = new Date().toLocaleTimeString();
			this.error = undefined;
			this.isLoading = false;
		} else if (error) {
			this.error = error;
			this.activities = [];
			this.filteredActivities = [];
			this.isLoading = false;
			console.error("Error loading activities:", error);
		}
	}

	// Load task-specific activity if taskId is provided
	connectedCallback() {
		if (this.taskId) {
			this.loadTaskActivity();
		}

		// Setup auto-refresh if enabled
		if (this.enableAutoRefresh && this.refreshInterval > 0) {
			this.startAutoRefresh();
		}
	}

	disconnectedCallback() {
		// Clean up auto-refresh
		this.stopAutoRefresh();
	}

	startAutoRefresh() {
		this.stopAutoRefresh(); // Clear any existing interval
		this.refreshIntervalId = setInterval(() => {
			this.handleRefresh();
		}, this.refreshInterval);
	}

	stopAutoRefresh() {
		if (this.refreshIntervalId) {
			clearInterval(this.refreshIntervalId);
			this.refreshIntervalId = null;
		}
	}

	loadTaskActivity() {
		this.isLoading = true;
		getTaskActivity({ taskId: this.taskId, limitCount: this.limitCount })
			.then((data) => {
				this.activities = this.processActivities(data);
				this.applyFilter();
				this.lastUpdated = new Date().toLocaleTimeString();
				this.error = undefined;
				this.isLoading = false;
			})
			.catch((error) => {
				this.error = error;
				this.activities = [];
				this.filteredActivities = [];
				this.isLoading = false;
				console.error("Error loading task activity:", error);
			});
	}

	processActivities(data) {
		if (!data) return [];

		return data.map((activity) => {
			return {
				...activity,
				activityText: this.buildActivityText(activity),
				iconClass: this.getIconClass(activity),
				timelineClass: "slds-timeline__item_expandable",
			};
		});
	}

	buildActivityText(activity) {
		const userName = activity.userName || "Someone";
		const taskName = activity.taskName || "a task";

		if (activity.actionType === "status_change") {
			return `${userName} moved ${taskName} from ${activity.oldValue} to ${activity.newValue}`;
		} else if (activity.actionType === "assignment_change") {
			const oldUser = activity.oldValue || "unassigned";
			const newUser = activity.newValue || "unassigned";
			return `${userName} reassigned ${taskName} from ${oldUser} to ${newUser}`;
		} else if (activity.actionType === "priority_change") {
			return `${userName} changed priority of ${taskName} from ${activity.oldValue} to ${activity.newValue}`;
		} else if (activity.actionType === "time_logged") {
			return `${userName} logged ${activity.newValue} hours on ${taskName}`;
		} else if (activity.actionType === "due_date_change") {
			return `${userName} changed due date of ${taskName} to ${activity.newValue}`;
		} else if (activity.actionType === "created") {
			return `${userName} created ${taskName}`;
		} else {
			return `${userName} updated ${taskName}`;
		}
	}

	getIconClass(activity) {
		const baseClass = "slds-icon_container";

		switch (activity.iconVariant) {
			case "success":
				return `${baseClass} slds-icon-standard-task slds-timeline__icon_success`;
			case "warning":
				return `${baseClass} slds-icon-standard-task slds-timeline__icon_warning`;
			case "error":
				return `${baseClass} slds-icon-standard-task slds-timeline__icon_error`;
			default:
				return `${baseClass} slds-icon-standard-task`;
		}
	}

	handleRefresh() {
		this.isLoading = true;

		if (this.taskId) {
			this.loadTaskActivity();
		} else if (this.wiredActivitiesResult) {
			return refreshApex(this.wiredActivitiesResult);
		}
	}

	navigateToTask(event) {
		const taskId = event.currentTarget.dataset.taskId;
		if (taskId) {
			// Dispatch custom event for parent to handle navigation
			this.dispatchEvent(
				new CustomEvent("taskselect", {
					detail: { taskId: taskId },
				})
			);
		}
	}

	// Filter functionality
	get filterOptions() {
		return [
			{ label: "All Activity", value: "all" },
			{ label: "Status Changes", value: "status_change" },
			{ label: "Assignments", value: "assignment_change" },
			{ label: "Priority Changes", value: "priority_change" },
			{ label: "Time Logged", value: "time_logged" },
			{ label: "Due Date Changes", value: "due_date_change" },
		];
	}

	handleFilterChange(event) {
		this.selectedFilter = event.detail.value;
		this.applyFilter();
	}

	applyFilter() {
		if (!this.activities || this.activities.length === 0) {
			this.filteredActivities = [];
			return;
		}

		if (this.selectedFilter === "all") {
			this.filteredActivities = [...this.activities];
		} else {
			this.filteredActivities = this.activities.filter(
				(activity) => activity.actionType === this.selectedFilter
			);
		}
	}

	get displayActivities() {
		return this.filteredActivities.length > 0
			? this.filteredActivities
			: this.activities;
	}

	get hasActivities() {
		return this.displayActivities && this.displayActivities.length > 0;
	}

	get showLastUpdated() {
		return this.lastUpdated && this.enableAutoRefresh;
	}
}
