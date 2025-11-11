@IsTest
private class KanbanBoardController_Test {
    @IsTest
    static void updateIssueStatus_blankId_throws() {
        Test.startTest();
        Boolean threw = false;
        try {
            KanbanBoardController.updateIssueStatus('', 'New');
        } catch (Exception e) {
            threw = true;
            System.assert(e.getMessage().contains('Issue ID cannot be blank'), 'Unexpected message: ' + e.getMessage());
        }
        Test.stopTest();
        System.assert(threw, 'Expected an exception to be thrown');
    }

    @IsTest
    static void createIssue_missingSubject_throws() {
        Test.startTest();
        Boolean threw = false;
        try {
            Map<String, Object> issueData = new Map<String, Object>{ 'Description' => 'No subject provided' };
            KanbanBoardController.createIssue(issueData);
        } catch (Exception e) {
            threw = true;
            System.assert(e.getMessage().contains('Issue subject is required'), 'Unexpected message: ' + e.getMessage());
        }
        Test.stopTest();
        System.assert(threw, 'Expected an exception to be thrown');
    }
}