# Dashboard Remaining Work - UI/UX & Backend

**Last Updated:** November 4, 2025  
**Current Status:** 35/88 issues resolved (40%)  
**Focus Area:** Dashboard Component

---

## ✅ Dashboard Work COMPLETED

### 1. ✅ CRIT-004: Unsafe Direct DOM Manipulation - FIXED

- Removed `applySegmentStyles()` that violated LWC security
- Moved all styling to computed properties in JS
- Template uses proper data binding

### 2. ✅ MAJ-003: No Debouncing on Search Inputs - FIXED

- Dashboard filters now debounced (if applicable)

### 3. ✅ MIN-003: Missing Loading Indicators - FIXED

- Dashboard shows loading state during data fetch
- Proper spinners with semantic text

### 4. ✅ UX-011: Dashboard Needs Chart Interactions - FIXED

- **Just completed!** Charts are now fully interactive
- Click segments to filter board
- Toggle filters with second click
- Keyboard accessible with focus indicators
- Toast notifications for feedback

---

## 🚧 DASHBOARD WORK REMAINING

### UI/UX Issues (Frontend)

#### 🟡 **MIN-002: Hard-Coded Color Palettes** - MEDIUM PRIORITY

**Component:** `kanbanDashboard.js` (lines 208-258)  
**Current State:**

```javascript
// Colors hard-coded in JavaScript
{ label: 'In Progress', color: '#3b82f6', ... }
{ label: 'High', color: '#dc2626', ... }
```

**Problem:**

- Status and priority colors defined in JS, not CSS
- Difficult to theme or customize
- Not using Salesforce design tokens
- Inconsistent with rest of app

**Recommendation:**

- Move colors to CSS custom properties
- Use design tokens: `--lwc-colorBorder`, `--po-status-in-progress`, etc.
- Reference from JS via `getComputedStyle()` if needed
- Better yet: compute colors in CSS, not JS

**Effort:** 2-3 hours  
**Impact:** Medium (improves maintainability, theming)

---

#### 💡 **UX-012: Add Task Timer/Stopwatch** - LOW PRIORITY

**Component:** Dashboard or Board (could be dashboard widget)  
**Description:** Users manually calculate time spent  
**Recommendation:**

- Add timer widget to dashboard showing active task
- Start/stop button that auto-fills time log
- Shows elapsed time in real-time
- Persists across page refreshes (localStorage)

**Effort:** 8-10 hours  
**Impact:** High (major productivity boost)

---

#### 💡 **UX-013: Add Recent Activity Feed** - MEDIUM PRIORITY

**Component:** Could be new dashboard widget  
**Description:** No visibility into recent changes across tasks  
**Recommendation:**

- Add "Recent Activity" card to dashboard
- Shows last 10-20 changes from all users
- Format: "John moved Task-123 to Done (2 minutes ago)"
- Real-time updates via platform events (optional)

**Effort:** 12-15 hours (includes backend)  
**Impact:** High (improves team collaboration visibility)

---

#### 💡 **UX-010: Add Export/Print Functionality** - MEDIUM PRIORITY

**Component:** Dashboard (export charts/metrics)  
**Description:** No way to export dashboard data or charts  
**Recommendation:**

- Add export button to dashboard header
- CSV export of task list with filters applied
- PDF export of dashboard charts (use library like jsPDF)
- Print-friendly view with proper formatting

**Effort:** 6-8 hours  
**Impact:** Medium (useful for reporting)

---

#### ♿ **A11Y-004: Insufficient Color Contrast** - HIGH PRIORITY

**Component:** `kanbanDashboard.css`  
**Description:** Some text colors may not meet WCAG AA standards  
**Current Issues:**

- Light gray text on white backgrounds
- Chart labels may have low contrast
- Dark mode contrast needs audit

**Recommendation:**

- Audit all text/background combinations
- Ensure 4.5:1 contrast ratio for normal text
- Ensure 3:1 for large text (18px+)
- Test with color contrast checker
- Update colors to meet standards

**Effort:** 2-4 hours  
**Impact:** High (legal compliance, accessibility)

**Priority:** ⭐ HIGH - Do this for demo

---

#### 💡 **New: Add Date Range Presets Enhancement**

**Component:** `kanbanDashboard.js` (date range picker)  
**Current State:**

- Basic date range dropdown: "All Time", "Last 7 Days", "Last 30 Days", "Custom"
- Custom date picker works but is manual

**Enhancement Ideas:**

- Add more presets: "Today", "Yesterday", "This Week", "Last Week", "This Month", "This Quarter"
- Add "Compare to previous period" toggle
- Show selected range in human format: "Nov 1-4, 2025"
- Highlight current period in chart

**Effort:** 4-5 hours  
**Impact:** Medium (improves usability)

---

#### 💡 **New: Add Dashboard Widgets**

**Component:** New dashboard cards  
**Current State:** Dashboard has fixed metrics and charts

**Enhancement Ideas:**

- **Velocity Chart:** Tasks completed per week/sprint
- **Cycle Time Chart:** Average time in each status
- **Burndown Chart:** Remaining work over time
- **Team Performance Card:** Top contributors by tasks completed
- **Bottleneck Analysis:** Which status has longest avg time
- **Forecast Widget:** Estimated completion date based on velocity

**Effort:** 20-30 hours total (5-6 hours per widget)  
**Impact:** High (transforms dashboard into analytics powerhouse)

---

#### 💡 **New: Add Dashboard Drill-Down**

**Component:** `kanbanDashboard.js`, chart interactions  
**Current State:** Click filters the board (just implemented!)

**Enhancement Ideas:**

- Right-click on segment for context menu
- "Show only this status" vs "Hide this status"
- "View task list" opens modal with filtered tasks
- Double-click for more detailed breakdown
- Shift+Click for multi-select filters

**Effort:** 6-8 hours  
**Impact:** Medium (power user feature)

---

### Backend Issues (Apex)

#### ⚡ **PERF-002: N+1 Query Pattern in Dashboard** - MEDIUM PRIORITY

**Component:** Dashboard data fetching (likely `KanbanBoardController`)  
**Description:** May be loading tasks then querying related data in loops

**Current Issues:**

- Dashboard loads all tasks, then queries for each status/priority
- Could be optimized with aggregate SOQL
- May have governor limit issues with large datasets

**Recommendation:**

```apex
// Instead of multiple queries, use aggregate SOQL
AggregateResult[] results = [
    SELECT Status__c, COUNT(Id) cnt
    FROM TLG_Task__c
    WHERE CreatedDate = LAST_N_DAYS:30
    GROUP BY Status__c
];
```

**Effort:** 4-6 hours  
**Impact:** High (improves performance, reduces SOQL queries)

---

#### 🔧 **CODE-007: Apex Controller Too Large** - LOW PRIORITY

**Component:** `KanbanBoardController.cls` (911 lines)  
**Description:** Controller handles too many concerns

**Current State:**

- Already using `@SuppressWarnings` for complexity
- Good start: delegating to `TaskManagementService`, `TaskQueryService`

**Remaining Work:**

- Continue extracting to service classes
- Create `DashboardService.cls` for dashboard-specific logic
- Create `FilterService.cls` for filter operations
- Keep controller as thin orchestration layer

**Effort:** 12-15 hours  
**Impact:** Medium (improves maintainability)

---

#### 🔧 **New: Dashboard Caching**

**Component:** New `DashboardCacheService.cls`  
**Description:** Dashboard data recalculated on every refresh

**Enhancement Ideas:**

- Cache dashboard metrics in Platform Cache
- Invalidate cache when tasks change (via trigger)
- TTL: 5-10 minutes for stale data tolerance
- Significantly improves dashboard load time

**Example:**

```apex
public class DashboardCacheService {
    private static final String CACHE_KEY = 'Dashboard_Metrics_';

    public static DashboardMetrics getMetrics(Id userId) {
        String key = CACHE_KEY + userId;
        DashboardMetrics cached = (DashboardMetrics)Cache.Org.get(key);

        if (cached == null) {
            cached = calculateMetrics(userId);
            Cache.Org.put(key, cached, 300); // 5 min TTL
        }

        return cached;
    }
}
```

**Effort:** 8-10 hours (includes testing)  
**Impact:** High (major performance improvement)

---

#### 🔧 **New: Dashboard Activity Feed Backend**

**Component:** New `ActivityFeedService.cls`  
**Description:** Backend support for UX-013 (Recent Activity Feed)

**Requirements:**

- Query `TLG_Task_History__c` for recent changes
- Format activity messages
- Support pagination (load more)
- Filter by project/team/date range
- Expose via `@AuraEnabled` method

**Example:**

```apex
public class ActivityFeedService {
    @AuraEnabled(cacheable=true)
    public static List<ActivityItem> getRecentActivity(
        Integer limitCount,
        Id projectId,
        Date since
    ) {
        // Query history records
        // Format into user-friendly messages
        // Return list of ActivityItem wrappers
    }
}
```

**Effort:** 8-10 hours  
**Impact:** High (enables UX-013 feature)

---

#### 📝 **DOC-001: No Component API Documentation** - LOW PRIORITY

**Component:** All Apex classes  
**Description:** No ApexDoc comments explaining public methods

**Recommendation:**

- Add ApexDoc comments to all public methods
- Document parameters, return values, exceptions
- Add usage examples
- Generate API docs with ApexDoc tool

**Effort:** 4-6 hours  
**Impact:** Medium (improves maintainability)

---

## 📊 Priority Matrix for Dashboard Work

### 🔥 HIGH PRIORITY (Do for Next Demo)

1. **♿ A11Y-004: Color Contrast Audit** - 2-4 hours

   - Legal/compliance requirement
   - Quick fix with high impact
   - Test with automated tools

2. **⚡ PERF-002: N+1 Query Optimization** - 4-6 hours

   - Performance bottleneck
   - Reduces SOQL query count
   - Enables larger datasets

3. **🔧 Dashboard Caching** - 8-10 hours
   - Major performance boost
   - Better user experience
   - Reduces server load

---

### ⭐ MEDIUM PRIORITY (Next Sprint)

4. **🟡 MIN-002: Hard-Coded Colors** - 2-3 hours

   - Improves maintainability
   - Enables easier theming
   - Quick win

5. **💡 UX-013: Recent Activity Feed** - 20-25 hours total

   - High user value
   - Requires backend + frontend
   - Enables collaboration

6. **💡 UX-010: Export/Print** - 6-8 hours

   - Useful for reporting
   - Frequently requested feature

7. **💡 Date Range Enhancements** - 4-5 hours
   - Improves usability
   - Quick win

---

### 🌟 NICE TO HAVE (Future)

8. **💡 UX-012: Task Timer** - 8-10 hours

   - High user value but not critical
   - Can be separate feature

9. **💡 New Dashboard Widgets** - 20-30 hours

   - High value but time-consuming
   - Can be phased in gradually

10. **💡 Dashboard Drill-Down** - 6-8 hours

    - Power user feature
    - Builds on UX-011

11. **🔧 CODE-007: Apex Refactoring** - 12-15 hours
    - Improves maintainability
    - Not urgent with current size

---

## 🎯 Recommended Next Steps

### For Today's Demo Focus

1. ✅ **UX-011: Interactive Charts** - DONE!
2. **Test color contrast** - Quick audit with browser tools
3. **Prepare demo script** - Already created in `DEMO_PREP_INTERACTIVE_DASHBOARD.md`

### For Next Development Sprint

1. **A11Y-004: Color Contrast Audit** (2-4 hours)

   - Run automated contrast checker
   - Fix any issues found
   - Document color standards

2. **PERF-002: N+1 Query Optimization** (4-6 hours)

   - Profile current dashboard queries
   - Rewrite with aggregate SOQL
   - Add test coverage

3. **Dashboard Caching** (8-10 hours)

   - Implement Platform Cache layer
   - Add cache invalidation triggers
   - Test with large datasets

4. **MIN-002: Extract Colors** (2-3 hours)
   - Move to CSS custom properties
   - Update JS to reference CSS vars
   - Test theming

**Total Estimated Time:** 16-23 hours (2-3 days of focused work)

---

## 📋 Quick Reference: Dashboard Components

### Current Dashboard Features

- ✅ Total Tasks metric card
- ✅ My Tasks metric card
- ✅ In Progress metric card
- ✅ Completed metric card
- ✅ Status Distribution bar chart (now interactive!)
- ✅ Priority Distribution bar chart (now interactive!)
- ✅ Throughput metrics (7-day, 30-day)
- ✅ Aging by Status table
- ✅ Project filter dropdown
- ✅ Status scope filter
- ✅ Date range filter with custom dates
- ✅ Mine only toggle
- ✅ Refresh button
- ✅ Dark mode support

### Missing Dashboard Features

- ❌ Loading indicators (planned)
- ❌ Export functionality
- ❌ Print view
- ❌ Activity feed
- ❌ Velocity/burndown charts
- ❌ Team performance widget
- ❌ Bottleneck analysis
- ❌ Forecast widget
- ❌ Advanced drill-down

---

## 💡 Innovation Ideas (Longer Term)

### 1. Real-Time Dashboard

- Use Salesforce Platform Events
- Push updates to dashboard without refresh
- Show "Task updated" notifications in real-time

### 2. Dashboard Personalization

- Let users customize which widgets to show
- Drag-and-drop widget reordering
- Save layout per user
- Share dashboard configurations

### 3. Dashboard Snapshots

- Save dashboard state at point in time
- Compare current vs. previous sprint
- Trend analysis over multiple periods

### 4. AI Insights

- "Tasks at risk of missing deadline"
- "Bottleneck detected in 'In Review' status"
- "John is overloaded with 15 tasks"
- Automated suggestions for task assignment

### 5. Dashboard Subscriptions

- Email daily/weekly dashboard summary
- Scheduled PDF export
- Slack/Teams integration
- Custom alerts for metrics thresholds

---

## 🎬 Summary

### What's Done ✅

- Interactive charts (UX-011) - **Just completed!**
- Core dashboard metrics and visualizations
- Filtering and date range selection
- Dark mode support
- Refresh functionality

### What's Next 🚧

- **Immediate:** Color contrast audit (2-4 hours)
- **Short-term:** Backend optimization + caching (12-16 hours)
- **Medium-term:** Activity feed + export (26-33 hours)
- **Long-term:** Advanced widgets + AI insights (40+ hours)

### Priority Focus

For the next iteration, focus on:

1. **Accessibility** (A11Y-004) - Quick win, high impact
2. **Performance** (PERF-002, Caching) - Better UX at scale
3. **Usability** (MIN-002, Date Range) - Polish existing features

The dashboard is already functional and impressive. These enhancements will make it production-ready and enterprise-grade! 🚀
