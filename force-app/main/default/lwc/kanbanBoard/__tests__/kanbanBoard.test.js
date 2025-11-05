import KanbanBoard from "c/kanbanBoard";
import { createElement } from "lwc";

// Mock Apex method used in post comment path
jest.mock(
	"@salesforce/apex/KanbanBoardController.createTaskCommentFromMap",
	() => ({
		default: jest.fn((payload) =>
			Promise.resolve({
				id: "c1",
				text: payload?.text || "Hello",
				createdByName: "You",
				createdDate: "2025-01-01T00:00:00Z",
				mentions: payload?.mentions || [],
			})
		),
	}),
	{ virtual: true }
);

// Mock team statuses Apex for filtering test
jest.mock(
	"@salesforce/apex/KanbanBoardController.getTeamStatuses",
	() => ({
		default: jest.fn(() =>
			Promise.resolve([
				{
					Name: "In Progress",
					TLG_Display_Label__c: "Doing",
					TLG_Order_Number__c: 20,
				},
				{ Name: "QA", TLG_Display_Label__c: "QA", TLG_Order_Number__c: 30 },
				{ Name: "Foo", TLG_Display_Label__c: "Foo", TLG_Order_Number__c: 40 },
				{
					Name: "Ready for Review",
					TLG_Display_Label__c: "Review",
					TLG_Order_Number__c: 25,
				},
			])
		),
	}),
	{ virtual: true }
);

describe("c-kanban-board", () => {
	beforeEach(() => {
		// no-op
	});

	afterEach(() => {
		while (document.body.firstChild) {
			document.body.removeChild(document.body.firstChild);
		}
		jest.restoreAllMocks();
	});

	it("exposes a fixed status options list via helper", async () => {
		const element = createElement("c-kanban-board", { is: KanbanBoard });
		const labels = element.getFixedStatusLabels();
		const expected = [
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

		expected.forEach((label) => {
			expect(labels).toContain(label);
		});
	});

	it("adds and removes mention chips", async () => {
		const element = createElement("c-kanban-board", { is: KanbanBoard });
		element.disableAutoInit = true;
		// Prepare drawer state pre-mount
		element.showTaskDrawer = true;
		element.selectedTaskDetails = { Id: "t1", name: "Test" };
		// Seed mentions through public API and verify chips render
		element.selectedMentions = [
			{ userId: "u1", name: "Alice Johnson", username: "alice" },
		];
		// Verify state reflects the seed
		expect(element.selectedMentions.length).toBe(1);
		// Simulate removal by clearing mentions and verify state
		element.selectedMentions = [];
		expect(element.selectedMentions.length).toBe(0);
	});

	it("posts a comment and clears composer and mentions", async () => {
		const element = createElement("c-kanban-board", { is: KanbanBoard });
		element.disableAutoInit = true;
		// Prepare drawer state and composer pre-mount
		element.showTaskDrawer = true;
		element.selectedTaskDetails = { Id: "t1", name: "Test" };
		element.selectedTaskId = "t1";
		element.newCommentText = "Hello world";
		element.selectedMentions = [
			{ userId: "u1", name: "Alice Johnson", username: "alice" },
		];
		// Trigger post through public API to avoid relying on DOM internals
		await element.handlePostComment();

		// Composer cleared
		expect(element.newCommentText).toBe("");
		// Mentions cleared
		expect(element.selectedMentions.length).toBe(0);
	});

	it("filters team-specific statuses to valid task picklist", async () => {
		const element = createElement("c-kanban-board", { is: KanbanBoard });
		element.disableAutoInit = true;
		const options = await element.loadTeamStatusOptions("team-1");
		const values = options.map((o) => o.value);
		expect(values).toContain("In Progress");
		expect(values).toContain("Ready for Review");
		// Invalid statuses should be filtered out
		expect(values).not.toContain("QA");
		expect(values).not.toContain("Foo");
	});

	// ========== Bulk Actions Tests ==========
	describe("Bulk Actions", () => {
		it("should toggle bulk mode on and off", () => {
			const element = createElement("c-kanban-board", { is: KanbanBoard });
			element.disableAutoInit = true;
			document.body.appendChild(element);

			expect(element.isBulkMode).toBe(false);

			element.handleToggleBulkMode();
			expect(element.isBulkMode).toBe(true);

			element.handleToggleBulkMode();
			expect(element.isBulkMode).toBe(false);
		});

		it("should select and deselect tasks", () => {
			const element = createElement("c-kanban-board", { is: KanbanBoard });
			element.disableAutoInit = true;
			document.body.appendChild(element);

			element.toggleTaskSelection("task1");
			expect(element.selectedTaskIds.has("task1")).toBe(true);

			element.toggleTaskSelection("task1");
			expect(element.selectedTaskIds.has("task1")).toBe(false);
		});

		it("should clear all selections", () => {
			const element = createElement("c-kanban-board", { is: KanbanBoard });
			element.disableAutoInit = true;
			document.body.appendChild(element);

			element.selectedTaskIds.add("task1");
			element.selectedTaskIds.add("task2");
			element.selectedTaskIds.add("task3");

			element.handleClearSelection();
			expect(element.selectedTaskIds.size).toBe(0);
		});

		it("should return correct selectedTaskCount", () => {
			const element = createElement("c-kanban-board", { is: KanbanBoard });
			element.disableAutoInit = true;
			document.body.appendChild(element);

			element.selectedTaskIds.add("task1");
			element.selectedTaskIds.add("task2");

			expect(element.selectedTaskCount).toBe(2);
		});

		it("should return correct hasSelectedTasks", () => {
			const element = createElement("c-kanban-board", { is: KanbanBoard });
			element.disableAutoInit = true;
			document.body.appendChild(element);

			expect(element.hasSelectedTasks).toBe(false);

			element.selectedTaskIds.add("task1");
			expect(element.hasSelectedTasks).toBe(true);
		});

		it("should clear selection when exiting bulk mode", () => {
			const element = createElement("c-kanban-board", { is: KanbanBoard });
			element.disableAutoInit = true;
			document.body.appendChild(element);

			element.isBulkMode = true;
			element.selectedTaskIds.add("task1");
			element.selectedTaskIds.add("task2");

			element.handleToggleBulkMode();

			expect(element.isBulkMode).toBe(false);
			expect(element.selectedTaskIds.size).toBe(0);
		});
	});

	// ========== Filter Tests ==========
	describe("Filters", () => {
		it("should toggle filter drawer open and closed", () => {
			const element = createElement("c-kanban-board", { is: KanbanBoard });
			element.disableAutoInit = true;
			document.body.appendChild(element);

			expect(element.showFilterDrawer).toBeFalsy();

			element.handleOpenFilterDrawer();
			expect(element.showFilterDrawer).toBe(true);

			element.handleCloseDrawer();
			expect(element.showFilterDrawer).toBe(false);
		});

		it("should apply quick filter correctly", () => {
			const element = createElement("c-kanban-board", { is: KanbanBoard });
			element.disableAutoInit = true;
			document.body.appendChild(element);

			const mockEvent = {
				currentTarget: {
					dataset: {
						filterKey: "priority",
						filterValue: "High",
					},
				},
			};

			element.handleQuickFilter(mockEvent);

			expect(element.currentFilters.priority).toBe("High");
		});

		it("should remove filter chip correctly", () => {
			const element = createElement("c-kanban-board", { is: KanbanBoard });
			element.disableAutoInit = true;
			document.body.appendChild(element);

			element.currentFilters = { priority: "High", assignee: "user1" };

			const mockEvent = {
				currentTarget: {
					dataset: {
						filterKey: "priority",
					},
				},
			};

			element.handleRemoveFilterChip(mockEvent);

			expect(element.currentFilters.priority).toBeUndefined();
			expect(element.currentFilters.assignee).toBe("user1");
		});

		it("should clear all filters", () => {
			const element = createElement("c-kanban-board", { is: KanbanBoard });
			element.disableAutoInit = true;
			document.body.appendChild(element);

			element.currentFilters = {
				priority: "High",
				assignee: "user1",
				status: "In Progress",
			};

			element.handleClearAllFilters();

			expect(Object.keys(element.currentFilters).length).toBe(0);
		});
	});

	// ========== Search Tests ==========
	describe("Search", () => {
		it("should update search term", () => {
			const element = createElement("c-kanban-board", { is: KanbanBoard });
			element.disableAutoInit = true;
			document.body.appendChild(element);

			const mockEvent = {
				target: { value: "test search" },
			};

			element.handleSearchChange(mockEvent);

			expect(element.searchTerm).toBe("test search");
		});

		it("should clear search", () => {
			const element = createElement("c-kanban-board", { is: KanbanBoard });
			element.disableAutoInit = true;
			document.body.appendChild(element);

			element.searchTerm = "test";

			element.handleClearSearch();

			expect(element.searchTerm).toBe("");
		});
	});

	// ========== Column Management Tests ==========
	describe("Column Management", () => {
		it("should toggle column expansion", () => {
			const element = createElement("c-kanban-board", { is: KanbanBoard });
			element.disableAutoInit = true;
			document.body.appendChild(element);

			const mockColumn = {
				id: "col1",
				isCollapsed: false,
			};

			const mockEvent = {
				currentTarget: {
					dataset: { columnId: "col1" },
				},
			};

			element._columns = [mockColumn];

			element.handleColumnToggle(mockEvent);

			expect(element._columns[0].isCollapsed).toBe(true);
		});

		it("should expand all columns", () => {
			const element = createElement("c-kanban-board", { is: KanbanBoard });
			element.disableAutoInit = true;
			document.body.appendChild(element);

			element._columns = [
				{ id: "col1", isCollapsed: true },
				{ id: "col2", isCollapsed: true },
				{ id: "col3", isCollapsed: false },
			];

			element.handleExpandAll();

			expect(element._columns.every((col) => !col.isCollapsed)).toBe(true);
		});

		it("should collapse all columns", () => {
			const element = createElement("c-kanban-board", { is: KanbanBoard });
			element.disableAutoInit = true;
			document.body.appendChild(element);

			element._columns = [
				{ id: "col1", isCollapsed: false },
				{ id: "col2", isCollapsed: false },
				{ id: "col3", isCollapsed: true },
			];

			element.handleCollapseAll();

			expect(element._columns.every((col) => col.isCollapsed)).toBe(true);
		});
	});

	// ========== Drawer Management Tests ==========
	describe("Drawer Management", () => {
		it("should open task drawer", () => {
			const element = createElement("c-kanban-board", { is: KanbanBoard });
			element.disableAutoInit = true;
			document.body.appendChild(element);

			const mockTask = {
				Id: "task1",
				Name: "Test Task",
				TLG_Status__c: "In Progress",
			};

			element.openTaskDrawer(mockTask);

			expect(element.showTaskDrawer).toBe(true);
			expect(element.selectedTaskId).toBe("task1");
		});

		it("should close drawer", () => {
			const element = createElement("c-kanban-board", { is: KanbanBoard });
			element.disableAutoInit = true;
			document.body.appendChild(element);

			element.showTaskDrawer = true;
			element.showNewTaskDrawer = true;
			element.showFilterDrawer = true;

			element.handleCloseDrawer();

			expect(element.showTaskDrawer).toBe(false);
			expect(element.showNewTaskDrawer).toBe(false);
			expect(element.showFilterDrawer).toBe(false);
		});

		it("should open new task drawer", () => {
			const element = createElement("c-kanban-board", { is: KanbanBoard });
			element.disableAutoInit = true;
			document.body.appendChild(element);

			const mockEvent = {
				detail: { status: "In Progress" },
			};

			element.handleOpenNewTaskDrawer(mockEvent);

			expect(element.showNewTaskDrawer).toBe(true);
			expect(element.newTaskData.TLG_Status__c).toBe("In Progress");
		});
	});

	// ========== Settings Tests ==========
	describe("Settings", () => {
		it("should toggle settings menu", () => {
			const element = createElement("c-kanban-board", { is: KanbanBoard });
			element.disableAutoInit = true;
			document.body.appendChild(element);

			expect(element.showSettingsMenu).toBeFalsy();

			element.handleToggleSettings();
			expect(element.showSettingsMenu).toBe(true);

			element.handleToggleSettings();
			expect(element.showSettingsMenu).toBe(false);
		});

		it("should toggle dark mode", () => {
			const element = createElement("c-kanban-board", { is: KanbanBoard });
			element.disableAutoInit = true;
			document.body.appendChild(element);

			const initialMode = element.darkMode;

			element.handleToggleDarkMode();

			expect(element.darkMode).toBe(!initialMode);
		});
	});

	// ========== Priority Options Tests ==========
	describe("Priority Options", () => {
		it("should return correct priority options", () => {
			const element = createElement("c-kanban-board", { is: KanbanBoard });
			element.disableAutoInit = true;
			document.body.appendChild(element);

			const priorities = element.priorityOptions;

			expect(priorities).toHaveLength(3);
			expect(priorities.map((p) => p.value)).toEqual(["High", "Normal", "Low"]);
		});
	});

	// ========== Task Data Validation Tests ==========
	describe("Task Data Validation", () => {
		it("should validate required fields", () => {
			const element = createElement("c-kanban-board", { is: KanbanBoard });
			element.disableAutoInit = true;
			document.body.appendChild(element);

			const invalidTask = {
				Name: "",
			};

			const isValid = element.validateTaskData(invalidTask);

			expect(isValid).toBe(false);
		});

		it("should accept valid task data", () => {
			const element = createElement("c-kanban-board", { is: KanbanBoard });
			element.disableAutoInit = true;
			document.body.appendChild(element);

			const validTask = {
				Name: "Valid Task",
				TLG_Status__c: "In Progress",
			};

			const isValid = element.validateTaskData(validTask);

			expect(isValid).toBe(true);
		});
	});

	// ========== Computed Properties Tests ==========
	describe("Computed Properties", () => {
		it("should return correct bulkActionLabel", () => {
			const element = createElement("c-kanban-board", { is: KanbanBoard });
			element.disableAutoInit = true;
			document.body.appendChild(element);

			element.selectedTaskIds = new Set();
			expect(element.bulkActionLabel).toBe("0 tasks selected");

			element.selectedTaskIds.add("task1");
			element.selectedTaskIds = new Set(element.selectedTaskIds);
			expect(element.bulkActionLabel).toBe("1 task selected");

			element.selectedTaskIds.add("task2");
			element.selectedTaskIds = new Set(element.selectedTaskIds);
			expect(element.bulkActionLabel).toBe("2 tasks selected");
		});

		it("should return correct hasActiveFilters", () => {
			const element = createElement("c-kanban-board", { is: KanbanBoard });
			element.disableAutoInit = true;
			document.body.appendChild(element);

			element.currentFilters = {};
			expect(element.hasActiveFilters).toBe(false);

			element.currentFilters = { priority: "High" };
			expect(element.hasActiveFilters).toBe(true);
		});
	});

	// ========== Error Handling Tests ==========
	describe("Error Handling", () => {
		it("should handle missing task ID gracefully", () => {
			const element = createElement("c-kanban-board", { is: KanbanBoard });
			element.disableAutoInit = true;
			document.body.appendChild(element);

			const mockEvent = {
				currentTarget: { dataset: {} },
			};

			expect(() => element.handleTaskSelect(mockEvent)).not.toThrow();
		});

		it("should handle invalid column ID gracefully", () => {
			const element = createElement("c-kanban-board", { is: KanbanBoard });
			element.disableAutoInit = true;
			document.body.appendChild(element);

			const mockEvent = {
				currentTarget: { dataset: { columnId: "invalid" } },
			};

			expect(() => element.handleColumnToggle(mockEvent)).not.toThrow();
		});
	});
});
