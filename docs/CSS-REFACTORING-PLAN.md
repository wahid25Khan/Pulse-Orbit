# CSS !important Refactoring Plan (Issue #008)

## Current State

- **60+ !important declarations** found in kanbanBoard.css
- File size: 5,943 lines
- Most !important usage in:
  - Compact view overrides (lines 517-558)
  - Modal/drawer styling (lines 628-717)
  - Z-index declarations (lines 1506, 1518, 1526, 1532)
  - Transform/filter resets (lines 1710, 1763-1772)
  - Display overrides (lines 4326, 4420)

## Analysis

### Legitimate Use Cases (Keep !important):

1. **Utility classes** (`.compact-view`) - Override base styles
2. **SLDS token overrides** - CSS custom properties need !important
3. **Z-index layers** - Critical stacking context overrides
4. **Display:none overrides** - Hide elements across all contexts

### Should Remove !important:

1. **Compact view layout** - Use higher specificity selectors
2. **Modal styling** - Use proper selector chains
3. **Transform resets** - Use proper CSS cascade

## Refactoring Strategy

### Phase 1: Low-Risk Removals (This PR)

- Document current !important usage
- Add comments explaining necessary !important
- Remove 2-3 obvious unnecessary !important declarations

### Phase 2: Structural Improvements (Future)

- Use BEM methodology for class naming
- Increase specificity with proper selectors instead of !important
- Split CSS into modular files:
  - kanbanBoard-base.css
  - kanbanBoard-compact.css
  - kanbanBoard-modal.css
  - kanbanBoard-theme.css

### Phase 3: Complete Refactor (Future)

- Migrate to CSS-in-JS or SLDS styling hooks
- Use CSS layers (@layer) for proper cascade management
- Implement design tokens consistently

## Immediate Action

Since this is a 6,000-line CSS file with complex interactions:

1. **Document** all !important usage (this file)
2. **Add comments** to explain necessary !important
3. **Remove 5-10** safe !important declarations
4. **Test thoroughly** to ensure no visual regressions
5. **Plan future refactor** as separate project

## Risk Assessment

- **High Risk**: Removing !important from compact view, modals, z-index
- **Medium Risk**: Removing from theme variables
- **Low Risk**: Removing from redundant declarations
- **Testing Required**: Full visual regression testing after changes

## Recommendation

Given the complexity and size, we should:

1. Fix the most egregious cases now (z-index: 999999)
2. Add documentation comments
3. Plan comprehensive refactor as Phase 2 project
4. Prioritize other issues (testing, accessibility) first
