import { LightningElement, track, api } from "lwc";
import { loadStyle } from "lightning/platformResourceLoader";
import hidePageHeaderCSS from "@salesforce/resourceUrl/hidePageHeader";
import getTasks from "@salesforce/apex/KanbanBoardController.getTasks";
import getAssignableUsers from "@salesforce/apex/KanbanBoardController.getAssignableUsers";
import getProjects from "@salesforce/apex/KanbanBoardController.getProjects";
import getTeamStatuses from "@salesforce/apex/KanbanBoardController.getTeamStatuses";
import getTeamFromTasks from "@salesforce/apex/KanbanBoardController.getTeamFromTasks";
import moveTask from "@salesforce/apex/KanbanBoardController.moveTask";
import getCurrentUserId from "@salesforce/apex/KanbanBoardController.getCurrentUserId";
import saveUserPreferences from "@salesforce/apex/KanbanBoardController.saveUserPreferences";
import getUserPreferences from "@salesforce/apex/KanbanBoardController.getUserPreferences";
import getStatusColors from "@salesforce/apex/KanbanBoardController.getStatusColors";
import { KanbanPerformanceService } from "./kanbanPerformanceService";
import { KanbanDataService } from "./kanbanDataService";
import { showToast } from "c/toastHelper";
import { normalizeStatusValue } from "c/statusHelper";

export default class KanbanBoard extends LightningElement {
  @track _columns = [];
  @track isLoading = false;
  @track error = null;
  @track currentUser = null;
  @track _movingCardIds = new Set(); // Track cards being moved

  @track _projects = [];
  @track users = [];

  @track selectedTeamId = "";
  @track selectedAssignedToId = "";
  @track selectedProjectId = "";
  @track startDate = "";
  @track endDate = "";
  @track teamOptions = [];
  @track assignableUsersOptions = [];
  @track projectOptions = [];
  @track showFilterDrawer = false;
  @track activeFilterCount = 0;
  @track showSettingsMenu = false;
  @track collapsedColumns = new Set(); // Track which columns are collapsed by ID

  @api isDarkMode = false;
  @api timeLogModalActive = false;

  defaultMaxExpandedColumns = 8;
  maxExpandedColumnsSetting = null;
  autoCollapseNoticeShown = false;

  // Internal state for drag and filters
  _draggedCardId = null;
  _filters = {};
  _originalTasks = null; // Store original unfiltered tasks
  _allTasks = []; // Current (possibly filtered) task collection
  _rawTasksData = []; // Raw Salesforce task data for re-processing

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
    return `${teamColumns.length} column${teamColumns.length !== 1 ? "s" : ""} using custom order`;
  }

  connectedCallback() {
    // Load CSS to hide page header
    loadStyle(this, hidePageHeaderCSS).catch((error) => {
      console.error("Error loading hidePageHeader CSS", error);
    });

    // Load initial board data
    this.loadInitialData();

    // Add click outside listener for settings menu
    this.handleDocumentClick = this.handleDocumentClick.bind(this);
    document.addEventListener("click", this.handleDocumentClick);

    // Theme is controlled by parent layout via @api isDarkMode
    // (Removed localStorage and system preference handling to avoid conflicts)
  }

  disconnectedCallback() {
    // Clean up click outside listener
    if (this.handleDocumentClick) {
      document.removeEventListener("click", this.handleDocumentClick);
    }

    // No theme change listeners to clean up (handled by parent)
  }

  renderedCallback() {
    // Apply collapsed styling after render
    this.updateColumnClasses();
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

  async loadInitialData() {
    await this.loadUserPreferences();
    await this.loadDynamicColors();
    await this.loadBoardData();
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
                    background: linear-gradient(180deg, ${colorCode}, ${this.adjustColor(colorCode, -10)});
                    border-bottom: 2px solid ${this.adjustColor(colorCode, -20)};
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
    const container = this.template.querySelector(".kanban-container");
    if (container) {
      container.appendChild(styleElement);
    }
  }

  // Helper function to adjust color brightness
  adjustColor(color, percent) {
    // Convert hex to RGB
    const num = parseInt(color.replace("#", ""), 16);
    const r = Math.max(0, Math.min(255, ((num >> 16) & 0xff) + percent));
    const g = Math.max(0, Math.min(255, ((num >> 8) & 0xff) + percent));
    const b = Math.max(0, Math.min(255, (num & 0xff) + percent));

    // Convert back to hex
    return "#" + ((r << 16) | (g << 8) | b).toString(16).padStart(6, "0");
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
      // Get current user ID first
      const currentUserId = await this.getCurrentUserId();

      // Load tasks for current user by default across all projects
      const [tasksData, usersData, projectsData] = await Promise.all([
        getTasks({
          searchTerm: "",
          status: "",
          priority: "",
          assignedTo: currentUserId, // Default to current user
          team: "",
          opportunityId: ""
        }),
        getAssignableUsers(),
        getProjects()
      ]);

      // Handle data safely with fallbacks
      this._projects = (projectsData || []).map((p) => ({
        id: p.Id,
        name: p.Name
      }));
      this.projectOptions = this._projects.map((p) => ({
        label: p.name,
        value: p.id
      }));
      this.users = usersData || [];
      this.assignableUsersOptions = this.users.map((u) => ({
        label: u.Name,
        value: u.Id
      }));

      // Set default filter to current user
      this.selectedAssignedToId = currentUserId;

      // Get team from tasks and load team-specific statuses
      const safeTasksData = tasksData || [];
      const localColumns = await this.createDefaultStatusColumns(); // Use default key statuses
      this.processAndSetData(localColumns, safeTasksData);
    } catch (error) {
      this.error = error;
      showToast(
        this,
        "Error",
        "Failed to load initial board data: " +
          (error.body?.message || error.message),
        "error"
      );

      // Try to load with default columns as fallback
      try {
        const defaultColumns = this.createDefaultStatusColumns();
        this.processAndSetData(defaultColumns, []);
      } catch (fallbackError) {
        // Fallback failed - board will show empty state
      }
    } finally {
      this.isLoading = false;
    }
  }

  async getCurrentUserId() {
    // Get current user ID from Apex (works for both portal and internal users)
    try {
      const userId = await getCurrentUserId();
      return userId || "";
    } catch (error) {
      console.error("Error getting current user ID:", error);
      return "";
    }
  }

  createDefaultStatusColumns() {
    // Show only key statuses by default: Not Started, In Progress, Ready for Review, QA, Completed, Closed
    const keyStatuses = [
      "Not Started",
      "In Progress",
      "Ready for Review",
      "QA",
      "Completed",
      "Closed"
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
            return teamStatuses.map((status, index) => {
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
      tooltipTitle: `${displayTitle} • 0`
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
      ["QA", "QA"]
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
      const mapKey = normalizeStatusValue(col.statusValue).toLowerCase();
      columnsMap.set(mapKey, { ...col, cards: [] });
    });

    const cards = tasksData.map((task) => this.mapSalesforceTaskToCard(task));

    // Initialize task collections for filtering
    this._allTasks = [...cards];
    if (!this._originalTasks) {
      // Only set original tasks on first load, preserve them across refreshes
      this._originalTasks = [...cards];
    }

    const nextIndexStart = columnsMap.size;
    const dynamicStatuses = [];
    const dynamicStatusSet = new Set();
    cards.forEach((card) => {
      const statusKey = normalizeStatusValue(card.status);
      const mapKey = statusKey.toLowerCase();
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
      const mapKey = column.statusValue.toLowerCase();
      columnsMap.set(mapKey, column);
    });

    cards.forEach((card) => {
      const statusKey = normalizeStatusValue(card.status).toLowerCase();
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
      const mapKey = normalizeStatusValue(col.statusValue).toLowerCase();
      columnsMap.set(mapKey, col);
    });

    // Distribute current tasks into columns
    const dynamicColumns = [];
    this._allTasks.forEach((card) => {
      const statusKey = normalizeStatusValue(card.status).toLowerCase();
      let targetColumn = columnsMap.get(statusKey);

      // If column doesn't exist for this status, create it dynamically
      if (!targetColumn) {
        const nextIndex = this._columns.length + dynamicColumns.length;
        targetColumn = this.createColumnConfig(
          card.status,
          nextIndex,
          "dynamic"
        );
        const mapKey = normalizeStatusValue(
          targetColumn.statusValue
        ).toLowerCase();
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
        ? new Date(task.TLG_Due_Date__c).toISOString().split("T")[0]
        : null,
      priority: task.TLG_Priority__c || "Medium",
      status: statusValue,

      // Project/Opportunity fields
      projectId: task.TLG_Opportunity__c,
      projectName: this.getProjectNameById(task.TLG_Opportunity__c),

      // Team and assignment fields for filtering
      teamId: task.TLG_Team__c,
      assignedToId: task.TLG_Assigned_To__c,

      // Date fields for filtering
      createdDate: task.CreatedDate,
      lastModifiedDate: task.LastModifiedDate,

      // Additional metadata
      assignees: [],
      comments: [],
      attachments: []
    };
  }

  getProjectNameById(projectId) {
    if (!projectId) return "";
    const project = this._projects.find((p) => p.id === projectId);
    return project ? project.name : "";
  }

  handleOpenNewTaskDrawer() {
    this.dispatchEvent(
      new CustomEvent("taskcreate", {
        detail: {},
        bubbles: true,
        composed: true
      })
    );
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

    this.dispatchEvent(
      new CustomEvent("taskcreate", {
        detail: {
          columnStatus,
          defaultProjectId
        },
        bubbles: true,
        composed: true
      })
    );
  }

  handleCardClick(event) {
    const cardId = event.currentTarget.dataset.id;
    let taskData = null;
    for (const column of this._columns) {
      taskData = column.cards.find((card) => card.Id === cardId);
      if (taskData) break;
    }

    if (taskData) {
      this.dispatchEvent(
        new CustomEvent("taskview", { detail: { task: taskData } })
      );
    }
  }

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
        currentTarget: { dataset: { columnId } }
      });
    }
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

      this.collapsedColumns.delete(columnId);
      column.isCollapsed = false;
      column.ariaExpanded = "true";
    } else {
      this.collapsedColumns.add(columnId);
      column.isCollapsed = true;
      column.ariaExpanded = "false";
    }

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
        const isCollapsed = columnEl.dataset.collapsed === "true";

        if (isCollapsed) {
          columnEl.classList.add("collapsed");
        } else {
          columnEl.classList.remove("collapsed");
        }
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
      if (column.isCollapsed) {
        return;
      }

      expandedCount += 1;
      if (expandedCount > limit) {
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
    this.loadInitialData();
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
    // Show helpful guidance for setting up team statuses
    const message =
      "To use team-specific statuses: 1) Assign teams to your tasks, 2) Create TLG_Team_Status__c records with Name, Display Label, and Order Number fields. Currently using default columns.";
    showToast(this, "Info", message, "info");
    this.showSettingsMenu = false;
  }

  handleReorderColumns(event) {
    event.stopPropagation();
    showToast(
      this,
      "Info",
      "Column Reordering feature coming soon! Currently set order numbers in team status records (10, 20, 30, etc.).",
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

  // Display Options Actions
  handleToggleDarkMode(event) {
    event.stopPropagation();
    // Delegate theme toggle to parent layout so the entire app updates
    const newDarkMode = !this.isDarkMode;
    this.dispatchEvent(
      new CustomEvent("themetoggle", {
        detail: { isDarkMode: newDarkMode },
        bubbles: true
      })
    );
    this.showSettingsMenu = false;
  }

  handleCompactView(event) {
    event.stopPropagation();
    showToast(this, "Info", "Compact View feature coming soon!", "info");
    this.showSettingsMenu = false;
  }

  handleResetLayout() {
    // Reset any layout customizations
    this.collapsedColumns.clear(); // Also reset collapsed state
    this.saveCollapsedPreferences(); // Save empty state
    this.loadInitialData();
    showToast(this, "Success", "Layout reset successfully", "success");
    this.showSettingsMenu = false;
  }

  handleExpandAllColumns() {
    this.collapsedColumns.clear();
    this._columns = this._columns.map((col) => ({
      ...col,
      isCollapsed: false,
      ariaExpanded: "true"
    }));

    const result = this.enforceAutoCollapseLimit({
      showToastIfCollapsed: true
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
      this.isDarkMode ? "dark-mode" : "light-mode"
    ];
    if (this.timeLogModalActive) {
      classes.push("time-log-modal-active");
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
      isCollapsed: col.isCollapsed
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
    this.loadInitialData();
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

  // Expose columns to template
  get columns() {
    return this._columns;
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
    if (!cardId) return;

    const targetColumnId = zone ? zone.dataset.columnId : null;
    if (!targetColumnId) return;

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
      // Same column - just reorder visually, no server update needed
      targetCol.cards.push(movedCard);
      this.updateColumnCounts(targetCol);
      this._columns = [...this._columns];
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

  // Bubble time log requests up to layout
  handleTimeLogRequest(event) {
    this.dispatchEvent(
      new CustomEvent("timelogrequest", {
        detail: event.detail,
        bubbles: true,
        composed: true
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
      endDate: "endDate"
    };

    const filterKey = filterKeyMap[name] || name;

    // Update the _filters object
    this._filters[filterKey] = value;

    // Also update legacy state properties for backward compatibility with template bindings
    if (name === "team") {
      this.selectedTeamId = value;
    } else if (name === "assignedTo") {
      this.selectedAssignedToId = value;
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
    this.applyFilters();
    this.showFilterDrawer = false;
    showToast(this, "Success", "Filters applied successfully", "success");
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

    // Reset Lightning component values
    // Lightning components will reflect changes via their bound properties above
    // No need to manually manipulate DOM for Lightning components

    // Apply the cleared filters (shows all tasks)
    this.applyFilters();

    showToast(this, "Success", "All filters cleared", "success");
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
    const statuses = new Set();
    tasksToCheck.forEach((task) => {
      if (task.status) {
        statuses.add(task.status);
      }
    });

    // Return array of objects with value and checked state for template binding
    return Array.from(statuses)
      .sort()
      .map((status) => ({
        value: status,
        label: status,
        checked: this._filters.status && this._filters.status.includes(status)
      }));
  }

  // Get available priority options for filtering
  get priorityFilterOptions() {
    const priorities = ["High", "Medium", "Low"];
    return priorities.map((priority) => ({
      value: priority,
      label: priority,
      checked:
        this._filters.priority && this._filters.priority.includes(priority)
    }));
  }

  // Priority options for form dropdown
  get priorityOptions() {
    return [
      { label: "High", value: "High" },
      { label: "Medium", value: "Medium" },
      { label: "Low", value: "Low" }
    ];
  }

  // Status options for form dropdown
  get statusOptions() {
    return this._columns.map((column) => ({
      label: column.status,
      value: column.status
    }));
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
    return "utility:kanban";
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
}