TaskQueryService.TaskQueryParams params = new TaskQueryService.TaskQueryParams();
params.limitCount = 10;
List<TLG_Task__c> rows = TaskQueryService.getTasks(params);
System.debug('ROWS: ' + rows.size());
