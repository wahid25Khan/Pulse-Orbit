@IsTest
private class KanbanTimeLogServiceTest {
  private static Opportunity makeProject() {
    Account acc = new Account(Name = 'Time Co');
    insert acc;
    Opportunity opp = new Opportunity(
      Name = 'Time Project',
      StageName = 'Prospecting',
      CloseDate = System.today().addDays(20),
      AccountId = acc.Id
    );
    insert opp;
    return opp;
  }

  private static Case makeCase(Account acc) {
    Case c = new Case(Subject = 'Time Test Case', Status = 'New', Origin = 'Phone', AccountId = acc.Id);
    insert c;
    return c;
  }

  private static TLG_Task__c makeTask(Opportunity opp, String name) {
    Account acc = [SELECT Id FROM Account WHERE Id = :opp.AccountId LIMIT 1];
    Case cse = makeCase(acc);
    TLG_Task__c t = new TLG_Task__c(
      Name = name,
      TLG_Status__c = 'Not Started',
      TLG_Priority__c = 'Medium',
      TLG_Opportunity__c = opp.Id,
      TLG_Case__c = cse.Id
    );
    insert t;
    return t;
  }

  // No user creation to keep tests simple and portable

  @IsTest static void testLogTime_CRUD_andTotals() {
    Opportunity opp = makeProject();
    TLG_Task__c task = makeTask(opp, 'Time Task');

    System.assertEquals(0, KanbanBoardController.getTotalLoggedTime(task.Id), 'Initially zero');

    Id log1 = KanbanBoardController.logTimeForTask(task.Id, 1.5, 'Initial work', Date.today());
    Id log2 = KanbanBoardController.logTimeForTask(task.Id, 2, 'More work', Date.today());

    System.assertNotEquals(null, log1);
    System.assertNotEquals(null, log2);

  Decimal total = KanbanBoardController.getTotalLoggedTime(task.Id);
  System.assertEquals(3.5, total, 'Total should sum');

    // Get entries
    List<KanbanBoardController.TimeLogEntry> entries = KanbanBoardController.getTimeLogsForTask(task.Id);
    System.assertEquals(2, entries.size(), 'Two entries');

    // Update first log
    Boolean ok = KanbanBoardController.updateTimeLog(log1, 2, 'Updated', Date.today());
    System.assertEquals(true, ok);
    System.assertEquals(Decimal.valueOf(4), KanbanBoardController.getTotalLoggedTime(task.Id), 'Updated total');

    // Delete first log
    ok = KanbanBoardController.deleteTimeLog(log1);
    System.assertEquals(true, ok);
    System.assertEquals(Decimal.valueOf(2), KanbanBoardController.getTotalLoggedTime(task.Id), 'After delete total');
  }

  @IsTest static void testLogTime_invalidParams() {
    Opportunity opp = makeProject();
    TLG_Task__c task = makeTask(opp, 'Time Task 2');

    // Invalid params
    Boolean threw = false; try { KanbanBoardController.logTimeForTask(null, 1, 'x', Date.today()); } catch (Exception e) { threw = true; }
    System.assertEquals(true, threw);
    threw = false; try { KanbanBoardController.logTimeForTask(task.Id, 0, 'x', Date.today()); } catch (Exception e) { threw = true; }
    System.assertEquals(true, threw);

  }
}