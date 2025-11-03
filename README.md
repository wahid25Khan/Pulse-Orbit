# Pulse Orbit - Code Review & Issue Tracking# Pulse Orbit



## Exception pattern for LWC and Aura## Exception pattern for LWC and Aura



To surface user-friendly errors in both LWC and Aura contexts, use the shared helper `AuraErrorUtil.throwAuraOrIllegal(message)`:To surface user-friendly errors in both LWC and Aura contexts, use the shared helper `AuraErrorUtil.throwAuraOrIllegal(message)`:



- In Aura contexts, it throws `AuraHandledException` so the client receives a handled error.- In Aura contexts, it throws `AuraHandledException` so the client receives a handled error.

- In LWC (and when AuraHandledException isn't available in the local toolchain), it falls back to `IllegalArgumentException`.- In LWC (and when AuraHandledException isn’t available in the local toolchain), it falls back to `IllegalArgumentException`.



How to use in Apex controllers/services:How to use in Apex controllers/services:



```apex```

if (String.isBlank(issueId)) {if (String.isBlank(issueId)) {

	AuraErrorUtil.throwAuraOrIllegal('Issue ID cannot be blank');	AuraErrorUtil.throwAuraOrIllegal('Issue ID cannot be blank');

}}

``````



**Note**: As of November 2025, `AuraErrorUtil` has been simplified to use `IllegalArgumentException` directly since `AuraHandledException` is not available in the current Salesforce API version.Notes:



# Pulse Orbit Kanban (Salesforce DX)- Some local Apex language servers may flag `AuraHandledException` as an invalid type; the org compiles and deploys successfully. Centralizing usage in `AuraErrorUtil` keeps warnings localized.

- Prefer throwing early with clear messages so LWC/Aura UIs can display them directly.

Working notes for the Pulse Orbit Kanban experience. Use this doc to understand the shape of the solution, how to get it running, and where we still have work to do.

# Pulse Orbit Kanban (Salesforce DX)

## TL;DR

Working notes for the Pulse Orbit Kanban experience. Use this doc to understand the shape of the solution, how to get it running, and where we still have work to do.

- LWC-driven Kanban board backed by the custom object `TLG_Task__c` plus optional Case support.

- Apex services provide task CRUD, flexible querying, file associations, time logging, and comment storage.## TL;DR

- Timeline dashboard component for day/week/month/year views with customizable grouping.

- Several functional gaps remain; see the issue snapshot below before promoting to higher environments.- LWC-driven Kanban board backed by the custom object `TLG_Task__c` plus optional Case support.

- Apex services provide task CRUD, flexible querying, file associations, time logging, and comment storage.

## Workspace layout- Several functional gaps remain; see the issue snapshot below before promoting to higher environments.



- `force-app/main/default` – deployable Salesforce metadata (Apex, LWC, objects, static resources).## Workspace layout

- `config/project-scratch-def.json` – scratch org shape.

- `manifest/package.xml` – manifest for selective deployments.- `force-app/main/default` – deployable Salesforce metadata (Apex, LWC, objects, static resources).

- `Pulse-Orbit.code-workspace` – VS Code workspace helpers.- `config/project-scratch-def.json` – scratch org shape.

- `scripts/apex/` – utility scripts for seeding data and debugging.- `manifest/package.xml` – manifest for selective deployments.

- `Pulse-Orbit.code-workspace` – VS Code workspace helpers.

## Architecture highlights

## Architecture highlights

- **Apex services**: `KanbanBoardController` acts as the LWC façade; `TaskQueryService`, `TaskManagementService`, `TaskCommentService`, `FileManagementService`, and `ProjectService` encapsulate most logic.

- **Lightning Web Components**: - **Apex services**: `KanbanBoardController` acts as the LWC façade; `TaskQueryService`, `TaskManagementService`, `TaskCommentService`, `FileManagementService`, and `ProjectService` encapsulate most logic.

  - `lwc/kanbanBoard` (primary board, drawers, filters, drag/drop)- **Lightning Web Components**: `lwc/kanbanBoard` (primary board, drawers, filters, drag/drop), `kanbanDashboard` (placeholder analytics), `kanbanUnified` (secondary view), and utility modules (data, drag, performance, helpers).

  - `lwc/taskTimeline` (timeline dashboard with multiple view modes)- **Data model & config**: `TLG_Task__c` (custom task), `TLG_TaskFeed__c` (time logging), `TLG_Kanban_Board_Config__c` (status color metadata), `TLG_Team_Status__c` (team-specific column order), `User.TLG_Collapsed_Columns__c` (user prefs).

  - `lwc/kanbanDashboard` (placeholder analytics)

  - `lwc/kanbanUnified` (secondary view)## Setup & deployment (PowerShell examples)

  - Utility modules: `kanbanDataService`, `kanbanDragService`, `kanbanPerformanceService`, `statusHelper`, `toastHelper`

- **Data model & config**: ```powershell

  - `TLG_Task__c` (custom task)# Authenticate your Dev Hub once

  - `TLG_TaskFeed__c` (time logging)sfdx auth:web:login -d -a DevHub

  - `TLG_Kanban_Board_Config__c` (status color metadata)

  - `TLG_Team_Status__c` (team-specific column order)# Create a fresh scratch org

  - `User.TLG_Collapsed_Columns__c` (user prefs)sfdx force:org:create -f config/project-scratch-def.json -s -a PulseOrbit



## Setup & deployment (PowerShell examples)# Push source and open the org

sfdx force:source:push

```powershellsfdx force:org:open

# Authenticate your Dev Hub once

sf org login web -d -a DevHub# (Optional) deploy to another org via manifest

sfdx force:source:deploy -x manifest/package.xml -u <TargetAlias>

# Create a fresh scratch org```

sf org create scratch -f config/project-scratch-def.json -s -a PulseOrbit

## Running tests

# Push source and open the org

sf project deploy start```powershell

sf org open# Run all local tests

sf apex run test -l RunLocalTests -o PulseOrbit

# (Optional) deploy to another org via manifest

sf project deploy start -x manifest/package.xml -u <TargetAlias># Focus on the core service suites

```sf apex run test --tests TaskManagementServiceTest,TaskQueryServiceTest,TaskCommentServiceTest,KanbanTimeLogServiceTest -o PulseOrbit

```

## Running tests

## Issue backlog snapshot

```powershell

# Run all local tests| Severity | Area                 | Finding                                                                                                                                                                                            | Location / Notes                                                             |

sf apex run test -l RunLocalTests -o PulseOrbit| -------- | -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |

| High     | Functionality        | Fallback SOQL in `TaskQueryService.getTasks` builds malformed statements (`fbQuery += ' AND (Name LIKE ...`), so any failure in the primary query causes the retry to throw.                       | `force-app/main/default/classes/TaskQueryService.cls` lines ~140-170.        |

# Focus on the core service suites| Medium   | Data Integrity       | Map-based task create/update paths accept lookup Ids as raw `String`, but team/project filters rely on Ids; add validation and ensure lookups receive `Id` values to avoid runtime casting errors. | `force-app/main/default/classes/TaskManagementService.cls` lines ~110-200.   |

sf apex run test --tests TaskManagementServiceTest,TaskQueryServiceTest,TaskCommentServiceTest,KanbanTimeLogServiceTest -o PulseOrbit| Medium   | UX / Maintainability | `kanbanBoard.js` is ~3.3k lines with intertwined state, making regression risk high; split into child components/services and convert tracked Sets/Maps to immutable patterns for reactivity.      | `force-app/main/default/lwc/kanbanBoard/kanbanBoard.js`.                     |

```| Low      | Consistency          | Front-end caps uploads at 5 MB while `FileManagementService.validateFileSize` allows 10 MB; align limits so users don’t see mismatched errors.                                                     | `lwc/kanbanBoard/kanbanDataService.js`, `classes/FileManagementService.cls`. |



---_Use this list as a starting point—there are additional TODOs and placeholders (e.g., @mention notifications, dashboard metrics) that still need implementation._



## Issue backlog snapshot (Updated: November 3, 2025)## Roadmap next steps



### ✅ Recently Fixed Issues- Deliver comment/mention experience: replace ContentVersion placeholders with purpose-built storage/notifications.

- Modularise the LWC: extract drawers, filters, and card rendering into dedicated components with focused tests.

| Issue                                                             | Resolution                                                                                                    | Files Changed                                      | Date       |- Align validations: reconcile file-size limits, enforce required lookup fields, document team-status setup for admins.

| ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- | ---------- |

| Kanban collapse feature broken - method name mismatch             | Fixed HTML to call `handleColumnCollapseToggle`, added `data-collapsed` and `data-status` attributes         | `kanbanBoard.html`                                 | 2025-11-03 |## Contributing guidelines

| Test failures due to `AuraHandledException` type errors           | Updated test class to use `IllegalArgumentException`                                                          | `KanbanBoardControllerTest.cls`                    | 2025-11-03 |

| Timeline component missing features from design                   | Added Day/Week/Month/Year views, date picker, grouping options (Category/Status/Team/Assignee), time range   | `taskTimeline.js`, `taskTimeline.html`, `.css`    | 2025-11-03 |- Prefer Apex services over controller bloat; keep `KanbanBoardController` as orchestration only.

| `AuraErrorUtil` using unavailable `AuraHandledException`          | Simplified to throw `IllegalArgumentException` directly                                                       | `AuraErrorUtil.cls`                                | 2025-11-03 |- Add Jest tests for new LWC logic and Apex unit tests for every service change.

| TaskQueryService fallback SOQL malformed                          | Fixed string concatenation in fallback query builder (lines 137-169)                                          | `TaskQueryService.cls`                             | 2025-11-03 |- Run `sf apex run test -l RunLocalTests` before pushing and attach screenshots for major UI updates.



### 🔴 Current Open Issues## Reference



| Severity | Area                 | Finding                                                                                                                                                                                            | Location / Notes                                                                                          | Priority |- `docs/` (if created) for admin guides and backlog grooming.

| -------- | -------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- | -------- |- Static resources (`force-app/main/default/staticresources`) provide shared styling for the Kanban UI.

| Medium   | Data Integrity       | Map-based task create/update paths accept lookup Ids as raw `String`, but team/project filters rely on Ids; add validation and ensure lookups receive `Id` values to avoid runtime casting errors. | `TaskManagementService.cls` lines ~110-200                                                                | Medium   |

| Medium   | UX / Maintainability | `kanbanBoard.js` is ~3.4k lines with intertwined state; consider refactoring into smaller child components and services for better maintainability                                                 | `kanbanBoard.js` (3439 lines total)                                                                       | Low      |```

| Low      | Consistency          | Front-end caps uploads at 5 MB while `FileManagementService.validateFileSize` allows 10 MB; align limits to avoid user confusion                                                                  | `kanbanDataService.js` line 174 (5MB) vs `FileManagementService.cls` line 105 (10MB)                     | Medium   |

| Low      | Code Organization    | Multiple "coming soon" placeholders for Export/Import Config, Compact View, Dashboard, Task Management view                                                                                       | `kanbanBoard.js` lines 905-975, sidebar nav in `kanbanBoard.html`                                        | Low      |```

| Low      | Documentation        | Missing JSDoc comments in several Apex service methods                                                                                                                                             | Various service classes                                                                                   | Low      |

### ⚠️ Known Limitations & Planned Features

- **@mention notifications**: UI exists but backend notification system not yet implemented
- **Dashboard analytics**: Navigation item present but metrics aggregation pending
- **Task Management view**: Alternative list/grid view for tasks marked as "Soon"
- **Column drag-reorder**: Manual order numbers work; UI drag-to-reorder not yet functional
- **Virtual scrolling**: Performance utilities ready but not integrated for large task lists (1000+ items)
- **Batch request optimization**: BatchRequestManager utility exists but not actively used

### 📊 Code Quality Metrics

- **Apex Classes**: 15 total (Controllers: 1, Services: 5, Tests: 9)
- **LWC Components**: 8 total
- **Lines of Code**:
  - `kanbanBoard.js`: 3,439 lines (largest component)
  - `kanbanBoard.css`: 4,956 lines (comprehensive styling)
  - Total Apex: ~4,500 lines
  - Total JavaScript: ~7,200 lines

### 🧪 Test Coverage

- All Apex service tests passing (19/19)
- Test classes:
  - `TaskManagementServiceTest`
  - `TaskQueryServiceTest`
  - `TaskCommentServiceTest`
  - `FileManagementServiceTest`
  - `KanbanBoardControllerTest`
  - `KanbanTimeLogServiceTest`
- **Note**: LWC Jest tests not yet implemented

---

## Roadmap next steps

1. **Fix file size limit discrepancy** (Quick win - Medium priority)
   - Change `FileManagementService.validateFileSize` from 10MB to 5MB to match front-end
   - Or update front-end validation to allow 10MB

2. **Add Id validation in TaskManagementService** (Medium priority)
   - Validate lookup field Ids before passing to SOQL
   - Add try-catch for Id casting with clear error messages

3. **Documentation improvements** (Low priority)
   - Add JSDoc to all public Apex methods
   - Document team status setup for administrators
   - Create admin guide in `docs/` folder

4. **Component modularization** (Future - Low priority)
   - Extract kanbanBoard drawers into separate components
   - Create reusable filter component
   - Split kanbanDataService into focused modules

5. **Feature implementation** (Future)
   - Deliver @mention notification system
   - Build dashboard analytics/metrics
   - Implement Task Management list view
   - Add column drag-reorder UI

---

## Contributing guidelines

- Prefer Apex services over controller bloat; keep `KanbanBoardController` as orchestration only.
- Add Jest tests for new LWC logic and Apex unit tests for every service change.
- Run `sf apex run test -l RunLocalTests` before pushing to ensure all tests pass.
- Attach screenshots for major UI updates in pull requests.
- Follow existing naming conventions and code organization patterns.
- Document all public methods with JSDoc/ApexDoc comments.

## Git workflow

```powershell
# Check current status
git status

# Stage changes
git add force-app/main/default/

# Commit with descriptive message
git commit -m "feat: Add timeline component with multi-view support"

# Push to remote
git push origin main
```

## Reference

- `docs/` (if created) for admin guides and backlog grooming.
- Static resources (`force-app/main/default/staticresources`) provide shared styling for the Kanban UI.
- `scripts/apex/` contains utility scripts for data seeding and debugging.

---

**Last Updated**: November 3, 2025  
**Version**: 0.1.0  
**Maintainers**: Pulse Orbit Development Team
