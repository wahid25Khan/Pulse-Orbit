@IsTest
private class TaskMgmtStatusValidationTest {

  @TestSetup
  static void setupTestData() {
    // Create Account and Case for master-detail relationship
    Account acc = new Account(Name = 'Test Account');
    insert acc;

    Case testCase = new Case(
      Subject = 'Test Case',
      Status = 'New',
      Origin = 'Phone',
      AccountId = acc.Id
    );
    insert testCase;

    // Create Opportunity for testing
    Opportunity opp = new Opportunity(
      Name = 'Test Project',
      StageName = 'Prospecting',
      CloseDate = System.today().addDays(30),
      AccountId = acc.Id
    );
    insert opp;

    // Create Kanban Board Configs for valid statuses
    List<TLG_Kanban_Board_Config__c> configs = new List<TLG_Kanban_Board_Config__c>{
      new TLG_Kanban_Board_Config__c(
        TLG_Status_Name__c = 'To Do',
        TLG_Color_Code__c = '#3b82f6',
        TLG_Display_Order__c = 1,
        TLG_Is_Active__c = true
      ),
      new TLG_Kanban_Board_Config__c(
        TLG_Status_Name__c = 'In Progress',
        TLG_Color_Code__c = '#f59e0b',
        TLG_Display_Order__c = 2,
        TLG_Is_Active__c = true
      ),
      new TLG_Kanban_Board_Config__c(
        TLG_Status_Name__c = 'QA',
        TLG_Color_Code__c = '#8b5cf6',
        TLG_Display_Order__c = 3,
        TLG_Is_Active__c = true
      ),
      new TLG_Kanban_Board_Config__c(
        TLG_Status_Name__c = 'Done',
        TLG_Color_Code__c = '#10b981',
        TLG_Display_Order__c = 4,
        TLG_Is_Active__c = true
      ),
      new TLG_Kanban_Board_Config__c(
        TLG_Status_Name__c = 'Invalid Status',
        TLG_Color_Code__c = '#ef4444',
        TLG_Display_Order__c = 99,
        TLG_Is_Active__c = false // Inactive config
      )
    };
    insert configs;
  }

  @IsTest
  static void testMoveTask_ValidStatus() {
    // Get test data
    Case testCase = [SELECT Id FROM Case LIMIT 1];
    Opportunity opp = [SELECT Id FROM Opportunity LIMIT 1];

    // Create task with valid status
    TLG_Task__c task = new TLG_Task__c(
      Name = 'Test Task',
      TLG_Status__c = 'To Do',
      TLG_Priority__c = 'Medium',
      TLG_Opportunity__c = opp.Id,
      TLG_Case__c = testCase.Id
    );
    insert task;

    Test.startTest();
    TLG_Task__c movedTask = TaskManagementService.moveTask(task.Id, 'In Progress');
    Test.stopTest();

    System.assertEquals('In Progress', movedTask.TLG_Status__c);
  }

  @IsTest
  static void testMoveTask_InvalidStatus() {
    Case testCase = [SELECT Id FROM Case LIMIT 1];
    Opportunity opp = [SELECT Id FROM Opportunity LIMIT 1];

    TLG_Task__c task = new TLG_Task__c(
      Name = 'Test Task',
      TLG_Status__c = 'To Do',
      TLG_Priority__c = 'Medium',
      TLG_Opportunity__c = opp.Id,
      TLG_Case__c = testCase.Id
    );
    insert task;

    Boolean exceptionThrown = false;
    Test.startTest();
    try {
      TaskManagementService.moveTask(task.Id, 'Bogus Status');
    } catch (Exception e) {
      exceptionThrown = true;
    }
    Test.stopTest();

    System.assert(exceptionThrown);
  }

  @IsTest
  static void testCreateTaskFromMap_ValidStatus() {
    Case testCase = [SELECT Id FROM Case LIMIT 1];
    Opportunity opp = [SELECT Id FROM Opportunity LIMIT 1];

    Map<String, Object> taskData = new Map<String, Object>{
      'Name' => 'New Task',
      'TLG_Status__c' => 'QA',
      'TLG_Priority__c' => 'High',
      'TLG_Opportunity__c' => opp.Id,
      'TLG_Case__c' => testCase.Id
    };

    Test.startTest();
    TLG_Task__c created = TaskManagementService.createTaskFromMap(taskData);
    Test.stopTest();

    System.assertEquals('QA', created.TLG_Status__c);
  }

  @IsTest
  static void testCreateTaskFromMap_InvalidStatus() {
    Case testCase = [SELECT Id FROM Case LIMIT 1];
    Opportunity opp = [SELECT Id FROM Opportunity LIMIT 1];

    Map<String, Object> taskData = new Map<String, Object>{
      'Name' => 'New Task',
      'TLG_Status__c' => 'Bogus Status',
      'TLG_Priority__c' => 'High',
      'TLG_Opportunity__c' => opp.Id,
      'TLG_Case__c' => testCase.Id
    };

    Boolean exceptionThrown = false;
    Test.startTest();
    try {
      TaskManagementService.createTaskFromMap(taskData);
    } catch (Exception e) {
      exceptionThrown = true;
    }
    Test.stopTest();

    System.assert(exceptionThrown);
  }

  @IsTest
  static void testBulkUpdateTasks_ValidStatus() {
    Case testCase = [SELECT Id FROM Case LIMIT 1];
    Opportunity opp = [SELECT Id FROM Opportunity LIMIT 1];

    List<TLG_Task__c> tasks = new List<TLG_Task__c>();
    for (Integer i = 0; i < 3; i++) {
      tasks.add(new TLG_Task__c(
        Name = 'Bulk Task ' + i,
        TLG_Status__c = 'To Do',
        TLG_Priority__c = 'Medium',
        TLG_Opportunity__c = opp.Id,
        TLG_Case__c = testCase.Id
      ));
    }
    insert tasks;

    List<String> taskIds = new List<String>();
    for (TLG_Task__c t : tasks) {
      taskIds.add(t.Id);
    }

    Test.startTest();
    List<TLG_Task__c> updated = TaskManagementService.bulkUpdateTasks(
      taskIds, 
      new Map<String, Object>{'TLG_Status__c' => 'Done'}
    );
    Test.stopTest();

    System.assertEquals(3, updated.size());
    for (TLG_Task__c t : updated) {
      System.assertEquals('Done', t.TLG_Status__c);
    }
  }

  @IsTest
  static void testBulkUpdateTasks_InvalidStatus() {
    Case testCase = [SELECT Id FROM Case LIMIT 1];
    Opportunity opp = [SELECT Id FROM Opportunity LIMIT 1];

    TLG_Task__c task = new TLG_Task__c(
      Name = 'Bulk Task',
      TLG_Status__c = 'To Do',
      TLG_Priority__c = 'Medium',
      TLG_Opportunity__c = opp.Id,
      TLG_Case__c = testCase.Id
    );
    insert task;

    Boolean exceptionThrown = false;
    Test.startTest();
    try {
      TaskManagementService.bulkUpdateTasks(
        new List<String>{task.Id},
        new Map<String, Object>{'TLG_Status__c' => 'Bogus Status'}
      );
    } catch (Exception e) {
      exceptionThrown = true;
    }
    Test.stopTest();

    System.assert(exceptionThrown);
  }
}