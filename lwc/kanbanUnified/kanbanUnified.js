import { LightningElement, track, api, wire } from "lwc";
import { loadStyle } from "lightning/platformResourceLoader";
import { ShowToastEvent } from "lightning/platformShowToastEvent";
import getIssues from "@salesforce/apex/KanbanBoardController.getIssues";
import updateIssueStatus from "@salesforce/apex/KanbanBoardController.updateIssueStatus";
import createIssue from "@salesforce/apex/KanbanBoardController.createIssue";
import kanbanResources from "@salesforce/resourceUrl/kanbanResources";

export default class KanbanUnified extends LightningElement {
  // Table-ready rows for template (workaround for LWC computed property limitation)
  get tableRows() {
    return this.issues.map((issue) => {
      const row = { key: issue.Id };
      this.columns.forEach((col) => {
        row[col.fieldName] = issue[col.fieldName];
      });
      return row;
    });
  }

  // Helper for table cell value (LWC templates do not support computed property access)
  getIssueField(issue, field) {
    return issue[field];
  }

  @track issues = [];
  @track filteredIssues = [];
  @track searchTerm = "";
  @track isKanbanView = true;
  @track isLoading = true;
  @track showNewIssueModal = false;
  @track showEditIssueModal = false;
  @track currentIssue = {};
  @track statusOptions = [
    { label: "Backlog", value: "Backlog" },
    { label: "Todo", value: "Todo" },
    { label: "In Progress", value: "In Progress" },
    { label: "Done", value: "Done" },
    { label: "Canceled", value: "Canceled" }
  ];
  @track priorityOptions = [
    { label: "No Priority", value: "No priority" },
    { label: "Low", value: "Low" },
    { label: "Medium", value: "Medium" },
    { label: "High", value: "High" },
    { label: "Critical", value: "Critical" }
  ];
  @api sortBy;
  @api sortDirection = "asc";

  // Table columns for table view
  columns = [
    { label: "ID", fieldName: "Name", sortable: true },
    { label: "Title", fieldName: "Title__c", sortable: true },
    { label: "Description", fieldName: "Description__c", sortable: false },
    { label: "Status", fieldName: "Status__c", sortable: true },
    { label: "Priority", fieldName: "Priority__c", sortable: true },
    { label: "Assignee", fieldName: "Assignee__c", sortable: true },
    { label: "Labels", fieldName: "Labels__c", sortable: false },
    { label: "Component", fieldName: "Component__c", sortable: true },
    { label: "Milestone", fieldName: "Milestone__c", sortable: true },
    { label: "Due Date", fieldName: "DueDate__c", sortable: true },
    { label: "Parent Issue", fieldName: "ParentIssue__c", sortable: false }
  ];

  // Helper for card priority class
  priorityClassFor(issue) {
    switch (issue.Priority__c) {
      case "Critical":
        return "priority-critical";
      case "High":
        return "priority-high";
      case "Medium":
        return "priority-medium";
      case "Low":
        return "priority-low";
      default:
        return "priority-none";
    }
  }

  // Event handlers for template
  toggleView() {
    this.isKanbanView = !this.isKanbanView;
  }

  handleClearFilters() {
    this.searchTerm = "";
    this.filteredIssues = this.issues;
  }

  handleSearchChange(event) {
    this.searchTerm = event.target.value;
    this.filteredIssues = this.issues.filter(
      (issue) =>
        (issue.Name &&
          issue.Name.toLowerCase().includes(this.searchTerm.toLowerCase())) ||
        (issue.Title__c &&
          issue.Title__c.toLowerCase().includes(this.searchTerm.toLowerCase()))
    );
  }

  handleClick(event) {
    event.preventDefault();
    const issueId = event.currentTarget.dataset.id;
    const clickEvent = new CustomEvent("issueclick", {
      detail: { issueId }
    });
    this.dispatchEvent(clickEvent);
  }

  handleDragStart(event) {
    const issueId = event.currentTarget.dataset.id;
    event.dataTransfer.setData("text/plain", issueId);
    const dragEvent = new CustomEvent("dragstart", {
      detail: { issueId }
    });
    this.dispatchEvent(dragEvent);
  }

  handleRowClick(event) {
    const issueId = event.currentTarget.dataset.id;
    const clickEvent = new CustomEvent("issueclick", {
      detail: { issueId }
    });
    this.dispatchEvent(clickEvent);
  }

  // Efficient mapping for Kanban columns
  get issuesByStatus() {
    const map = {};
    this.statusOptions.forEach((opt) => {
      map[opt.value] = this.filteredIssues.filter(
        (issue) => issue.Status__c === opt.value
      );
    });
    return map;
  }

  connectedCallback() {
    Promise.all([loadStyle(this, kanbanResources + "/kanbanStyles.css")])
      .then(() => {
        console.log("Resources loaded");
      })
      .catch((error) => {
        console.error("Error loading resources", error);
      });

    this.loadIssues();
  }

  @wire(getIssues)
  wiredIssues({ error, data }) {
    if (data) {
      this.issues = data;
      this.filteredIssues = data;
      this.categorizeIssues();
    } else if (error) {
      this.showToast("Error", "Error loading issues", "error");
    }
  }

  categorizeIssues() {
    this.backlogIssues = this.filteredIssues.filter(
      (issue) => issue.Status__c === "Backlog"
    );
    this.todoIssues = this.filteredIssues.filter(
      (issue) => issue.Status__c === "Todo"
    );
    this.inProgressIssues = this.filteredIssues.filter(
      (issue) => issue.Status__c === "In Progress"
    );
    this.doneIssues = this.filteredIssues.filter(
      (issue) => issue.Status__c === "Done"
    );
    this.canceledIssues = this.filteredIssues.filter(
      (issue) => issue.Status__c === "Canceled"
    );
  }

  handleSearchChange(event) {
    this.searchTerm = event.target.value;
    this.filteredIssues = this.issues.filter((issue) =>
      issue.Name.toLowerCase().includes(this.searchTerm.toLowerCase())
    );
    this.categorizeIssues();
  }

  handleRowAction(event) {
    const issueId = event.detail.row.Id;
    const clickEvent = new CustomEvent("issueclick", {
      detail: { issueId }
    });
    this.dispatchEvent(clickEvent);
  }

  handleSort(event) {
    const { fieldName: sortBy, sortDirection } = event.detail;
    this.sortBy = sortBy;
    this.sortDirection = sortDirection;
    this.sortData();
  }

  sortData() {
    const sortBy = this.sortBy;
    const sortDirection = this.sortDirection;

    const clonedData = [...this.issues];

    clonedData.sort((a, b) => {
      const valueA = a[sortBy] ? a[sortBy].toLowerCase() : "";
      const valueB = b[sortBy] ? b[sortBy].toLowerCase() : "";

      return sortDirection === "asc"
        ? this.sortHelper(valueA, valueB)
        : this.sortHelper(valueB, valueA);
    });

    this.issues = clonedData;
  }

  sortHelper(valueA, valueB) {
    if (valueA < valueB) {
      return -1;
    } else if (valueA > valueB) {
      return 1;
    } 
      return 0;
    
  }

  showToast(title, message, variant) {
    const event = new ShowToastEvent({
      title,
      message,
      variant
    });
    this.dispatchEvent(event);
  }

  // --- New/Fixed Methods and Properties ---

  // Toggle between Kanban and Table views
  toggleView() {
    this.isKanbanView = !this.isKanbanView;
  }

  // Table columns definition
  columns = [
    { label: "ID", fieldName: "Name", sortable: true },
    { label: "Title", fieldName: "Title__c", sortable: true },
    { label: "Description", fieldName: "Description__c", sortable: false },
    { label: "Status", fieldName: "Status__c", sortable: true },
    { label: "Priority", fieldName: "Priority__c", sortable: true },
    { label: "Assignee", fieldName: "Assignee__c", sortable: true },
    { label: "Labels", fieldName: "Labels__c", sortable: false },
    { label: "Component", fieldName: "Component__c", sortable: true },
    { label: "Milestone", fieldName: "Milestone__c", sortable: true },
    { label: "Due Date", fieldName: "DueDate__c", sortable: true },
    { label: "Parent Issue", fieldName: "ParentIssue__c", sortable: false }
  ];

  // Returns the priority class for a card (for Kanban view)
  get priorityClass() {
    // This getter is used in the context of a single card, so we need to handle it per card in the template
    // Instead, use a method for the template: priorityClassFor(issue)
    return "";
  }
  priorityClassFor(issue) {
    switch (issue.Priority__c) {
      case "Critical":
        return "priority-critical";
      case "High":
        return "priority-high";
      case "Medium":
        return "priority-medium";
      case "Low":
        return "priority-low";
      default:
        return "priority-none";
    }
  }

  // Card click handler (Kanban view)
  handleClick(event) {
    event.preventDefault();
    const issueId = event.currentTarget.dataset.id;
    const clickEvent = new CustomEvent("issueclick", {
      detail: { issueId }
    });
    this.dispatchEvent(clickEvent);
  }

  // Card drag handler (Kanban view)
  handleDragStart(event) {
    const issueId = event.currentTarget.dataset.id;
    event.dataTransfer.setData("text/plain", issueId);
    const dragEvent = new CustomEvent("dragstart", {
      detail: { issueId }
    });
    this.dispatchEvent(dragEvent);
  }

  // Table row click handler
  handleRowClick(event) {
    const issueId = event.currentTarget.dataset.id;
    const clickEvent = new CustomEvent("issueclick", {
      detail: { issueId }
    });
    this.dispatchEvent(clickEvent);
  }

  @track tableIssues = [];

  connectedCallback() {
    Promise.all([loadStyle(this, kanbanResources + "/kanbanStyles.css")])
      .then(() => {
        console.log("Resources loaded");
      })
      .catch((error) => {
        console.error("Error loading resources", error);
      });

    this.loadIssues();
  }

  @wire(getIssues)
  wiredIssues({ error, data }) {
    if (data) {
      this.issues = data;
      this.filteredIssues = data;
      this.categorizeIssues();
      // transform this.filteredIssues to create rowCells etc.
      this.tableIssues = this.filteredIssues.map((issue) => ({
        ...issue,
        rowCells: [
          { key: "colTitle", value: issue.Title__c },
          { key: "colStatus", value: issue.Status__c }
          // etc...
        ]
      }));
    } else if (error) {
      this.showToast("Error", "Error loading issues", "error");
    }
  }

  categorizeIssues() {
    this.backlogIssues = this.filteredIssues.filter(
      (issue) => issue.Status__c === "Backlog"
    );
    this.todoIssues = this.filteredIssues.filter(
      (issue) => issue.Status__c === "Todo"
    );
    this.inProgressIssues = this.filteredIssues.filter(
      (issue) => issue.Status__c === "In Progress"
    );
    this.doneIssues = this.filteredIssues.filter(
      (issue) => issue.Status__c === "Done"
    );
    this.canceledIssues = this.filteredIssues.filter(
      (issue) => issue.Status__c === "Canceled"
    );
  }

  handleSearchChange(event) {
    this.searchTerm = event.target.value;
    this.filteredIssues = this.issues.filter((issue) =>
      issue.Name.toLowerCase().includes(this.searchTerm.toLowerCase())
    );
    this.categorizeIssues();
  }

  handleRowAction(event) {
    const issueId = event.detail.row.Id;
    const clickEvent = new CustomEvent("issueclick", {
      detail: { issueId }
    });
    this.dispatchEvent(clickEvent);
  }

  handleSort(event) {
    const { fieldName: sortBy, sortDirection } = event.detail;
    this.sortBy = sortBy;
    this.sortDirection = sortDirection;
    this.sortData();
  }

  sortData() {
    const sortBy = this.sortBy;
    const sortDirection = this.sortDirection;

    const clonedData = [...this.issues];

    clonedData.sort((a, b) => {
      const valueA = a[sortBy] ? a[sortBy].toLowerCase() : "";
      const valueB = b[sortBy] ? b[sortBy].toLowerCase() : "";

      return sortDirection === "asc"
        ? this.sortHelper(valueA, valueB)
        : this.sortHelper(valueB, valueA);
    });

    this.issues = clonedData;
  }

  sortHelper(valueA, valueB) {
    if (valueA < valueB) {
      return -1;
    } else if (valueA > valueB) {
      return 1;
    } 
      return 0;
    
  }

  showToast(title, message, variant) {
    const event = new ShowToastEvent({
      title,
      message,
      variant
    });
    this.dispatchEvent(event);
  }

  get statusColumns() {
    return this.statusOptions.map((opt) => ({
      label: opt.label,
      value: opt.value,
      issues: this.filteredIssues
        .filter((issue) => issue.Status__c === opt.value)
        .map((issue) => ({
          ...issue,
          priorityClass: this.computePriorityClass(issue)
        }))
    }));
  }

  // Helper method (no arguments in template)
  computePriorityClass(issue) {
    switch (issue.Priority__c) {
      case "Critical":
        return "priority-critical";
      case "High":
        return "priority-high";
      case "Medium":
        return "priority-medium";
      case "Low":
        return "priority-low";
      default:
        return "priority-none";
    }
  }
}