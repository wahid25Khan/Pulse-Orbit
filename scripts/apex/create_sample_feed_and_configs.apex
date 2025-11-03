// Creates a TaskFeed, Team Status, and Kanban Board Config sample records
Id taskId = Id.valueOf('a0PHr00000LvGUWMA3');

// TaskFeed sample
TLG_TaskFeed__c feed = new TLG_TaskFeed__c(
    TLG_Task__c = taskId,
    TLG_Description__c = 'Initial note on task creation',
    TLG_Date_Record__c = Date.today()
);
insert feed;
System.debug('NEW_TASKFEED_ID=' + feed.Id);

// Team Status sample (Name is required text on Name field)
TLG_Team_Status__c status = new TLG_Team_Status__c(
    Name = 'In Progress',
    TLG_Order_Number__c = 10
);
insert status;
System.debug('NEW_TEAM_STATUS_ID=' + status.Id);

// Kanban Board Config sample (Status Name unique)
TLG_Kanban_Board_Config__c conf = new TLG_Kanban_Board_Config__c(
    TLG_Status_Name__c = 'In Progress',
    TLG_Color_Code__c = '#10b981',
    TLG_Display_Order__c = 10,
    TLG_Is_Active__c = true,
    TLG_Max_Expanded_Columns__c = 3
);
insert conf;
System.debug('NEW_KBCONFIG_ID=' + conf.Id);
