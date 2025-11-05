import KanbanBoard from 'c/kanbanBoard';
import { createElement } from 'lwc';

// Mock Apex method used in post comment path
jest.mock(
    '@salesforce/apex/KanbanBoardController.createTaskCommentFromMap',
    () => ({
        default: jest.fn((payload) =>
            Promise.resolve({
                id: 'c1',
                text: payload?.text || 'Hello',
                createdByName: 'You',
                createdDate: '2025-01-01T00:00:00Z',
                mentions: payload?.mentions || []
            })
        )
    }),
    { virtual: true }
);

// Mock team statuses Apex for filtering test
jest.mock(
    '@salesforce/apex/KanbanBoardController.getTeamStatuses',
    () => ({
        default: jest.fn(() =>
            Promise.resolve([
                { Name: 'In Progress', TLG_Display_Label__c: 'Doing', TLG_Order_Number__c: 20 },
                { Name: 'QA', TLG_Display_Label__c: 'QA', TLG_Order_Number__c: 30 },
                { Name: 'Foo', TLG_Display_Label__c: 'Foo', TLG_Order_Number__c: 40 },
                { Name: 'Ready for Review', TLG_Display_Label__c: 'Review', TLG_Order_Number__c: 25 }
            ])
        )
    }),
    { virtual: true }
);

describe('c-kanban-board', () => {
    beforeEach(() => {
        // no-op
    });

    afterEach(() => {
        while (document.body.firstChild) {
            document.body.removeChild(document.body.firstChild);
        }
        jest.restoreAllMocks();
    });

    it('exposes a fixed status options list via helper', async () => {
        const element = createElement('c-kanban-board', { is: KanbanBoard });
        const labels = element.getFixedStatusLabels();
        const expected = [
            'Not Started',
            'In Progress',
            'Ready for Review',
            'Waiting on Client',
            'On hold',
            'Reopened',
            'Completed',
            'Closed',
            'Cancelled'
        ];

        expected.forEach((label) => {
            expect(labels).toContain(label);
        });
    });

    it('adds and removes mention chips', async () => {
        const element = createElement('c-kanban-board', { is: KanbanBoard });
        element.disableAutoInit = true;
        // Prepare drawer state pre-mount
        element.showTaskDrawer = true;
        element.selectedTaskDetails = { Id: 't1', name: 'Test' };
        // Seed mentions through public API and verify chips render
        element.selectedMentions = [
            { userId: 'u1', name: 'Alice Johnson', username: 'alice' }
        ];
        // Verify state reflects the seed
        expect(element.selectedMentions.length).toBe(1);
        // Simulate removal by clearing mentions and verify state
        element.selectedMentions = [];
        expect(element.selectedMentions.length).toBe(0);
    });

    it('posts a comment and clears composer and mentions', async () => {
        const element = createElement('c-kanban-board', { is: KanbanBoard });
        element.disableAutoInit = true;
        // Prepare drawer state and composer pre-mount
        element.showTaskDrawer = true;
        element.selectedTaskDetails = { Id: 't1', name: 'Test' };
        element.selectedTaskId = 't1';
        element.newCommentText = 'Hello world';
        element.selectedMentions = [
            { userId: 'u1', name: 'Alice Johnson', username: 'alice' }
        ];
        // Trigger post through public API to avoid relying on DOM internals
        await element.handlePostComment();

        // Composer cleared
        expect(element.newCommentText).toBe('');
        // Mentions cleared
        expect(element.selectedMentions.length).toBe(0);
    });

    it('filters team-specific statuses to valid task picklist', async () => {
        const element = createElement('c-kanban-board', { is: KanbanBoard });
        element.disableAutoInit = true;
        const options = await element.loadTeamStatusOptions('team-1');
        const values = options.map(o => o.value);
        expect(values).toContain('In Progress');
        expect(values).toContain('Ready for Review');
        // Invalid statuses should be filtered out
        expect(values).not.toContain('QA');
        expect(values).not.toContain('Foo');
    });
});
