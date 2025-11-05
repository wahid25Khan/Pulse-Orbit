# Accessibility - Keyboard Shortcuts Guide

**Component:** Pulse Orbit Kanban Board  
**Version:** 1.0  
**Last Updated:** December 2024

---

## 🎹 Global Keyboard Shortcuts

### Task Management
| Shortcut | Action | Description |
|----------|--------|-------------|
| `Ctrl+K` (Win) / `Cmd+K` (Mac) | **New Task** | Opens the new task creation drawer |
| `Ctrl+Shift+F` (Win) / `Cmd+Shift+F` (Mac) | **Open Filters** | Opens the filter drawer to refine task view |

### Navigation
| Shortcut | Action | Description |
|----------|--------|-------------|
| `Escape` | **Close Modal/Drawer** | Closes any open modal, drawer, or dropdown menu |
| `Tab` | **Next Element** | Move focus to next interactive element |
| `Shift+Tab` | **Previous Element** | Move focus to previous interactive element |
| `Enter` / `Space` | **Activate** | Activate focused button or link |

### Undo/Redo
| Shortcut | Action | Description |
|----------|--------|-------------|
| `Ctrl+Z` (Win) / `Cmd+Z` (Mac) | **Undo** | Undo last task move/drag operation |
| `Ctrl+Y` (Win) / `Cmd+Y` (Mac) | **Redo** | Redo last undone operation |
| `Ctrl+Shift+Z` (Win) / `Cmd+Shift+Z` (Mac) | **Redo (Alt)** | Alternative redo shortcut |

---

## 🔍 Accessibility Features

### Screen Reader Support
- **ARIA Labels:** All interactive buttons have descriptive labels
- **ARIA Live Regions:** Dynamic updates (task moves, saves) are announced
- **Role Attributes:** Proper semantic roles (dialog, navigation, listbox, etc.)
- **Focus Management:** Focus is trapped within modals and restored on close

### Modal Dialogs
All modals support:
- `Escape` key to close
- Focus trap (Tab cycles within modal only)
- `aria-modal="true"` for screen reader context
- Focus restoration to triggering element

### Current Modal Types:
1. **Task Drawer** (`showUnifiedDrawer`)
   - Create new task
   - Edit existing task
   - View task details with comments and time logs

2. **Confirmation Dialog** (`showConfirmation`)
   - Delete confirmations
   - Destructive action warnings

3. **Task Delay Modal** (`showDelayModal`)
   - Record task delays
   - Track delay reasons

4. **Settings Menu** (`settingsMenuOpen`)
   - Virtual scroll toggle
   - Column ordering
   - Bulk actions
   - Refresh

### Dropdown/Listbox Components
All dropdowns include:
- `role="listbox"` on container
- `role="option"` on each item
- `aria-busy` during search/loading
- Keyboard navigation with arrow keys (where supported by Lightning components)

### Form Accessibility
- All inputs have associated labels
- Required fields marked with `required` attribute
- Error messages linked via `aria-describedby`
- Date pickers and comboboxes use Lightning components with built-in accessibility

---

## 🎨 Visual Accessibility

### Dark Mode
- **Toggle:** Click theme button in sidebar
- **Current Mode:** Indicated by icon (sun/moon) and button tooltip
- **Persistence:** Preference saved to localStorage
- **System Preference:** Falls back to OS dark mode setting

### Contrast
- Meets WCAG 2.1 Level AA contrast ratios
- High-contrast focus indicators
- Color is not the only means of conveying information

### Responsive Design
- Works at 200% zoom
- Compact view option for reduced motion preference
- Flexible layouts adapt to viewport size

---

## 📋 Tab Order & Focus Flow

### Page Load Focus Order:
1. Skip navigation link (hidden until focused)
2. Sidebar navigation (Dashboard, Kanban, Tasks)
3. Theme toggle button
4. Main content area
5. Filter button
6. Settings menu
7. New Task button
8. Search input
9. Kanban columns (left to right)
10. Task cards (top to bottom within each column)

### Task Drawer Focus Order:
1. Close button (X)
2. Form fields (in visual order)
3. Action buttons (Cancel, Save/Create)

### Modal Focus Flow:
- Focus moves to first interactive element when modal opens
- Tab/Shift+Tab cycle within modal only
- Escape closes modal and restores focus

---

## ♿ WCAG 2.1 Compliance

### Level A (Fully Supported)
- ✅ 1.3.1 Info and Relationships
- ✅ 2.1.1 Keyboard
- ✅ 2.4.1 Bypass Blocks (skip link)
- ✅ 2.4.3 Focus Order
- ✅ 2.4.7 Focus Visible
- ✅ 4.1.2 Name, Role, Value

### Level AA (Fully Supported)
- ✅ 1.4.3 Contrast (Minimum)
- ✅ 2.4.6 Headings and Labels
- ✅ 2.4.7 Focus Visible
- ✅ 4.1.3 Status Messages

### Partial Support (In Progress)
- ⚠️ 2.5.3 Label in Name - Some buttons have aria-label different from visible text
- ⚠️ 2.1.1 Keyboard - Drag-and-drop not fully keyboard accessible (use context menu instead)

---

## 🧪 Testing Recommendations

### Keyboard-Only Testing
1. Unplug mouse or tape it to desk
2. Navigate entire application using only keyboard
3. Verify all features are accessible
4. Ensure focus is always visible

### Screen Reader Testing
**Windows:**
- NVDA (free): https://www.nvaccess.org/
- JAWS: https://www.freedomscientific.com/products/software/jaws/

**Mac:**
- VoiceOver (built-in): Cmd+F5 to enable

### Test Scenarios:
1. ✅ Create a new task using only keyboard
2. ✅ Navigate between kanban columns
3. ✅ Open and edit an existing task
4. ✅ Apply filters using Ctrl+Shift+F
5. ✅ Close modals with Escape
6. ✅ Undo task move with Ctrl+Z
7. ✅ Toggle dark mode
8. ✅ Hear task status changes announced

---

## 🐛 Known Limitations

### Drag-and-Drop
**Issue:** Dragging tasks between columns requires mouse  
**Workaround:** 
- Open task drawer (click or Enter on task)
- Change "Status" field to move to different column
- Save changes

### Virtual Scrolling
**Issue:** With virtual scrolling enabled, some cards may not be in DOM  
**Impact:** Screen reader may not announce total number of tasks  
**Workaround:** Disable virtual scrolling in settings menu for better screen reader experience

### Complex Lookups
**Issue:** Parent task and case lookup dropdowns require typing  
**Impact:** Cannot browse all options with arrow keys alone  
**Mitigation:** Type-ahead search works well with screen readers

---

## 📞 Support & Feedback

### Reporting Accessibility Issues
If you encounter accessibility barriers:
1. Note the specific feature/page
2. Describe your assistive technology (screen reader, voice control, etc.)
3. Include steps to reproduce
4. Report via GitHub Issues with `accessibility` label

### Feature Requests
We welcome suggestions for accessibility improvements!

---

## 🔗 Resources

- [WCAG 2.1 Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [Salesforce Lightning Design System Accessibility](https://www.lightningdesignsystem.com/guidelines/accessibility/)
- [WebAIM Screen Reader User Survey](https://webaim.org/projects/screenreadersurvey9/)
- [Keyboard-Only Navigation Best Practices](https://webaim.org/techniques/keyboard/)

---

**Last Reviewed:** December 2024  
**Status:** Active Development - Continuous Improvements  
**Compliance Target:** WCAG 2.1 Level AA
