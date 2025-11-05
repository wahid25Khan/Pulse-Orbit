# Test Coverage Plan - Pulse Orbit Kanban

## Current Status

- **Total Tests:** 8 (4 timeMath + 4 kanbanBoard)
- **Coverage:** 5.81% statements, 1.3% branches, 3.06% functions, 5.91% lines
- **Goal:** 80% coverage across all metrics

## Coverage Strategy

### Phase 1: Core Utilities (Quick Wins)

**Target:** storageUtils, logger, debounceUtils, errorHandler
**Estimated Tests:** 20-25
**Expected Coverage Gain:** +15-20%

#### storageUtils.js Tests

- [ ] isStorageAvailable() - test localStorage availability detection
- [ ] getStorageItem() - test retrieval, defaults, error handling
- [ ] setStorageItem() - test setting, quota exceeded, errors
- [ ] getStorageJSON() - test JSON parsing, invalid JSON, defaults
- [ ] setStorageJSON() - test JSON serialization, circular refs, errors
- [ ] removeStorageItem() - test removal, non-existent keys
- [ ] clearStorage() - test clearing all items

#### logger.js Tests

- [ ] error() - test error logging with/without details
- [ ] warn() - test warning logging
- [ ] debug() - test debug mode on/off
- [ ] info() - test info logging
- [ ] logAction() - test action logging format
- [ ] performance() - test performance logging
- [ ] Debug mode toggle behavior

### Phase 2: kanbanBoard Core Features (High Value)

**Target:** Task operations, state management, data loading
**Estimated Tests:** 30-35
**Expected Coverage Gain:** +25-30%

#### Task Management

- [ ] connectedCallback() - component initialization
- [ ] loadTasks() - task data loading from Apex
- [ ] handleTaskClick() - task selection and drawer opening
- [ ] handleTaskSave() - task update via Apex
- [ ] handleTaskDelete() - task deletion with confirmation
- [ ] handleCreateTask() - new task creation
- [ ] Task field validation (title, status, priority)

#### Drag & Drop

- [ ] handleDragStart() - drag initiation
- [ ] handleDragOver() - drag over column
- [ ] handleDrop() - drop and status update
- [ ] handleDragEnd() - drag cleanup
- [ ] Multi-task drag (if implemented)

#### Filtering & Search

- [ ] handleSearchChange() - search filter
- [ ] handleStatusFilterChange() - status filtering
- [ ] handlePriorityFilterChange() - priority filtering
- [ ] handleAssigneeFilterChange() - assignee filtering
- [ ] handleClearFilters() - reset all filters
- [ ] Filter combinations

#### Column Management

- [ ] handleColumnCollapse() - collapse/expand columns
- [ ] handleColumnReorder() - column reordering
- [ ] Column width adjustments
- [ ] Responsive column behavior

### Phase 3: kanbanBoard Advanced Features

**Target:** Settings, bulk operations, time tracking
**Estimated Tests:** 25-30
**Expected Coverage Gain:** +15-20%

#### Settings & Preferences

- [ ] handleToggleDarkMode() - dark mode toggle
- [ ] handleToggleCompactView() - compact view toggle
- [ ] handleToggleVirtualScroll() - virtual scroll toggle
- [ ] Settings persistence to localStorage
- [ ] Settings loading on init

#### Bulk Operations

- [ ] handleSelectAll() - select all tasks
- [ ] handleDeselectAll() - deselect all tasks
- [ ] handleBulkStatusUpdate() - update multiple task statuses
- [ ] handleBulkAssign() - assign multiple tasks
- [ ] handleBulkDelete() - delete multiple tasks

#### Comments & Activity

- [ ] handlePostComment() - post comment (existing test, expand)
- [ ] handleCommentEdit() - edit comment
- [ ] handleCommentDelete() - delete comment
- [ ] Mention chip handling (existing test, expand)
- [ ] Activity feed loading

#### Time Tracking

- [ ] handleTimeLogAdd() - add time log
- [ ] handleTimeLogEdit() - edit time log
- [ ] handleTimeLogDelete() - delete time log
- [ ] Time log validation
- [ ] Time log aggregation

### Phase 4: kanbanCard Component

**Target:** Card rendering and interactions
**Estimated Tests:** 15-20
**Expected Coverage Gain:** +8-12%

#### Card Rendering

- [ ] Card initialization with task data
- [ ] Priority indicator rendering
- [ ] Assignee avatar rendering
- [ ] Due date display and formatting
- [ ] Tag rendering
- [ ] Overdue indicator

#### Card Interactions

- [ ] Card click event
- [ ] Quick edit mode
- [ ] Drag handle interactions
- [ ] Card menu actions
- [ ] Card expand/collapse

### Phase 5: taskTimer Component

**Target:** Timer functionality
**Estimated Tests:** 15-20
**Expected Coverage Gain:** +5-10%

#### Timer Operations

- [ ] Timer start
- [ ] Timer pause
- [ ] Timer stop
- [ ] Timer reset
- [ ] Timer persistence to localStorage
- [ ] Timer restoration on page load
- [ ] Multiple timer handling

#### Timer Display

- [ ] Time formatting (HH:MM:SS)
- [ ] Elapsed time calculation
- [ ] Timer status indicators
- [ ] Timer sync with task

## Implementation Order

1. **Week 1:** storageUtils + logger tests (Phase 1) → ~20% coverage
2. **Week 2:** kanbanBoard core (Phase 2) → ~45-50% coverage
3. **Week 3:** kanbanBoard advanced (Phase 3) → ~65-70% coverage
4. **Week 4:** kanbanCard + taskTimer (Phases 4-5) → 80%+ coverage

## Test Structure Template

```javascript
import { createElement } from "lwc";
import KanbanBoard from "c/kanbanBoard";
import { mockMethod } from "@salesforce/apex";

// Mock Apex methods
jest.mock(
	"@salesforce/apex/ClassName.methodName",
	() => ({
		default: jest.fn(),
	}),
	{ virtual: true }
);

describe("c-kanban-board", () => {
	beforeEach(() => {
		// Clear DOM
		while (document.body.firstChild) {
			document.body.removeChild(document.body.firstChild);
		}
		// Clear mocks
		jest.clearAllMocks();
	});

	afterEach(() => {
		// Cleanup
	});

	describe("Feature Group", () => {
		it("should test specific behavior", async () => {
			// Arrange
			const element = createElement("c-kanban-board", {
				is: KanbanBoard,
			});

			// Act
			document.body.appendChild(element);
			await Promise.resolve(); // Wait for async

			// Assert
			expect(element.someProperty).toBe(expectedValue);
		});
	});
});
```

## Notes

- Use `flushPromises()` helper for async operations
- Mock all Apex methods with realistic data
- Test error scenarios and edge cases
- Maintain minimum 80% coverage threshold
- Group related tests using describe blocks
- Use beforeEach/afterEach for setup/cleanup
