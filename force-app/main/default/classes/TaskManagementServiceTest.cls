@IsTest
private class TaskManagementServiceTest {
  private static Opportunity makeProject() {
    Account acc = new Account(Name = 'Acme Co');
    insert acc;
    Opportunity opp = new Opportunity(
      Name = 'Project X',
      StageName = 'Prospecting',
      CloseDate = System.today().addDays(30),
      AccountId = acc.Id
    );
    insert opp;
    return opp;
  }

  private static Case makeCase(Account acc) {
    Case c = new Case(Subject = 'Test Case', Status = 'New', Origin = 'Phone', AccountId = acc.Id);
    insert c;
    return c;
  }

  private static TLG_Task__c makeTask(Opportunity opp, String name, String status, Integer sortOrder) {
    Account acc = [SELECT Id FROM Account WHERE Id = :opp.AccountId LIMIT 1];
    Case cse = makeCase(acc);
    TLG_Task__c t = new TLG_Task__c(
      Name = name,
      TLG_Status__c = status,
      TLG_Priority__c = 'Medium',
      TLG_Opportunity__c = opp.Id,
      TLG_Case__c = cse.Id
    );
    if (sortOrder != null) t.TLG_Kanban_Sort_Order__c = sortOrder;
    insert t;
    return t;
  }

  @IsTest static void testCreateUpdateMoveDeleteTask_happyPath() {
    Opportunity opp = makeProject();

    // Create
    Account acc = [SELECT Id FROM Account WHERE Id = :opp.AccountId LIMIT 1];
    Case cse = makeCase(acc);
    TLG_Task__c created = TaskManagementService.createTask(new TLG_Task__c(
      Name = 'Task A',
      TLG_Status__c = 'Not Started',
      TLG_Priority__c = 'Medium',
      TLG_Opportunity__c = opp.Id,
      TLG_Case__c = cse.Id
    ));
    System.assertNotEquals(null, created.Id, 'Task should be created');

    // Update
    created.TLG_Priority__c = 'High';
    TLG_Task__c updated = TaskManagementService.updateTask(created);
    System.assertEquals('High', updated.TLG_Priority__c, 'Priority should update');

    // Move
    TLG_Task__c moved = TaskManagementService.moveTask(String.valueOf(updated.Id), 'In Progress');
    System.assertEquals('In Progress', moved.TLG_Status__c, 'Status should change to In Progress');

    // Idempotent move (no change)
    TLG_Task__c movedAgain = TaskManagementService.moveTask(String.valueOf(updated.Id), 'In Progress');
    System.assertEquals('In Progress', movedAgain.TLG_Status__c, 'Status unchanged is allowed');

    // Update order (and optionally column)
    TLG_Task__c ordered = TaskManagementService.updateTaskOrder(String.valueOf(updated.Id), 10, 'In Progress');
    System.assertEquals(10, Integer.valueOf(ordered.TLG_Kanban_Sort_Order__c), 'Sort order should persist');

    // Delete
    TaskManagementService.deleteTask(String.valueOf(updated.Id));
    System.assertEquals(0, [SELECT count() FROM TLG_Task__c WHERE Id = :updated.Id], 'Task should be deleted');
  }

  @IsTest static void testBulkUpdateAndMapHelpers() {
    Opportunity opp = makeProject();
    Account acc = [SELECT Id FROM Account WHERE Id = :opp.AccountId LIMIT 1];
    Case cse = makeCase(acc);
    TLG_Task__c t1 = makeTask(opp, 'Task B1', 'Not Started', 1);
    TLG_Task__c t2 = makeTask(opp, 'Task B2', 'Not Started', 2);

    // Bulk update priority
    List<String> ids = new List<String>{ String.valueOf(t1.Id), String.valueOf(t2.Id) };
    Map<String, Object> updates = new Map<String, Object>{ 'TLG_Priority__c' => 'Low' };
    List<TLG_Task__c> result = TaskManagementService.bulkUpdateTasks(ids, updates);
    System.assertEquals(2, result.size(), 'Two tasks should update');
    for (TLG_Task__c t : [SELECT Id, TLG_Priority__c FROM TLG_Task__c WHERE Id IN :new List<Id>{t1.Id, t2.Id}]) {
      System.assertEquals('Low', t.TLG_Priority__c, 'Priority should be Low');
    }

    // Create from map
    Map<String, Object> data = new Map<String, Object>{
      'Name' => 'Task C',
      'TLG_Status__c' => 'Not Started',
      'TLG_Priority__c' => 'Medium',
      'TLG_Due_Date__c' => System.today().addDays(5),
      'TLG_Shared_Notes__c' => 'Note',
      'TLG_Team__c' => null
    };
    // add required project
    data.put('TLG_Opportunity__c', opp.Id);
    // add required case
    data.put('TLG_Case__c', cse.Id);
    TLG_Task__c created = TaskManagementService.createTaskFromMap(data);
    System.assertNotEquals(null, created.Id, 'Map create should work');

    // Update from map
    Map<String, Object> upd = new Map<String, Object>{ 'TLG_Priority__c' => 'High' };
    TLG_Task__c updated = TaskManagementService.updateTaskFromMap(created.Id, upd);
    System.assertEquals('High', updated.TLG_Priority__c, 'Map update should apply');
  }

  @IsTest static void testValidationEdgeCases() {
    Opportunity opp = makeProject();

    // Missing required fields on create
    Boolean threw = false;
    try {
      TaskManagementService.createTask(new TLG_Task__c());
    } catch (Exception e) { threw = true; }
    System.assertEquals(true, threw, 'Create without required fields should throw');

    // Move task with invalid params
    threw = false; try { TaskManagementService.moveTask(null, 'In Progress'); } catch (Exception e) { threw = true; }
    System.assertEquals(true, threw, 'Null taskId should throw');
    threw = false; try { TaskManagementService.moveTask('001000000000000', null); } catch (Exception e) { threw = true; }
    System.assertEquals(true, threw, 'Null status should throw');

    // Bulk update validation
    threw = false; try { TaskManagementService.bulkUpdateTasks(new List<String>(), new Map<String, Object>()); } catch (Exception e) { threw = true; }
    System.assertEquals(true, threw, 'Empty bulk params should throw');

    // Update order from list
    TLG_Task__c t = makeTask(opp, 'Task D', 'Not Started', 3);
    TaskManagementService.updateTaskOrder(new List<String>{ String.valueOf(t.Id) });
    System.assertEquals(1, [SELECT count() FROM TLG_Task__c WHERE Id = :t.Id], 'Task should still exist after order update');
  }
}
