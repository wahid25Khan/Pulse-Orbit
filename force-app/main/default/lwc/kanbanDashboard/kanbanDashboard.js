import getCurrentUserId from "@salesforce/apex/KanbanBoardController.getCurrentUserId";
import getProjects from "@salesforce/apex/KanbanBoardController.getProjects";
import getTasks from "@salesforce/apex/KanbanBoardController.getTasks";
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
  @track customEnd = null;   // yyyy-MM-dd
  @track projectId = "ALL"; // Opportunity Id or 'ALL'
  @track statusScope = "ALL"; // ALL | OPEN | COMPLETED
  projectsById = {};

  connectedCallback() {
    this.loadData();
  }

  renderedCallback() {
    this.applySegmentStyles();
  }

  get computedRootClass() {
    const list = ["dashboard-root", this.isDarkMode ? "dark-mode" : "light-mode"];
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
      { label: "Custom", value: "CUSTOM" }
    ];
  }

  get isCustomDateRange() {
    return this.dateRange === "CUSTOM";
  }

  get statusScopeOptions() {
    return [
      { label: "All statuses", value: "ALL" },
      { label: "Open only", value: "OPEN" },
      { label: "Completed only", value: "COMPLETED" }
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
      const name = this.projectsById && this.projectsById[id] ? this.projectsById[id] : `Project ${String(id).slice(-6)}`;
      opts.push({ label: name, value: id });
    });
    // Sort by label
    opts.sort((a, b) => (a.value === "ALL" ? -1 : b.value === "ALL" ? 1 : a.label.localeCompare(b.label)));
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
      if (this.dateRange === "7" || this.dateRange === "30" || this.dateRange === "90") {
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
    const inProgress = tasks.filter((t) => (t.TLG_Status__c || "").toLowerCase() === "in progress").length;
    const completed = tasks.filter((t) => {
      const s = (t.TLG_Status__c || "").toLowerCase();
      return s === "completed" || s === "done";
    }).length;
    const mine = this.currentUserId ? tasks.filter((t) => t.TLG_Assigned_To__c === this.currentUserId).length : 0;
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
    const palette = ["#60a5fa", "#f59e0b", "#34d399", "#f87171", "#a78bfa", "#fbbf24", "#22d3ee"];
    let i = 0;
    const segments = [];
    for (const [label, count] of byStatus.entries()) {
      const pct = Math.round((count / total) * 100);
      const color = palette[i % palette.length];
      i++;
      segments.push({ label, count, pct, title: `${label}: ${count} (${pct}%)`, color });
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
    const palette = ["#ef4444", "#f59e0b", "#22c55e", "#3b82f6", "#8b5cf6", "#ec4899", "#10b981"];
    let i = 0;
    const segments = [];
    for (const [label, count] of byPriority.entries()) {
      const pct = Math.round((count / total) * 100);
      const color = palette[i % palette.length];
      i++;
      segments.push({ label, count, pct, title: `${label}: ${count} (${pct}%)`, color });
    }
    // Common priority ordering if present
    const order = ["Critical", "High", "Medium", "Low", "Unspecified"];
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

  applySegmentStyles() {
    // Update status segments width and color from data attributes
    const segEls = this.template.querySelectorAll(".status-segment");
    segEls.forEach((el) => {
      const pct = parseInt(el.dataset.pct, 10);
      const color = el.dataset.color || "#d1d5db";
      const width = Number.isFinite(pct) ? Math.max(pct, 1) + "%" : "0%";
      el.style.width = width;
      el.style.background = color;
    });

    // Update priority segments
    const prEls = this.template.querySelectorAll(".priority-segment");
    prEls.forEach((el) => {
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
}
