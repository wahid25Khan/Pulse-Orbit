import getIssues from "@salesforce/apex/KanbanBoardController.getIssues";
import kanbanResources from "@salesforce/resourceUrl/kanbanResources";
import { loadStyle } from "lightning/platformResourceLoader";
import { ShowToastEvent } from "lightning/platformShowToastEvent";
import { api, LightningElement, track, wire } from "lwc";

export default class KanbanUnified extends LightningElement {
  // State
  @track issues = [];
  @track filteredIssues = [];
  @track searchTerm = "";
  @track isKanbanView = true;
  @track isLoading = true;
  @api sortBy;
  @api sortDirection = "asc";

  // Table columns aligned to Case fields (flattened where needed)
  columns = [
    { label: "Case #", fieldName: "CaseNumber", sortable: true },
    { label: "Subject", fieldName: "Subject", sortable: true },
    { label: "Status", fieldName: "Status", sortable: true },
    { label: "Priority", fieldName: "Priority", sortable: true },
    { label: "Owner", fieldName: "OwnerName", sortable: true },
    { label: "Account", fieldName: "AccountName", sortable: true },
    { label: "Created", fieldName: "CreatedDate", sortable: true },
    { label: "Updated", fieldName: "LastModifiedDate", sortable: true }
  ];

  // Dynamically computed status options from data
  get statusOptions() {
    const set = new Set();
    (this.filteredIssues || []).forEach((i) => {
      if (i.Status) set.add(i.Status);
    });
    return Array.from(set)
      .sort()
      .map((s) => ({ label: s, value: s }));
  }

  // Build table rows as array with rowCells matching column order
  get tableRows() {
    return (this.filteredIssues || []).map((issue) => ({
      Id: issue.Id,
      rowCells: this.columns.map((col) => ({
        key: `col-${col.fieldName}-${issue.Id}`,
        value: issue[col.fieldName] || ""
      }))
    }));
  }

  // Kanban columns with priority class
  get statusColumns() {
    return this.statusOptions.map((opt) => ({
      label: opt.label,
      value: opt.value,
      issues: (this.filteredIssues || [])
        .filter((issue) => issue.Status === opt.value)
        .map((issue) => ({
          ...issue,
          priorityClass: this.priorityClassFor(issue)
        }))
    }));
  }

  connectedCallback() {
    loadStyle(this, kanbanResources)
      .then(() => {
        // Resource loaded
      })
      .catch((error) => {
        // eslint-disable-next-line no-console
        console.error("Error loading resources", error);
      });
  }

  @wire(getIssues)
  wiredIssues({ error, data }) {
    if (data) {
      // Flatten nested references for table
      const flattened = data.map((d) => ({
        ...d,
        OwnerName: d?.Owner?.Name || "",
        AccountName: d?.Account?.Name || ""
      }));
      this.issues = flattened;
      this.filteredIssues = flattened;
      this.isLoading = false;
    } else if (error) {
      this.isLoading = false;
      this.showToast("Error", "Error loading issues", "error");
    }
  }

  // UI handlers
  toggleView() {
    this.isKanbanView = !this.isKanbanView;
  }

  handleClearFilters() {
    this.searchTerm = "";
    this.filteredIssues = this.issues;
  }

  handleSearchChange(event) {
    this.searchTerm = event.target.value || "";
    const term = this.searchTerm.toLowerCase();
    this.filteredIssues = (this.issues || []).filter((issue) => {
      const caseNum = String(issue.CaseNumber || "").toLowerCase();
      const subj = String(issue.Subject || "").toLowerCase();
      return caseNum.includes(term) || subj.includes(term);
    });
  }

  handleClick(event) {
    event.preventDefault();
    const issueId = event.currentTarget.dataset.id;
    this.dispatchEvent(
      new CustomEvent("issueclick", { detail: { issueId } })
    );
  }

  handleDragStart(event) {
    const issueId = event.currentTarget.dataset.id;
    event.dataTransfer.setData("text/plain", issueId);
    this.dispatchEvent(new CustomEvent("dragstart", { detail: { issueId } }));
  }

  handleRowClick(event) {
    const issueId = event.currentTarget.dataset.id;
    this.dispatchEvent(
      new CustomEvent("issueclick", { detail: { issueId } })
    );
  }

  handleSort(event) {
    const { fieldName: sortBy, sortDirection } = event.detail;
    this.sortBy = sortBy;
    this.sortDirection = sortDirection;
    const dir = sortDirection === "asc" ? 1 : -1;
    const sorted = [...(this.filteredIssues || [])].sort((a, b) => {
      const av = a[sortBy] || "";
      const bv = b[sortBy] || "";
      const an = typeof av === "string" ? av.toLowerCase() : av;
      const bn = typeof bv === "string" ? bv.toLowerCase() : bv;
      if (an < bn) return -1 * dir;
      if (an > bn) return 1 * dir;
      return 0;
    });
    this.filteredIssues = sorted;
  }

  // Helpers
  priorityClassFor(issue) {
    switch (issue.Priority) {
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

  showToast(title, message, variant) {
    this.dispatchEvent(
      new ShowToastEvent({ title, message, variant })
    );
  }
}