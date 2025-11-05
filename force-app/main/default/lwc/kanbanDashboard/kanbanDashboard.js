import getCurrentUserId from "@salesforce/apex/KanbanBoardController.getCurrentUserId";
import getProjects from "@salesforce/apex/KanbanBoardController.getProjects";
import getTasks from "@salesforce/apex/KanbanBoardController.getTasks";
import { ShowToastEvent } from "lightning/platformShowToastEvent";
import { LightningElement, api, track } from "lwc";

export default class KanbanDashboard extends LightningElement {
	@api isDarkMode = false;
	@track isLoading = true;
	@track error = null;
	@track tasks = [];
	@track currentUserId = null;
	// Filters
	@track filterMine = false;
	@track dateRange = "ALL"; // ALL | 7 | 30 | 90 | CUSTOM
	@track customStart = null; // yyyy-MM-dd
	@track customEnd = null; // yyyy-MM-dd
	@track projectId = "ALL"; // Opportunity Id or 'ALL'
	@track statusScope = "ALL"; // ALL | OPEN | COMPLETED
	projectsById = {};

	connectedCallback() {
		this.loadData();
	}

	handleRefresh() {
		this.loadData();
	}

	get computedRootClass() {
		const list = [
			"dashboard-root",
			this.isDarkMode ? "dark-mode" : "light-mode",
		];
		return list.join(" ");
	}

	async loadData() {
		this.isLoading = true;
		this.error = null;
		try {
			// Fetch current user id (best effort)
			try {
				this.currentUserId = await getCurrentUserId();
			} catch (e) {
				this.currentUserId = null;
			}

			// Fetch tasks; default to all tasks. Filters can be added later.
			const data = await getTasks({});
			this.tasks = Array.isArray(data) ? data : [];

			// Fetch projects to map Id -> Name (used for project filter options labels)
			try {
				const projects = await getProjects();
				this.projectsById = {};
				(projects || []).forEach((p) => {
					this.projectsById[p.Id] = p.Name;
				});
			} catch (e2) {
				this.projectsById = {};
			}
		} catch (e) {
			this.error = e;
			// eslint-disable-next-line no-console
			console.error("Dashboard load failed", e);
		} finally {
			this.isLoading = false;
		}
	}

	// Filter UI
	get dateRangeOptions() {
		return [
			{ label: "All time", value: "ALL" },
			{ label: "Last 7 days", value: "7" },
			{ label: "Last 30 days", value: "30" },
			{ label: "Last 90 days", value: "90" },
			{ label: "Custom", value: "CUSTOM" },
		];
	}

	get isCustomDateRange() {
		return this.dateRange === "CUSTOM";
	}

	get statusScopeOptions() {
		return [
			{ label: "All statuses", value: "ALL" },
			{ label: "Open only", value: "OPEN" },
			{ label: "Completed only", value: "COMPLETED" },
		];
	}

	get projectOptions() {
		// Derive project ids present in current task set for a concise list
		const seen = new Set();
		(this.tasks || []).forEach((t) => {
			if (t.TLG_Opportunity__c) seen.add(t.TLG_Opportunity__c);
		});
		const opts = [{ label: "All projects", value: "ALL" }];
		seen.forEach((id) => {
			const name =
				this.projectsById && this.projectsById[id]
					? this.projectsById[id]
					: `Project ${String(id).slice(-6)}`;
			opts.push({ label: name, value: id });
		});
		// Sort by label
		opts.sort((a, b) =>
			a.value === "ALL"
				? -1
				: b.value === "ALL"
				? 1
				: a.label.localeCompare(b.label)
		);
		return opts;
	}

	handleToggleMine(e) {
		this.filterMine = !!(e && e.detail && e.detail.checked);
	}

	handleDateRangeChange(e) {
		this.dateRange = e.detail && e.detail.value ? e.detail.value : "ALL";
	}

	handleCustomStart(e) {
		this.customStart = e.detail ? e.detail.value : null;
	}

	handleCustomEnd(e) {
		this.customEnd = e.detail ? e.detail.value : null;
	}

	handleProjectChange(e) {
		this.projectId = e.detail && e.detail.value ? e.detail.value : "ALL";
	}

	handleStatusScopeChange(e) {
		this.statusScope = e.detail && e.detail.value ? e.detail.value : "ALL";
	}

	get filteredTasks() {
		const all = this.tasks || [];
		let items = all;
		// Mine vs All
		if (this.filterMine && this.currentUserId) {
			items = items.filter((t) => t.TLG_Assigned_To__c === this.currentUserId);
		}
		// Project filter
		if (this.projectId && this.projectId !== "ALL") {
			items = items.filter((t) => t.TLG_Opportunity__c === this.projectId);
		}
		// Status scope
		if (this.statusScope !== "ALL") {
			items = items.filter((t) => {
				const s = (t.TLG_Status__c || "").toLowerCase();
				const isDone = s === "completed" || s === "done";
				if (this.statusScope === "OPEN") return !isDone;
				if (this.statusScope === "COMPLETED") return isDone;
				return true;
			});
		}
		// Date range (CreatedDate)
		if (this.dateRange !== "ALL") {
			let from = null;
			let to = new Date();
			if (
				this.dateRange === "7" ||
				this.dateRange === "30" ||
				this.dateRange === "90"
			) {
				const days = parseInt(this.dateRange, 10);
				from = new Date(to.getTime() - days * 24 * 60 * 60 * 1000);
			} else if (this.dateRange === "CUSTOM") {
				if (this.customStart) {
					from = new Date(this.customStart + "T00:00:00");
				}
				if (this.customEnd) {
					// End of day
					const end = new Date(this.customEnd + "T23:59:59");
					if (!isNaN(end.getTime())) {
						to = end;
					}
				}
			}
			// If custom selected but no both dates yet, skip filtering
			if (from || this.dateRange !== "CUSTOM") {
				items = items.filter((t) => {
					if (!t.CreatedDate) return true; // include if unknown
					const d = new Date(t.CreatedDate);
					if (isNaN(d.getTime())) return true;
					if (from && d < from) return false;
					if (to && d > to) return false;
					return true;
				});
			}
		}
		return items;
	}

	get dashboardStats() {
		const tasks = this.filteredTasks || [];
		const total = tasks.length;
		const inProgress = tasks.filter(
			(t) => (t.TLG_Status__c || "").toLowerCase() === "in progress"
		).length;
		const completed = tasks.filter((t) => {
			const s = (t.TLG_Status__c || "").toLowerCase();
			return s === "completed" || s === "done";
		}).length;
		const mine = this.currentUserId
			? tasks.filter((t) => t.TLG_Assigned_To__c === this.currentUserId).length
			: 0;
		return { total, inProgress, completed, mine };
	}

	get statusDistribution() {
		const tasks = this.filteredTasks || [];
		if (!tasks.length) return [];
		const byStatus = new Map();
		tasks.forEach((t) => {
			const key = t.TLG_Status__c || "Unknown";
			byStatus.set(key, (byStatus.get(key) || 0) + 1);
		});

		const total = tasks.length;
		// Use CSS variable-backed palette with safe fallbacks
		const palette = [
			"var(--po-status-1, #60a5fa)",
			"var(--po-status-2, #f59e0b)",
			"var(--po-status-3, #34d399)",
			"var(--po-status-4, #f87171)",
			"var(--po-status-5, #a78bfa)",
			"var(--po-status-6, #fbbf24)",
			"var(--po-status-7, #22d3ee)",
		];
		let i = 0;
		const segments = [];
		for (const [label, count] of byStatus.entries()) {
			const pct = Math.round((count / total) * 100);
			const color = palette[i % palette.length];
			const width = Math.max(pct, 1);
			i++;
			segments.push({
				key: `status-${label}`,
				label,
				count,
				pct,
				title: `Click to filter: ${label} (${count} tasks, ${pct}%)`,
				color,
				style: `width: ${width}%; background: ${color};`,
				swatchStyle: `background: ${color};`,
			});
		}
		segments.sort((a, b) => b.count - a.count);
		return segments;
	}

	get priorityDistribution() {
		const tasks = this.filteredTasks || [];
		if (!tasks.length) return [];
		const byPriority = new Map();
		tasks.forEach((t) => {
			const key = t.TLG_Priority__c || "Unspecified";
			byPriority.set(key, (byPriority.get(key) || 0) + 1);
		});

		const total = tasks.length;
		// Distinct palette to differentiate from status
		const palette = [
			"var(--po-priority-critical, #ef4444)",
			"var(--po-priority-high, #f59e0b)",
			"var(--po-priority-normal, #3b82f6)",
			"var(--po-priority-low, #64748b)",
			"var(--po-accent-1, #8b5cf6)",
			"var(--po-accent-2, #ec4899)",
			"var(--po-accent-3, #10b981)",
		];
		let i = 0;
		const segments = [];
		for (const [label, count] of byPriority.entries()) {
			const pct = Math.round((count / total) * 100);
			const color = palette[i % palette.length];
			const width = Math.max(pct, 1);
			i++;
			segments.push({
				key: `priority-${label}`,
				label,
				count,
				pct,
				title: `Click to filter: ${label} (${count} tasks, ${pct}%)`,
				color,
				style: `width: ${width}%; background: ${color};`,
				swatchStyle: `background: ${color};`,
			});
		}
		// Common priority ordering if present
		const order = [
			"Critical",
			"High",
			"Normal",
			"Medium",
			"Low",
			"Unspecified",
		];
		segments.sort((a, b) => {
			const ai = order.indexOf(a.label);
			const bi = order.indexOf(b.label);
			if (ai === -1 && bi === -1) return b.count - a.count;
			if (ai === -1) return 1;
			if (bi === -1) return -1;
			return ai - bi;
		});
		return segments;
	}

	get throughput7() {
		return this.computeThroughputDays(7);
	}

	get throughput30() {
		return this.computeThroughputDays(30);
	}

	computeThroughputDays(days) {
		const now = new Date();
		const from = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
		let count = 0;
		(this.tasks || []).forEach((t) => {
			const completedAt = this.getCompletedAt(t);
			if (completedAt && completedAt >= from && completedAt <= now) {
				count += 1;
			}
		});
		return count;
	}

	getCompletedAt(t) {
		const status = (t.TLG_Status__c || "").toLowerCase();
		const isDone = status === "completed" || status === "done";
		// Prefer explicit completed date if available
		const completedField = t.TLG_Completed_Date__c || t.CompletedDate || null;
		if (completedField) {
			const d = new Date(completedField);
			if (!isNaN(d.getTime())) return d;
		}
		if (isDone) {
			const lm = t.LastModifiedDate || t.SystemModstamp || t.CreatedDate;
			const d = lm ? new Date(lm) : null;
			if (d && !isNaN(d.getTime())) return d;
		}
		return null;
	}

	// UX-011: Interactive chart click handlers
	handleStatusSegmentClick(event) {
		const status = event.currentTarget?.dataset?.status;
		if (!status) return;

		// Dispatch event to parent (kanbanBoard or layout component) to apply filter
		this.dispatchEvent(
			new CustomEvent("chartfilter", {
				detail: {
					filterType: "status",
					filterValue: status,
					filterLabel: `Status: ${status}`,
				},
				bubbles: true,
				composed: true,
			})
		);
	}

	handlePrioritySegmentClick(event) {
		const priority = event.currentTarget?.dataset?.priority;
		if (!priority) return;

		this.dispatchEvent(
			new CustomEvent("chartfilter", {
				detail: {
					filterType: "priority",
					filterValue: priority,
					filterLabel: `Priority: ${priority}`,
				},
				bubbles: true,
				composed: true,
			})
		);
	}

	handleLegendClick(event) {
		const type = event.currentTarget?.dataset?.type;
		const value = event.currentTarget?.dataset?.value;
		if (!type || !value) return;

		this.dispatchEvent(
			new CustomEvent("chartfilter", {
				detail: {
					filterType: type,
					filterValue: value,
					filterLabel: `${type === "status" ? "Status" : "Priority"}: ${value}`,
				},
				bubbles: true,
				composed: true,
			})
		);
	}

	get agingByStatus() {
		const tasks = this.filteredTasks || [];
		if (!tasks.length) return [];
		const groups = new Map();
		const now = new Date();
		tasks.forEach((t) => {
			const status = t.TLG_Status__c || "Unknown";
			const created = t.CreatedDate ? new Date(t.CreatedDate) : null;
			if (!created || isNaN(created.getTime())) return;
			const doneAt = this.getCompletedAt(t) || now;
			const ageMs = Math.max(0, doneAt.getTime() - created.getTime());
			const ageDays = ageMs / (24 * 60 * 60 * 1000);
			if (!groups.has(status)) {
				groups.set(status, { totalDays: 0, count: 0 });
			}
			const g = groups.get(status);
			g.totalDays += ageDays;
			g.count += 1;
		});

		const rows = [];
		for (const [label, g] of groups.entries()) {
			const avg = g.count ? g.totalDays / g.count : 0;
			const avgDays = Math.round(avg * 10) / 10; // 1 decimal
			rows.push({ label, avgDays, count: g.count });
		}
		// Sort by avg descending
		rows.sort((a, b) => b.avgDays - a.avgDays);
		return rows;
	}

	/**
	 * UX-010: Handle export actions (CSV export or print)
	 */
	handleExportAction(event) {
		const action = event.detail.value;
		if (action === "csv") {
			this.exportToCSV();
		} else if (action === "print") {
			this.printDashboard();
		}
	}

	/**
	 * UX-010: Export filtered tasks to CSV
	 */
	exportToCSV() {
		try {
			const tasks = this.filteredTasks || [];
			if (tasks.length === 0) {
				this.dispatchEvent(
					new ShowToastEvent({
						title: "No Data",
						message: "No tasks to export. Try adjusting your filters.",
						variant: "info",
					})
				);
				return;
			}

			// CSV Headers
			const headers = [
				"Task Name",
				"Status",
				"Priority",
				"Assigned To",
				"Due Date",
				"Progress %",
				"Category",
				"Created Date",
			];

			// Build CSV rows
			const rows = tasks.map((task) =>
				[
					this.escapeCsvValue(task.Name || ""),
					this.escapeCsvValue(task.TLG_Status__c || ""),
					this.escapeCsvValue(task.TLG_Priority__c || ""),
					this.escapeCsvValue(task.TLG_Assigned_To__c || ""),
					this.escapeCsvValue(task.TLG_Due_Date__c || ""),
					this.escapeCsvValue(task.Progress__c || "0"),
					this.escapeCsvValue(task.TLG_Category__c || ""),
					this.escapeCsvValue(task.CreatedDate || ""),
				].join(",")
			);

			// Combine headers and rows
			const csvContent = [headers.join(","), ...rows].join("\n");

			// Create download link
			const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
			const link = document.createElement("a");
			const url = URL.createObjectURL(blob);

			link.setAttribute("href", url);
			link.setAttribute(
				"download",
				`kanban_tasks_${new Date().toISOString().split("T")[0]}.csv`
			);
			link.style.visibility = "hidden";
			document.body.appendChild(link);
			link.click();
			document.body.removeChild(link);

			this.dispatchEvent(
				new ShowToastEvent({
					title: "Success",
					message: `Exported ${tasks.length} tasks to CSV`,
					variant: "success",
				})
			);
		} catch (error) {
			this.dispatchEvent(
				new ShowToastEvent({
					title: "Export Failed",
					message: error.message || "Failed to export CSV",
					variant: "error",
				})
			);
		}
	}

	/**
	 * Helper to escape CSV values (handle commas, quotes, newlines)
	 */
	escapeCsvValue(value) {
		if (value === null || value === undefined) return "";
		const stringValue = String(value);
		// If contains comma, quote, or newline, wrap in quotes and escape existing quotes
		if (
			stringValue.includes(",") ||
			stringValue.includes('"') ||
			stringValue.includes("\n")
		) {
			return `"${stringValue.replace(/"/g, '""')}"`;
		}
		return stringValue;
	}

	/**
	 * UX-010: Print dashboard with print-friendly styling
	 */
	printDashboard() {
		// Add print styles dynamically
		const printStyles = `
			<style>
				@media print {
					@page { margin: 0.5in; }
					body * { visibility: hidden; }
					.dashboard-root, .dashboard-root * { visibility: visible; }
					.dashboard-root { 
						position: absolute; 
						left: 0; 
						top: 0; 
						width: 100%;
						background: white !important;
						color: black !important;
					}
					.header-right { display: none !important; }
					.filters-bar { border: 1px solid #ccc; padding: 10px; margin-bottom: 20px; }
					.metric-card, .chart-card { 
						border: 1px solid #ccc !important; 
						page-break-inside: avoid;
						background: white !important;
					}
					.timeline-section { page-break-inside: avoid; }
				}
			</style>
		`;

		// Create a temporary div with print styles
		const printWindow = window.open("", "_blank");
		if (!printWindow) {
			this.dispatchEvent(
				new ShowToastEvent({
					title: "Print Blocked",
					message: "Please allow popups to print the dashboard",
					variant: "warning",
				})
			);
			return;
		}

		printWindow.document.write("<html><head><title>Kanban Dashboard</title>");
		printWindow.document.write(printStyles);
		printWindow.document.write("</head><body>");

		// Clone dashboard content
		const dashboardElement = this.template.querySelector(".dashboard-root");
		if (dashboardElement) {
			printWindow.document.write(dashboardElement.innerHTML);
		}

		printWindow.document.write("</body></html>");
		printWindow.document.close();

		// Wait for content to load, then print
		setTimeout(() => {
			printWindow.print();
			printWindow.close();
		}, 500);
	}

	/**
	 * Handle task selection from activity feed
	 * Dispatches event for parent components to handle navigation
	 */
	handleTaskSelect(event) {
		const taskId = event.detail.taskId;
		if (taskId) {
			// Dispatch custom event for parent to handle
			this.dispatchEvent(
				new CustomEvent("taskselect", {
					detail: { taskId: taskId },
					bubbles: true,
					composed: true,
				})
			);
		}
	}
}
