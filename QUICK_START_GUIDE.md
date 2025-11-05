# Quick Start Guide - Issue Remediation

## For Developers Continuing This Work

---

## 🚀 What's Been Done

### ✅ Completed (Ready to Use)

1. **Error Boundary Component** - Wrap any component for error handling
2. **Utility Files** - Import and use immediately:
   - `constants.js` - Configuration values
   - `dateUtils.js` - Date formatting
   - `debounceUtils.js` - Performance utilities
3. **Fixed Critical Bugs**:
   - Time log race conditions
   - Dashboard DOM manipulation
   - Verified Master-Detail validation

---

## 📦 How to Use New Utilities

### Error Boundary

```javascript
// Wrap your component in parent HTML
<template>
	<c-error-boundary retry-callback={handleRetry}>
		<c-your-component></c-your-component>
	</c-error-boundary>
</template>
```

### Constants

```javascript
// In your component
import {
	SEARCH_DEBOUNCE_MS,
	ERROR_MESSAGES,
	PRIORITY_OPTIONS,
} from "./constants";

// Use them
if (mins <= 0) {
	showToast(this, "Error", ERROR_MESSAGES.TIME_POSITIVE, "error");
}
```

### Date Utils

```javascript
import { formatDateISO, isOverdue, getTodayISO } from "./dateUtils";

// Instead of: new Date().toISOString().split('T')[0]
const today = getTodayISO();

// Instead of: complex date comparison logic
if (isOverdue(task.dueDate)) {
	// handle overdue
}
```

### Debounce

```javascript
import { debounce } from './debounceUtils';

connectedCallback() {
  this._debouncedSearch = debounce(this.performSearch.bind(this), 300);
}

handleSearchInput(event) {
  this.searchText = event.target.value;
  this._debouncedSearch(); // Waits 300ms after last call
}
```

---

## 🔨 Next Priority Tasks

### 1. Complete Debouncing (30 min) ⏰

**File:** `kanbanBoard.js`  
**What to do:**

1. Find this method (around line 1705):

```javascript
async handleCaseSearchInputNew(event) {
  try {
    const text = event.target.value || "";
    this.newCaseSearchText = text;
    this.showCaseResultsNew = true;
    this.isSearchingCaseNew = true;
    this.caseResultsNew = [];
    if (!text || text.trim().length < 2) return;
    const projectId = this.newTaskData?.TLG_Opportunity__c || null;
    const results = await searchCases(text.trim(), projectId);
    // ... rest
  }
}
```

2. Split it into two methods:

```javascript
handleCaseSearchInputNew(event) {
  const text = event.target.value || "";
  this.newCaseSearchText = text;
  this.showCaseResultsNew = true;
  this._debouncedCaseSearchNew(text);
}

async performCaseSearchNew(text) {
  try {
    this.isSearchingCaseNew = true;
    this.caseResultsNew = [];
    if (!text || text.trim().length < SEARCH_MIN_CHARS) return;

    const projectId = this.newTaskData?.TLG_Opportunity__c || null;
    const results = await searchCases(text.trim(), projectId);
    this.caseResultsNew = (results || []).slice(0, SEARCH_MAX_RESULTS).map((c) => ({
      label: c.Subject,
      value: c.Id
    }));
    this.showCaseResultsNew = this.caseResultsNew.length > 0;
  } catch (e) {
    this.showCaseResultsNew = false;
    this.caseResultsNew = [];
  } finally {
    this.isSearchingCaseNew = false;
  }
}
```

3. Repeat for:
   - `handleCaseSearchInputEdit` → `performCaseSearchEdit`
   - `handleParentSearchInputNew` → `performParentSearchNew`
   - `handleParentSearchInputEdit` → `performParentSearchEdit`
   - `handleMentionInput` → `performMentionSearch`

### 2. Fix Status Normalization (2 hours) 🔧

**Files:** `statusHelper.js`, `kanbanBoard.js`, `kanbanDataService.js`

**Current Problem:**

- Multiple places normalize statuses differently
- "On Hold" vs "On hold" vs "Onhold" inconsistencies

**Solution:**

1. Open `statusHelper.js`
2. Create master normalization function:

```javascript
const STATUS_MAPPINGS = {
	"not started": "Not Started",
	notstarted: "Not Started",
	"in progress": "In Progress",
	inprogress: "In Progress",
	"on hold": "On Hold",
	onhold: "On Hold",
	"on-hold": "On Hold",
	// ... add all variations
};

export function normalizeStatusValue(status) {
	if (!status) return "";
	const normalized = String(status).trim().toLowerCase();
	return STATUS_MAPPINGS[normalized] || status;
}
```

3. Find all places that compare statuses:

```bash
# In terminal
grep -r "toLowerCase()" force-app/main/default/lwc/kanbanBoard/
grep -r "TLG_Status__c" force-app/main/default/lwc/kanbanBoard/
```

4. Replace all with `normalizeStatusValue()`

### 3. Add Memory Cleanup (1 hour) 🧹

**File:** `kanbanBoard.js`

**What to do:**

1. Find `disconnectedCallback()` (around line 718)
2. Add cleanup:

```javascript
disconnectedCallback() {
  // Existing cleanup
  if (this._boundUpdateBoardOffset) {
    window.removeEventListener("resize", this._boundUpdateBoardOffset);
  }
  if (this._boundHandleDocumentClick) {
    document.removeEventListener("click", this._boundHandleDocumentClick);
  }

  // NEW: Clear large data structures
  this._originalTasks = null;
  this._allTasks = [];
  this._rawTasksData = [];
  this._columns = [];
  this.teamStatusOptionsByTeamId = {};

  // Clear debounced functions
  this._debouncedCaseSearchNew = null;
  this._debouncedCaseSearchEdit = null;
  this._debouncedParentSearchNew = null;
  this._debouncedParentSearchEdit = null;
  this._debouncedMentionSearch = null;
}
```

---

## 🏗️ Major Refactor: Split kanbanBoard.js

**IMPORTANT:** Do this before adding new features!

### Step 1: Create kanbanFilters Component (2 hours)

1. Create files:

```
force-app/main/default/lwc/kanbanFilters/
  ├── kanbanFilters.html
  ├── kanbanFilters.js
  ├── kanbanFilters.css
  └── kanbanFilters.js-meta.xml
```

2. Move from kanbanBoard.js to kanbanFilters.js:

   - All `@track` filter variables
   - All `handle*Filter*` methods
   - `get activeFilterCount()`
   - `applyFilters()` method

3. Communication:

```javascript
// kanbanFilters.js
handleApplyFilters() {
  this.dispatchEvent(new CustomEvent('filtersapplied', {
    detail: {
      filters: this._filters
    }
  }));
}

// kanbanBoard.js
<c-kanban-filters onfiltersapplied={handleFiltersApplied}></c-kanban-filters>
```

### Step 2: Create kanbanTaskDrawer Component (3 hours)

1. Create files:

```
force-app/main/default/lwc/kanbanTaskDrawer/
  ├── kanbanTaskDrawer.html
  ├── kanbanTaskDrawer.js
  ├── kanbanTaskDrawer.css
  └── kanbanTaskDrawer.js-meta.xml
```

2. Move from kanbanBoard.js:

   - `@api selectedTaskId`
   - `@track editTaskData`
   - `@track isEditingTask`
   - All edit-related methods
   - Task detail template section

3. API:

```javascript
// kanbanTaskDrawer.js
@api taskId;
@api isOpen;

// kanbanBoard.js
<c-kanban-task-drawer
  task-id={selectedTaskId}
  is-open={showTaskDrawer}
  ontasksaved={handleTaskSaved}
  onclosed={handleDrawerClosed}>
</c-kanban-task-drawer>
```

### Step 3: Repeat for Other Components

- `kanbanTimeLog` (time logging UI)
- `kanbanComments` (comments section)
- `kanbanNewTask` (new task form)

**Benefits:**

- Each file < 500 lines
- Easier to test
- Multiple developers can work simultaneously
- Better code organization

---

## 🧪 Testing Strategy

### Manual Testing Checklist

After making changes, test these scenarios:

- [ ] Create new task with required fields
- [ ] Drag and drop task between columns
- [ ] Log time on task
- [ ] Add comment with @mention
- [ ] Filter tasks by multiple criteria
- [ ] Search for Case in lookup
- [ ] Rapid typing in search (debounce should work)
- [ ] Close drawer without saving (no console errors)
- [ ] Refresh page (no memory leaks in browser tools)

### Automated Testing

```bash
# Run tests
npm run test:unit

# Watch mode for development
npm run test:unit:watch

# Coverage report
npm run test:unit:coverage
```

---

## 🐛 Common Issues & Fixes

### Issue: "Cannot read property 'X' of undefined"

**Fix:** Use optional chaining

```javascript
// Bad
const name = task.assignedTo.name;

// Good
const name = task?.assignedTo?.name ?? "Unassigned";
```

### Issue: ESLint errors about `@api` on methods

**Fix:** Methods with `@api` must be public and documented

```javascript
// Bad
@api myMethod() { }

// Good
/**
 * @description Public method to reset component state
 * @public
 */
@api
reset() {
  this.selectedTaskId = null;
  this.isLoading = false;
}
```

### Issue: Styles not applying

**Fix:** Check CSS selector specificity and host element

```css
/* May not work in LWC */
.my-class {
}

/* Better */
:host .my-class {
}
```

### Issue: Data not updating in template

**Fix:** Create new array reference for reactivity

```javascript
// Bad - mutating array
this.tasks.push(newTask);

// Good - new reference
this.tasks = [...this.tasks, newTask];
```

---

## 📚 Resources

### Documentation

- [LWC Dev Guide](https://developer.salesforce.com/docs/component-library/documentation/en/lwc)
- [Jest for LWC](https://github.com/salesforce/sfdx-lwc-jest)
- [SLDS Components](https://www.lightningdesignsystem.com/components/overview/)

### Code Examples

- See `IMPLEMENTATION_PROGRESS.md` for detailed examples
- See `ISSUES_LOG.md` for full issue descriptions
- Check inline comments in new utility files

### Getting Help

1. Check existing issues in `ISSUES_LOG.md`
2. Review implementation notes in `IMPLEMENTATION_PROGRESS.md`
3. Search Salesforce Stack Exchange
4. Ask in team Slack channel

---

## 🎯 Success Criteria

### You're Done When:

- [ ] All 88 issues marked as resolved in `ISSUES_LOG.md`
- [ ] Jest tests have 80%+ coverage
- [ ] No ESLint warnings
- [ ] Manual testing checklist complete
- [ ] Documentation updated
- [ ] Code reviewed by 2+ team members
- [ ] Deployed to sandbox without errors
- [ ] User acceptance testing passed

---

## 💡 Tips for Success

1. **One Issue at a Time:** Don't mix fixes in one commit
2. **Test Immediately:** Run tests after each change
3. **Commit Often:** Small, focused commits
4. **Update Progress:** Mark items complete in todos
5. **Ask Questions:** Better to ask than assume
6. **Document Decisions:** Add comments for "why" not "what"

---

**Good luck! You've got this! 🚀**
