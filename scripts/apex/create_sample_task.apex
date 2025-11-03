// Creates a sample TLG_Task__c linked to an existing Case by Id.
Id caseId = Id.valueOf('500Hr00001xOlS3IAK');
TLG_Task__c t = new TLG_Task__c(
    Name = 'Sample Kanban Task',
    TLG_Case__c = caseId
);
insert t;
System.debug('NEW_TASK_ID=' + t.Id);
