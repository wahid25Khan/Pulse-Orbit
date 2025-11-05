import getTasks from "@salesforce/apex/KanbanBoardController.getTasks";
import { api, LightningElement, track, wire } from "lwc";

const VIEW_MODES = {
	DAY: "day",
	WEEK: "week",
	MONTH: "month",
	YEAR: "year",
};

const GROUP_MODES = {
	CATEGORY: "TLG_Category__c",
	STATUS: "Status__c",
	TEAM: "TLG_Team__c",
	ASSIGNEE: "TLG_Assigned_To__c",
};

// Vibrant gradient colors matching the desired design
const COLORS = [
	"linear-gradient(90deg, #3b82f6 0%, #60a5fa 100%)", // Blue
	"linear-gradient(90deg, #10b981 0%, #34d399 100%)", // Green
	"linear-gradient(90deg, #ec4899 0%, #f472b6 100%)", // Pink
	"linear-gradient(90deg, #8b5cf6 0%, #a78bfa 100%)", // Purple
	"linear-gradient(90deg, #f59e0b 0%, #fbbf24 100%)", // Amber
	"linear-gradient(90deg, #ef4444 0%, #f87171 100%)", // Red
];

export default class TaskTimeline extends LightningElement {
	@api groupBy = GROUP_MODES.CATEGORY;
	@api tasks = [];
	@track lanes = [];
	@track ticks = [];
	@track isEmpty = false;

	@track view = VIEW_MODES.DAY;
	@track selectedDate = new Date();
	@track startHour = 21; // Default to 21:00 for demo data
	@track endHour = 24; // Default to 24:00 for demo data
	@track groupMode = GROUP_MODES.CATEGORY;

	useDemoData = true; // Enable demo data by default (not @api to avoid default=false restriction)

	_tasks = [];
	_colorMap = new Map();
	_colorIndex = 0;

	get viewVariantDay() {
		return this.view === VIEW_MODES.DAY ? "brand" : "base";
	}

	get viewVariantWeek() {
		return this.view === VIEW_MODES.WEEK ? "brand" : "base";
	}

	get viewVariantMonth() {
		return this.view === VIEW_MODES.MONTH ? "brand" : "base";
	}

	get viewVariantYear() {
		return this.view === VIEW_MODES.YEAR ? "brand" : "base";
	}

	get groupVariantCategory() {
		return this.groupMode === GROUP_MODES.CATEGORY ? "brand" : "base";
	}

	get groupVariantStatus() {
		return this.groupMode === GROUP_MODES.STATUS ? "brand" : "base";
	}

	get groupVariantTeam() {
		return this.groupMode === GROUP_MODES.TEAM ? "brand" : "base";
	}

	get groupVariantAssignee() {
		return this.groupMode === GROUP_MODES.ASSIGNEE ? "brand" : "base";
	}

	get selectedDateISO() {
		const d = new Date(this.selectedDate);
		return d.toISOString().split("T")[0];
	}

	get dateDisplay() {
		const options = {
			weekday: "short",
			month: "short",
			day: "numeric",
			year: "numeric",
		};
		const d = new Date(this.selectedDate);
		return d.toLocaleDateString("en-US", options).toUpperCase();
	}

	get startHourDisplay() {
		return `${String(this.startHour).padStart(2, "0")}:00`;
	}

	get endHourDisplay() {
		const hour = this.endHour === 24 ? 0 : this.endHour;
		return `${String(hour).padStart(2, "0")}:00`;
	}

	// Show a vertical "now" marker only on Day view when viewing today within range
	get showNowMarker() {
		if (this.view !== VIEW_MODES.DAY) return false;
		const today = new Date();
		const sel = new Date(this.selectedDate);
		const isSameDay =
			today.getFullYear() === sel.getFullYear() &&
			today.getMonth() === sel.getMonth() &&
			today.getDate() === sel.getDate();
		if (!isSameDay) return false;
		const hr = today.getHours();
		return hr >= this.startHour && hr <= this.endHour;
	}

	// Percentage position (0-100%) of the current time between startHour and endHour
	get nowPercent() {
		const totalMinutes = Math.max(1, (this.endHour - this.startHour) * 60);
		const now = new Date();
		let minutesInto = (now.getHours() - this.startHour) * 60 + now.getMinutes();
		minutesInto = Math.max(0, Math.min(totalMinutes, minutesInto));
		const pct = (minutesInto / totalMinutes) * 100;
		return `${pct}%`;
	}

	// Handle tasks property changes
	connectedCallback() {
		console.log(
			"TaskTimeline connectedCallback - tasks received:",
			this.tasks?.length || 0
		);
		console.log("TaskTimeline useDemoData:", this.useDemoData);

		// Use demo data if enabled or if no tasks provided
		if (this.useDemoData || !this.tasks || this.tasks.length === 0) {
			console.log("Using demo data for timeline visualization");
			this._tasks = this._generateDemoTasks();
		} else {
			this._tasks = this.tasks || [];
		}

		this._buildTimeline();
	}

	_generateDemoTasks() {
		return [
			{
				Id: "demo-1",
				Name: "Meeting",
				TLG_Category__c: "Research",
				TLG_Start_Time__c: "21:00",
				TLG_End_Time__c: "22:00",
				progress: 60,
				assignedToName: "John Doe",
			},
			{
				Id: "demo-2",
				Name: "Testing",
				TLG_Category__c: "Phase 2.6 QA",
				TLG_Start_Time__c: "21:30",
				TLG_End_Time__c: "22:50",
				progress: 47,
				assignedToName: "Jane Smith",
			},
			{
				Id: "demo-3",
				Name: "Landing page",
				TLG_Category__c: "UI Design",
				TLG_Start_Time__c: "21:20",
				TLG_End_Time__c: "23:00",
				progress: 55,
				assignedToName: "Bob Johnson",
			},
			{
				Id: "demo-4",
				Name: "Products module",
				TLG_Category__c: "Development",
				TLG_Start_Time__c: "22:20",
				TLG_End_Time__c: "23:50",
				progress: 75,
				assignedToName: "Alice Williams",
			},
		];
	}

	// Watch for tasks property updates
	renderedCallback() {
		if (this.tasks !== this._tasks) {
			console.log(
				"TaskTimeline renderedCallback - tasks updated:",
				this.tasks?.length || 0
			);
			this._tasks = this.tasks || [];
			this._buildTimeline();
		}
	}

	@wire(getTasks, { filterDate: "$selectedDateISO" })
	wiredTasks({ data, error }) {
		// Fallback to wire if no tasks passed as property
		if (!this.tasks || this.tasks.length === 0) {
			if (data) {
				this._tasks = data || [];
				this._buildTimeline();
			} else if (error) {
				console.error("Error fetching tasks:", error);
				this._tasks = [];
				this._buildTimeline();
			}
		}
	}

	handleDateChange(e) {
		const newDate = new Date(e.target.value);
		this.selectedDate = newDate;
		this._buildTimeline();
	}

	handleViewDay() {
		this.view = VIEW_MODES.DAY;
		this._buildTimeline();
	}

	handleViewWeek() {
		this.view = VIEW_MODES.WEEK;
		this._buildTimeline();
	}

	handleViewMonth() {
		this.view = VIEW_MODES.MONTH;
		this._buildTimeline();
	}

	handleViewYear() {
		this.view = VIEW_MODES.YEAR;
		this._buildTimeline();
	}

	handleGroupByCategory() {
		this.groupMode = GROUP_MODES.CATEGORY;
		this._buildTimeline();
	}

	handleGroupByStatus() {
		this.groupMode = GROUP_MODES.STATUS;
		this._buildTimeline();
	}

	handleGroupByTeam() {
		this.groupMode = GROUP_MODES.TEAM;
		this._buildTimeline();
	}

	handleGroupByAssignee() {
		this.groupMode = GROUP_MODES.ASSIGNEE;
		this._buildTimeline();
	}

	handleStartHourChange(e) {
		const val = e.target.value.replace(/\D/g, "");
		const hour = Math.min(23, Math.max(0, parseInt(val, 10) || 0));
		this.startHour = hour;
		if (this.startHour >= this.endHour) {
			this.endHour = Math.min(23, this.startHour + 1);
		}
		this._buildTimeline();
	}

	handleEndHourChange(e) {
		const val = e.target.value.replace(/\D/g, "");
		const hour = Math.min(23, Math.max(0, parseInt(val, 10) || 0));
		this.endHour = hour;
		if (this.endHour <= this.startHour) {
			this.startHour = Math.max(0, this.endHour - 1);
		}
		this._buildTimeline();
	}

	_buildTimeline() {
		console.log("_buildTimeline called with tasks:", this._tasks?.length || 0);

		if (!this._tasks || this._tasks.length === 0) {
			console.warn("No tasks available for timeline");
			this.isEmpty = true;
			this.lanes = [];
			this.ticks = [];
			return;
		}

		this._colorMap.clear();
		this._colorIndex = 0;

		if (this.view === VIEW_MODES.DAY) {
			this._buildDayView();
		} else if (this.view === VIEW_MODES.WEEK) {
			this._buildWeekView();
		} else if (this.view === VIEW_MODES.MONTH) {
			this._buildMonthView();
		} else if (this.view === VIEW_MODES.YEAR) {
			this._buildYearView();
		}

		console.log(
			"Timeline built - lanes:",
			this.lanes?.length || 0,
			"isEmpty:",
			this.isEmpty
		);
		this.isEmpty = this.lanes.length === 0;
	}

	_buildDayView() {
		this._buildTicks(1); // 1-hour intervals
		const groupMap = new Map();

		this._tasks.forEach((task, index) => {
			// Create a mutable copy of the task to avoid proxy errors
			let processedTask = { ...task };

			// Create sample time data if not present - more realistic distribution
			if (!processedTask.TLG_Start_Time__c || !processedTask.TLG_End_Time__c) {
				// Generate sample start/end times distributed across the visible range
				const hourRange = this.endHour - this.startHour;
				const startOffset = Math.floor((index * 2) % (hourRange - 2)); // Offset within range
				const startHour = this.startHour + startOffset;
				const duration = 1 + Math.floor(Math.random() * 3); // 1-3 hours duration
				const endHour = Math.min(this.endHour, startHour + duration);

				const startMinute = Math.floor(Math.random() * 6) * 10; // 0, 10, 20, 30, 40, 50
				const endMinute = Math.floor(Math.random() * 6) * 10;

				processedTask.TLG_Start_Time__c = `${startHour
					.toString()
					.padStart(2, "0")}:${startMinute.toString().padStart(2, "0")}`;
				processedTask.TLG_End_Time__c = `${endHour
					.toString()
					.padStart(2, "0")}:${endMinute.toString().padStart(2, "0")}`;
			}

			// Ensure task has progress
			if (
				!processedTask.TLG_Progress__c &&
				!processedTask.Progress__c &&
				!processedTask.progress
			) {
				processedTask.progress = 30 + Math.floor(Math.random() * 60); // 30-90%
			}

			// Better grouping key resolution
			const groupKey =
				processedTask[this.groupMode] ||
				processedTask.TLG_Category__c ||
				processedTask.category ||
				processedTask.Category__c ||
				processedTask.Status__c ||
				processedTask.status ||
				"(Ungrouped)";

			if (!groupMap.has(groupKey)) {
				groupMap.set(groupKey, []);
			}
			groupMap.get(groupKey).push(processedTask);
		});

		this.lanes = Array.from(groupMap).map(([key, tasks]) => ({
			id: key,
			label: key,
			bars: this._buildBars(tasks),
		}));

		console.log(
			"Day view built - groups:",
			Array.from(groupMap.keys()),
			"lanes:",
			this.lanes.length
		);
	}

	_buildWeekView() {
		this._buildTicks(6); // 6-hour intervals for week
		const groupMap = new Map();

		this._tasks.forEach((task) => {
			if (!task.TLG_Start_Time__c || !task.TLG_End_Time__c) return;

			const groupKey = task[this.groupMode] || "(Ungrouped)";
			if (!groupMap.has(groupKey)) {
				groupMap.set(groupKey, []);
			}
			groupMap.get(groupKey).push(task);
		});

		this.lanes = Array.from(groupMap).map(([key, tasks]) => ({
			id: key,
			label: key,
			bars: this._buildBars(tasks, true),
		}));
	}

	_buildMonthView() {
		this._buildTicks(24, true); // Day intervals for month
		const groupMap = new Map();

		this._tasks.forEach((task) => {
			if (!task.TLG_Start_Time__c || !task.TLG_End_Time__c) return;

			const groupKey = task[this.groupMode] || "(Ungrouped)";
			if (!groupMap.has(groupKey)) {
				groupMap.set(groupKey, []);
			}
			groupMap.get(groupKey).push(task);
		});

		this.lanes = Array.from(groupMap).map(([key, tasks]) => ({
			id: key,
			label: key,
			bars: this._buildBars(tasks, true),
		}));
	}

	_buildYearView() {
		// Year view: monthly bars
		const groupMap = new Map();
		this._buildTicks(12, false, true); // Month-level ticks

		this._tasks.forEach((task) => {
			if (!task.TLG_Start_Time__c || !task.TLG_End_Time__c) return;

			const groupKey = task[this.groupMode] || "(Ungrouped)";
			if (!groupMap.has(groupKey)) {
				groupMap.set(groupKey, []);
			}
			groupMap.get(groupKey).push(task);
		});

		this.lanes = Array.from(groupMap).map(([key, tasks]) => ({
			id: key,
			label: key,
			bars: tasks.map((task, idx) => this._buildSingleBar(task, idx, true)),
		}));
	}

	_buildTicks(interval = 1, isMonthly = false, isYearly = false) {
		this.ticks = [];

		if (isYearly) {
			const months = [
				"Jan",
				"Feb",
				"Mar",
				"Apr",
				"May",
				"Jun",
				"Jul",
				"Aug",
				"Sep",
				"Oct",
				"Nov",
				"Dec",
			];
			for (let i = 0; i < 12; i++) {
				this.ticks.push({
					key: `tick-${i}`,
					label: months[i],
					percent: `${(i / 12) * 100}%`,
				});
			}
		} else if (isMonthly) {
			for (let d = 1; d <= 31; d += 5) {
				this.ticks.push({
					key: `tick-${d}`,
					label: `${d}`,
					percent: `${((d - 1) / 30) * 100}%`,
				});
			}
		} else {
			for (let h = this.startHour; h <= this.endHour; h += interval) {
				this.ticks.push({
					key: `tick-${h}`,
					label: `${String(h).padStart(2, "0")}:00`,
					percent: `${
						((h - this.startHour) / (this.endHour - this.startHour)) * 100
					}%`,
				});
			}
		}
	}

	_buildBars(tasks, isExtended = false) {
		return tasks
			.map((task, idx) => this._buildSingleBar(task, idx, isExtended))
			.filter(Boolean);
	}

	_buildSingleBar(task, index, isExtended = false) {
		let position, width, startTime, endTime;

		if (isExtended) {
			// For week/month views, all tasks span across the view
			position = index * 15; // Offset each task vertically
			width = 85; // Approximate width for extended views
		} else {
			// For day view, calculate position and width based on time
			startTime = this._parseTime(task.TLG_Start_Time__c);
			endTime = this._parseTime(task.TLG_End_Time__c);

			if (startTime === null || endTime === null) {
				return null;
			}

			const totalMinutes = (this.endHour - this.startHour) * 60;
			const startMinutes =
				(startTime.hours - this.startHour) * 60 + startTime.minutes;
			const durationMinutes =
				(endTime.hours - startTime.hours) * 60 +
				(endTime.minutes - startTime.minutes);

			position = (startMinutes / totalMinutes) * 100;
			width = (durationMinutes / totalMinutes) * 100;

			// Skip tasks outside the visible time range
			if (position + width < 0 || position > 100) {
				return null;
			}

			position = Math.max(0, position);
			width = Math.min(100 - position, width);
		}

		const laneKey =
			task[this.groupMode] ||
			task.TLG_Category__c ||
			task.category ||
			"(Ungrouped)";
		const colorKey = `${laneKey}`;
		if (!this._colorMap.has(colorKey)) {
			this._colorMap.set(colorKey, COLORS[this._colorIndex % COLORS.length]);
			this._colorIndex++;
		}

		const avatars = this._buildAvatars(task);

		// Support multiple progress field formats
		const progress =
			task.TLG_Progress__c || task.Progress__c || task.progress || 0;
		const progressLabel = progress ? `${Math.round(progress)}%` : "0%";

		// Support multiple task name formats
		const taskName = task.Name || task.name || task.title || "Untitled Task";

		// Support multiple status formats
		const taskStatus =
			task.Status__c || task.TLG_Status__c || task.status || "No Status";

		return {
			id: task.Id || task.id,
			label: taskName,
			position: `${position}%`,
			width: `${width}%`,
			color: this._colorMap.get(colorKey),
			progressLabel,
			avatars,
			title: `${taskName} (${taskStatus})`,
		};
	}

	_buildAvatars(task) {
		const avatars = [];

		// Add assigned user avatar (support multiple formats)
		if (task.TLG_Assigned_To__r) {
			const user = task.TLG_Assigned_To__r;
			avatars.push({
				key: `avatar-${user.Id}`,
				title: user.Name || "Assigned User",
				hue: this._generateHue(user.Name || user.Id),
				photoUrl: user.SmallPhotoUrl || null,
			});
		} else if (task.assignedToName || task.assignedTo) {
			// Support kanban task format
			const assignedName = task.assignedToName || task.assignedTo;
			avatars.push({
				key: `avatar-${assignedName}`,
				title: assignedName,
				hue: this._generateHue(assignedName),
				photoUrl: task.assignedToPhoto || null,
			});
		}

		// Add team members if available
		if (task.TLG_Team__r) {
			avatars.push({
				key: `avatar-team-${task.TLG_Team__c}`,
				title: task.TLG_Team__r.Name || "Team",
				hue: this._generateHue(task.TLG_Team__c),
				photoUrl: null,
			});
		} else if (task.teamName) {
			// Support kanban task format
			avatars.push({
				key: `avatar-team-${task.teamName}`,
				title: task.teamName,
				hue: this._generateHue(task.teamName),
				photoUrl: null,
			});
		}

		// Add contributors from assignee list if available
		if (task.assignees && Array.isArray(task.assignees)) {
			task.assignees.slice(0, 3).forEach((assignee, index) => {
				const name =
					assignee.name ||
					assignee.fullName ||
					assignee.label ||
					`User ${index}`;
				avatars.push({
					key: `avatar-assignee-${index}`,
					title: name,
					hue: this._generateHue(name),
					photoUrl: assignee.photoUrl || assignee.photo || null,
				});
			});
		}

		return avatars;
	}

	_parseTime(timeString) {
		if (!timeString) return null;

		// Handle both "HH:MM:SS" and "HH:MM" formats
		const parts = timeString.split(":").map((p) => parseInt(p, 10));
		if (parts.length < 2 || isNaN(parts[0]) || isNaN(parts[1])) {
			return null;
		}

		return {
			hours: parts[0],
			minutes: parts[1],
		};
	}

	_generateHue(str) {
		if (!str) return 0;
		let hash = 0;
		for (let i = 0; i < str.length; i++) {
			hash = (hash << 5) - hash + str.charCodeAt(i);
			hash = hash & hash; // Convert to 32-bit integer
		}
		return Math.abs(hash) % 360;
	}
}
