@IsTest
private class TaskCommentServiceTest {
  private static Opportunity makeProject() {
    Account acc = new Account(Name = 'Comment Co');
    insert acc;
    Opportunity opp = new Opportunity(
      Name = 'Comment Project',
      StageName = 'Prospecting',
      CloseDate = System.today().addDays(15),
      AccountId = acc.Id
    );
    insert opp;
    return opp;
  }

  private static Case makeCase(Account acc) {
    Case c = new Case(Subject = 'Comment Test Case', Status = 'New', Origin = 'Phone', AccountId = acc.Id);
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

  @IsTest static void testCommentCRUD_happyPath() {
    Opportunity opp = makeProject();
    TLG_Task__c task = makeTask(opp, 'Comment Task');

    // Create
    TaskCommentService.CommentWithTags input = new TaskCommentService.CommentWithTags();
    input.text = 'Hello comment';
    input.taskId = task.Id;
    input.mentions = new List<TaskCommentService.UserMention>();
    TaskCommentService.CommentDetails created = TaskCommentService.createTaskComment(input);
    System.assertNotEquals(null, created.id, 'Comment should be created');
    System.assertEquals('Hello comment', created.text);

    // Get
    List<TaskCommentService.CommentDetails> comments = TaskCommentService.getTaskComments(task.Id);
    System.assert(comments.size() >= 1, 'Should retrieve comments');

    // Update
    TaskCommentService.CommentDetails updated = TaskCommentService.updateTaskComment(created.id, 'Updated text');
    System.assertEquals('Updated text', updated.text);

    // Delete
    TaskCommentService.deleteTaskComment(created.id);
    List<TaskCommentService.CommentDetails> afterDelete = TaskCommentService.getTaskComments(task.Id);
    System.assert(afterDelete.size() <= comments.size() - 1 || afterDelete.isEmpty(), 'Comment should be removed');
  }
}
