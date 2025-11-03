import { LightningElement, api } from 'lwc';

export default class KanbanCard extends LightningElement {
    @api issue; // normalized card object from kanbanBoard
    @api isDarkMode = false;

    get issueId() {
        return this.issue?.Id || this.issue?.id || '';
    }

    get displayTitle() {
        return this.issue?.title || this.issue?.Name || '';
    }

    get displayDescription() {
        return this.issue?.description || '';
    }

    get projectName() {
        return this.issue?.projectName || '';
    }

    get statusLabel() {
        return (
            this.issue?.status ||
            this.issue?.Status__c ||
            this.issue?.TLG_Status__c ||
            'Status'
        );
    }

    get priorityLabel() {
        const value = this.issue?.priority || this.issue?.Priority__c;
        return value ? String(value) : '';
    }

    get priorityClass() {
        const base = ['chip', 'priority-chip'];
        const priorityValue = (this.priorityLabel || '').toLowerCase();

        if (priorityValue === 'high') {
            base.push('priority-high');
        } else if (priorityValue === 'medium') {
            base.push('priority-medium');
        } else if (priorityValue === 'low') {
            base.push('priority-low');
        } else {
            base.push('priority-default');
        }

        return base.join(' ');
    }

    get progressDisplay() {
        const raw =
            this.issue?.progress !== undefined && this.issue?.progress !== null
                ? this.issue.progress
                : this.issue?.Progress__c;

        if (raw === undefined || raw === null || raw === '') {
            return '--%';
        }

        if (typeof raw === 'number') {
            return `${Math.round(raw)}%`;
        }

        const strVal = String(raw);
        return strVal.endsWith('%') ? strVal : `${strVal}%`;
    }

    get detailHeadline() {
        return this.displayTitle || 'Untitled task';
    }

    get detailBody() {
        return (
            this.displayDescription ||
            this.issue?.notes ||
            'Add more context so teammates know what to tackle next.'
        );
    }

    get dueDate() {
        return this.issue?.dueDate || this.issue?.DueDate__c || '';
    }

    get isOverdue() {
        if (!this.dueDate) return false;
        try {
            const d = new Date(this.dueDate);
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            return d < today;
        } catch (e) {
            return false;
        }
    }

    get dueClass() {
        return `due-badge ${this.isOverdue ? 'overdue' : ''}`;
    }

    get dueTitle() {
        return this.isOverdue ? `Due ${this.dueDate} (overdue)` : `Due ${this.dueDate}`;
    }

    get dueBadgeText() {
        return this.dueDate ? this.dueDate : '';
    }

    get cardClass() {
        return `kanban-card ${this.isDarkMode ? 'dark-theme' : 'light-theme'}`;
    }

    get ariaLabel() {
        const parts = [];
        if (this.displayTitle) parts.push(this.displayTitle);
        if (this.issue?.status) parts.push(`Status ${this.issue.status}`);
        if (this.issue?.priority) parts.push(`Priority ${this.issue.priority}`);
        return parts.join(', ');
    }

    get assigneeList() {
        const people = new Map(); // Use Map to avoid duplicates by ID/name
        
        // Add assigned users
        const rawAssignees = Array.isArray(this.issue?.assignees)
            ? this.issue.assignees
            : [];
        const fallbackName = this.issue?.assignedToName || this.issue?.assignedTo;

        const assigneeList = rawAssignees.length ? rawAssignees : fallbackName ? [fallbackName] : [];
        
        assigneeList.forEach((item, index) => {
            const normalized = typeof item === 'string' ? { name: item } : item || {};
            const name =
                normalized.name ||
                normalized.fullName ||
                normalized.label ||
                fallbackName ||
                'Unassigned';
            const id = normalized.Id || normalized.id || `assignee-${name}-${index}`;
            
            if (!people.has(id)) {
                people.set(id, {
                    key: id,
                    name,
                    initials: this.buildInitials(name),
                    photo: normalized.photoUrl || normalized.avatarUrl || normalized.imageUrl || normalized.photo || '',
                    hasPhoto: Boolean(normalized.photoUrl || normalized.avatarUrl || normalized.imageUrl || normalized.photo),
                    role: 'assignee'
                });
            }
        });

        // Add contributors from taskFeed
        const taskFeeds = Array.isArray(this.issue?.taskFeeds) ? this.issue.taskFeeds : [];
        taskFeeds.forEach((feed, index) => {
            const contributorName = feed.createdByName || feed.CreatedBy?.Name;
            const contributorId = feed.CreatedById || feed.CreatedBy?.Id || `contributor-${contributorName}-${index}`;
            
            if (contributorName && contributorId && !people.has(contributorId)) {
                people.set(contributorId, {
                    key: contributorId,
                    name: contributorName,
                    initials: this.buildInitials(contributorName),
                    photo: feed.CreatedBy?.SmallPhotoUrl || feed.createdByPhoto || '',
                    hasPhoto: Boolean(feed.CreatedBy?.SmallPhotoUrl || feed.createdByPhoto),
                    role: 'contributor'
                });
            }
        });

        // Return first 3 people (assignees prioritized first)
        return Array.from(people.values()).slice(0, 3);
    }

    get hasAssignees() {
        return this.assigneeList.length > 0;
    }

    get sliderDots() {
        return [0, 1, 2, 3].map((idx) => ({
            key: `dot-${idx}`,
            className: `nav-dot ${idx === 0 ? 'active' : ''}`
        }));
    }

    handleDragStart(event) {
        if (this.issueId) {
            event.dataTransfer.setData('text/plain', this.issueId);
        }
        // Visual dragging state
        try {
            event.currentTarget.classList.add('dragging');
        } catch (e) { /* noop */ }
        this.dispatchEvent(
            new CustomEvent('carddragstart', {
                detail: { issueId: this.issueId },
                bubbles: true,
                composed: true
            })
        );
    }

    handleDragEnd(event) {
        // Remove visual dragging state
        try {
            event.currentTarget.classList.remove('dragging');
        } catch (e) { /* noop */ }
    }

    handleClick() {
        // Let parent click handler on the component tag receive the event
        // No-op: parent is already listening to onclick on <c-kanban-card>
    }

    handleTimeLogClick(event) {
        event.stopPropagation();
        this.dispatchEvent(
            new CustomEvent('timelogrequest', {
                detail: { taskId: this.issueId },
                bubbles: true,
                composed: true
            })
        );
    }

    // Make the handle purely visual and prevent click from triggering card click
    handleDragHandleMouseDown(event) {
        event.stopPropagation();
    }

    buildInitials(name = '') {
        if (!name) {
            return '?';
        }
        const parts = name
            .split(/\s+/)
            .filter(Boolean)
            .slice(0, 2);
        if (!parts.length) {
            return name.substring(0, 2).toUpperCase();
        }
        return parts
            .map((part) => part.charAt(0).toUpperCase())
            .join('');
    }
}
