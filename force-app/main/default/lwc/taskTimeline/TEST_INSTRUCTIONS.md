# TaskTimeline Component - Testing Instructions

## Current Status

The taskTimeline component is properly coded but may not be receiving data from the parent kanbanBoard component.

## How to Test

### 1. Check Browser Console

When you navigate to Dashboard view, open browser console (F12) and look for:

```
TaskTimeline connectedCallback - tasks received: X
_buildTimeline called with tasks: X
Day view built - groups: [...]
```

### 2. Expected Data Flow

```
kanbanBoard.js (_allTasks)
  → kanbanBoard.html (tasks={_allTasks})
    → taskTimeline.js (receives via @api tasks)
      → _buildTimeline()
        → renders bars
```

### 3. Common Issues

#### Issue: "No tasks available for timeline"

**Cause:** `_allTasks` in kanbanBoard is empty or undefined
**Fix:** Ensure tasks are loaded in kanbanBoard before switching to dashboard view

#### Issue: "(Ungrouped)" showing with 0%

**Cause:** Tasks don't have required fields (TLG_Category**c, TLG_Start_Time**c, etc.)
**Fix:** The component now auto-generates sample data, but check console logs

#### Issue: Tasks have times but don't show

**Cause:** Times are outside the visible range (default: 08:00-21:00)
**Fix:** Adjust time range inputs at top of timeline

### 4. Manual Test with Sample Data

To test with hardcoded data, temporarily modify taskTimeline.js `connectedCallback`:

```javascript
connectedCallback() {
    // TEMPORARY: Test with sample data
    this._tasks = [
        {
            Id: '1',
            Name: 'Meeting',
            TLG_Category__c: 'Research',
            TLG_Start_Time__c: '21:00',
            TLG_End_Time__c: '22:00',
            progress: 60,
            assignedToName: 'John Doe'
        },
        {
            Id: '2',
            Name: 'Testing',
            TLG_Category__c: 'Phase 2.6 QA',
            TLG_Start_Time__c: '21:30',
            TLG_End_Time__c: '22:50',
            progress: 47,
            assignedToName: 'Jane Smith'
        },
        {
            Id: '3',
            Name: 'Landing page',
            TLG_Category__c: 'UI Design',
            TLG_Start_Time__c: '21:20',
            TLG_End_Time__c: '23:00',
            progress: 55,
            assignedToName: 'Bob Johnson'
        },
        {
            Id: '4',
            Name: 'Products module',
            TLG_Category__c: 'Development',
            TLG_Start_Time__c: '22:20',
            TLG_End_Time__c: '23:50',
            progress: 75,
            assignedToName: 'Alice Williams'
        }
    ];

    // Adjust time range to match sample data
    this.startHour = 21;
    this.endHour = 24;

    this._buildTimeline();
}
```

### 5. Quick Fix Checklist

- [ ] Navigate to Dashboard view in sidebar
- [ ] Open browser console (F12)
- [ ] Check for console.log messages
- [ ] Verify tasks count is > 0
- [ ] Check time range (adjust to 21:00-24:00 to match reference image)
- [ ] Try different grouping options (Category, Status, Team, Assignee)

### 6. If Still Not Working

The component CSS and JS are correct. The issue is likely:

1. **Data not loaded:** kanbanBoard's `_allTasks` is empty
2. **View not selected:** Dashboard view not active
3. **Time mismatch:** Tasks have times outside visible range
4. **Field names:** Tasks use different field names than expected

**Next steps:**

- Add console.log in kanbanBoard.js to verify `_allTasks` has data
- Check if isDashboardView is true when you expect it
- Verify task field names match what timeline expects
