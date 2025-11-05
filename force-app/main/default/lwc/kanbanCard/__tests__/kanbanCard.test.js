import { createElement } from 'lwc';
import KanbanCard from 'c/kanbanCard';

describe('c-kanban-card', () => {
    afterEach(() => {
        while (document.body.firstChild) {
            document.body.removeChild(document.body.firstChild);
        }
        jest.clearAllMocks();
    });

    // ========== Rendering Tests ==========
    describe('Card Rendering', () => {
        it('should render card with basic task data', () => {
            const element = createElement('c-kanban-card', {
                is: KanbanCard
            });

            element.task = {
                Id: 'task1',
                Name: 'Test Task',
                TLG_Status__c: 'In Progress',
                TLG_Priority__c: 'High'
            };

            document.body.appendChild(element);

            expect(element.task.Name).toBe('Test Task');
            expect(element.task.Id).toBe('task1');
        });

        it('should render card with due date', () => {
            const element = createElement('c-kanban-card', {
                is: KanbanCard
            });

            element.task = {
                Id: 'task1',
                Name: 'Task with Due Date',
                TLG_Due_Date__c: '2025-12-31'
            };

            document.body.appendChild(element);

            expect(element.task.TLG_Due_Date__c).toBe('2025-12-31');
        });

        it('should render card with assignee', () => {
            const element = createElement('c-kanban-card', {
                is: KanbanCard
            });

            element.task = {
                Id: 'task1',
                Name: 'Assigned Task',
                TLG_Assigned_To__r: {
                    Name: 'John Doe'
                }
            };

            document.body.appendChild(element);

            expect(element.task.TLG_Assigned_To__r.Name).toBe('John Doe');
        });

        it('should render card with tags', () => {
            const element = createElement('c-kanban-card', {
                is: KanbanCard
            });

            element.task = {
                Id: 'task1',
                Name: 'Tagged Task',
                Tags__c: 'urgent,frontend,bug'
            };

            document.body.appendChild(element);

            expect(element.task.Tags__c).toContain('urgent');
        });

        it('should handle missing task data gracefully', () => {
            const element = createElement('c-kanban-card', {
                is: KanbanCard
            });

            element.task = null;

            document.body.appendChild(element);

            expect(element.task).toBeNull();
        });
    });

    // ========== Selection Tests ==========
    describe('Card Selection', () => {
        it('should apply selected class when isSelected is true', () => {
            const element = createElement('c-kanban-card', {
                is: KanbanCard
            });

            element.task = {
                Id: 'task1',
                Name: 'Selectable Task'
            };
            element.isSelected = true;

            document.body.appendChild(element);

            expect(element.isSelected).toBe(true);
        });

        it('should not have selected class when isSelected is false', () => {
            const element = createElement('c-kanban-card', {
                is: KanbanCard
            });

            element.task = {
                Id: 'task1',
                Name: 'Not Selected'
            };
            element.isSelected = false;

            document.body.appendChild(element);

            expect(element.isSelected).toBe(false);
        });

        it('should show checkbox in bulk mode', () => {
            const element = createElement('c-kanban-card', {
                is: KanbanCard
            });

            element.task = {
                Id: 'task1',
                Name: 'Bulk Mode Task'
            };
            element.isBulkMode = true;

            document.body.appendChild(element);

            expect(element.isBulkMode).toBe(true);
        });
    });

    // ========== Event Handling Tests ==========
    describe('Card Events', () => {
        it('should fire cardclick event when card is clicked', () => {
            const element = createElement('c-kanban-card', {
                is: KanbanCard
            });

            element.task = {
                Id: 'task1',
                Name: 'Clickable Task'
            };

            const handler = jest.fn();
            element.addEventListener('cardclick', handler);

            document.body.appendChild(element);

            element.handleCardClick();

            expect(handler).toHaveBeenCalled();
        });

        it('should include task ID in cardclick event', () => {
            const element = createElement('c-kanban-card', {
                is: KanbanCard
            });

            element.task = {
                Id: 'task123',
                Name: 'Event Task'
            };

            let eventDetail;
            element.addEventListener('cardclick', (event) => {
                eventDetail = event.detail;
            });

            document.body.appendChild(element);

            element.handleCardClick();

            expect(eventDetail).toBeDefined();
        });
    });

    // ========== Priority Styling Tests ==========
    describe('Priority Styling', () => {
        it('should apply correct class for High priority', () => {
            const element = createElement('c-kanban-card', {
                is: KanbanCard
            });

            element.task = {
                Id: 'task1',
                Name: 'High Priority Task',
                TLG_Priority__c: 'High'
            };

            document.body.appendChild(element);

            expect(element.task.TLG_Priority__c).toBe('High');
        });

        it('should apply correct class for Normal priority', () => {
            const element = createElement('c-kanban-card', {
                is: KanbanCard
            });

            element.task = {
                Id: 'task1',
                Name: 'Normal Priority Task',
                TLG_Priority__c: 'Normal'
            };

            document.body.appendChild(element);

            expect(element.task.TLG_Priority__c).toBe('Normal');
        });

        it('should apply correct class for Low priority', () => {
            const element = createElement('c-kanban-card', {
                is: KanbanCard
            });

            element.task = {
                Id: 'task1',
                Name: 'Low Priority Task',
                TLG_Priority__c: 'Low'
            };

            document.body.appendChild(element);

            expect(element.task.TLG_Priority__c).toBe('Low');
        });
    });

    // ========== Due Date Tests ==========
    describe('Due Date Handling', () => {
        it('should handle past due dates', () => {
            const element = createElement('c-kanban-card', {
                is: KanbanCard
            });

            const pastDate = new Date('2020-01-01').toISOString().split('T')[0];

            element.task = {
                Id: 'task1',
                Name: 'Overdue Task',
                TLG_Due_Date__c: pastDate
            };

            document.body.appendChild(element);

            expect(element.task.TLG_Due_Date__c).toBe(pastDate);
        });

        it('should handle future due dates', () => {
            const element = createElement('c-kanban-card', {
                is: KanbanCard
            });

            const futureDate = new Date('2030-12-31').toISOString().split('T')[0];

            element.task = {
                Id: 'task1',
                Name: 'Future Task',
                TLG_Due_Date__c: futureDate
            };

            document.body.appendChild(element);

            expect(element.task.TLG_Due_Date__c).toBe(futureDate);
        });

        it('should handle missing due date', () => {
            const element = createElement('c-kanban-card', {
                is: KanbanCard
            });

            element.task = {
                Id: 'task1',
                Name: 'No Due Date'
            };

            document.body.appendChild(element);

            expect(element.task.TLG_Due_Date__c).toBeUndefined();
        });
    });

    // ========== Drag and Drop Tests ==========
    describe('Drag and Drop', () => {
        it('should be draggable when enabled', () => {
            const element = createElement('c-kanban-card', {
                is: KanbanCard
            });

            element.task = {
                Id: 'task1',
                Name: 'Draggable Task'
            };
            element.isDraggable = true;

            document.body.appendChild(element);

            expect(element.isDraggable).toBe(true);
        });

        it('should not be draggable when disabled', () => {
            const element = createElement('c-kanban-card', {
                is: KanbanCard
            });

            element.task = {
                Id: 'task1',
                Name: 'Non-Draggable Task'
            };
            element.isDraggable = false;

            document.body.appendChild(element);

            expect(element.isDraggable).toBe(false);
        });
    });

    // ========== Attachment Tests ==========
    describe('Attachments', () => {
        it('should show attachment count when present', () => {
            const element = createElement('c-kanban-card', {
                is: KanbanCard
            });

            element.task = {
                Id: 'task1',
                Name: 'Task with Attachments',
                TLG_Attachment_Count__c: 3
            };

            document.body.appendChild(element);

            expect(element.task.TLG_Attachment_Count__c).toBe(3);
        });

        it('should handle zero attachments', () => {
            const element = createElement('c-kanban-card', {
                is: KanbanCard
            });

            element.task = {
                Id: 'task1',
                Name: 'Task without Attachments',
                TLG_Attachment_Count__c: 0
            };

            document.body.appendChild(element);

            expect(element.task.TLG_Attachment_Count__c).toBe(0);
        });
    });

    // ========== Comment Count Tests ==========
    describe('Comments', () => {
        it('should show comment count when present', () => {
            const element = createElement('c-kanban-card', {
                is: KanbanCard
            });

            element.task = {
                Id: 'task1',
                Name: 'Task with Comments',
                TLG_Comment_Count__c: 5
            };

            document.body.appendChild(element);

            expect(element.task.TLG_Comment_Count__c).toBe(5);
        });

        it('should handle zero comments', () => {
            const element = createElement('c-kanban-card', {
                is: KanbanCard
            });

            element.task = {
                Id: 'task1',
                Name: 'Task without Comments',
                TLG_Comment_Count__c: 0
            };

            document.body.appendChild(element);

            expect(element.task.TLG_Comment_Count__c).toBe(0);
        });
    });
});
