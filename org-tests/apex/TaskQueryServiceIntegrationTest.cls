@IsTest
private class TaskQueryServiceIntegrationTest {
    private static Account makeAccount(String name) {
        Account acc = new Account(Name = name);
        insert acc;
        return acc;
    }

    private static Opportunity makeProject(Account acc, String name) {
        Opportunity opp = new Opportunity(
            Name = name,
            StageName = 'Prospecting',
            CloseDate = System.today().addDays(45),
            AccountId = acc.Id
        );
        insert opp;
        return opp;
    }

    private static Case makeCase(Account acc, String subject) {
        Case c = new Case(Subject = subject, Status = 'New', Origin = 'Phone', AccountId = acc.Id);
        insert c;
        return c;
    }

    private static TLG_Task__c makeTask(Opportunity opp, Case cse, String name, String status, String priority, Integer sortOrder) {
        TLG_Task__c t = new TLG_Task__c(
            Name = name,
            TLG_Status__c = status,
            TLG_Priority__c = priority,
            TLG_Opportunity__c = opp.Id,
            TLG_Case__c = cse.Id
        );
        if (sortOrder != null) t.TLG_Kanban_Sort_Order__c = sortOrder;
        insert t;
        return t;
    }

    @IsTest static void test_getTasks_defaultSort() {
        Account acc = makeAccount('IntT DefaultSort Co');
        Opportunity opp = makeProject(acc, 'IntT DefaultSort Project');
        Case cse = makeCase(acc, 'IntT DefaultSort Case');

        makeTask(opp, cse, 'IntT-DS-1', 'Not Started', 'Low', 3);
        makeTask(opp, cse, 'IntT-DS-2', 'Not Started', 'Medium', 1);
        makeTask(opp, cse, 'IntT-DS-3', 'Not Started', 'High', 2);

        TaskQueryService.TaskQueryParams p = new TaskQueryService.TaskQueryParams();
        p.searchTerm = 'IntT-DS-';
        p.status = 'Not Started';
        // default sort by TLG_Kanban_Sort_Order__c ASC
        p.limitCount = 10;
        List<TLG_Task__c> rows = TaskQueryService.getTasks(p);

        List<TLG_Task__c> ours = new List<TLG_Task__c>();
        for (TLG_Task__c t : rows) {
            if (t.Name != null && t.Name.startsWith('IntT-DS-')) ours.add(t);
        }
        System.assertEquals(3, ours.size(), 'Should return 3 matching tasks');
        System.assert(ours[0].TLG_Kanban_Sort_Order__c <= ours[1].TLG_Kanban_Sort_Order__c);
        System.assert(ours[1].TLG_Kanban_Sort_Order__c <= ours[2].TLG_Kanban_Sort_Order__c);
    }

    @IsTest static void test_getFilteredTasks_statusAndSearch() {
        Account acc = makeAccount('IntT StatusSearch Co');
        Opportunity opp = makeProject(acc, 'IntT StatusSearch Project');
        Case cse = makeCase(acc, 'IntT StatusSearch Case');

        TLG_Task__c t1 = makeTask(opp, cse, 'IntT-FindMe-123', 'In Progress', 'Medium', 1);
        makeTask(opp, cse, 'IntT-Other', 'Not Started', 'Low', 2);

        Map<String, Object> filters = new Map<String, Object>{
            'status' => 'In Progress',
            'searchTerm' => 'IntT-FindMe-'
        };

        List<TLG_Task__c> rows = TaskQueryService.getFilteredTasks(filters);
        System.assertEquals(1, rows.size(), 'Only matching status+search should return');
        System.assertEquals(t1.Id, rows[0].Id, 'Should return the matching task');
    }

    @IsTest static void test_getFilteredTasks_limit() {
        Account acc = makeAccount('IntT Limit Co');
        Opportunity opp = makeProject(acc, 'IntT Limit Project');
        Case cse = makeCase(acc, 'IntT Limit Case');

        for (Integer i = 0; i < 5; i++) {
            makeTask(opp, cse, 'IntT-Limit-' + i, 'Not Started', 'Medium', i);
        }
        Map<String, Object> filters = new Map<String, Object>{
            'searchTerm' => 'IntT-Limit-',
            'limitCount' => 2
        };
        List<TLG_Task__c> rows = TaskQueryService.getFilteredTasks(filters);
        System.assertEquals(2, rows.size(), 'Limit should apply');
    }

    @IsTest static void test_getTasks_sortDescending() {
        Account acc = makeAccount('IntT Sort Co');
        Opportunity opp = makeProject(acc, 'IntT Sort Project');
        Case cse = makeCase(acc, 'IntT Sort Case');

        makeTask(opp, cse, 'IntT-Order-A', 'Not Started', 'Low', 1);
        makeTask(opp, cse, 'IntT-Order-B', 'Not Started', 'Low', 3);
        makeTask(opp, cse, 'IntT-Order-C', 'Not Started', 'Low', 2);

        TaskQueryService.TaskQueryParams p = new TaskQueryService.TaskQueryParams();
        p.searchTerm = 'IntT-Order-';
        p.sortField = 'TLG_Kanban_Sort_Order__c';
        p.sortOrder = 'DESC';
        p.limitCount = 3;
        List<TLG_Task__c> rows = TaskQueryService.getTasks(p);

        List<Integer> orders = new List<Integer>();
        for (TLG_Task__c t : rows) {
            if (t.Name != null && t.Name.startsWith('IntT-Order-') && t.TLG_Kanban_Sort_Order__c != null) {
                orders.add(Integer.valueOf(t.TLG_Kanban_Sort_Order__c));
            }
        }
        System.assertEquals(3, orders.size(), 'Expect three matching rows');
        System.assert(orders[0] > orders[1] && orders[1] > orders[2], 'DESC ordering expected');
    }

    @IsTest static void test_getFilteredTasks_pagingOffset() {
        Account acc = makeAccount('IntT Paging Co');
        Opportunity opp = makeProject(acc, 'IntT Paging Project');
        Case cse = makeCase(acc, 'IntT Paging Case');

        makeTask(opp, cse, 'IntT-Page-1', 'Not Started', 'Low', 1);
        makeTask(opp, cse, 'IntT-Page-2', 'Not Started', 'Low', 2);
        makeTask(opp, cse, 'IntT-Page-3', 'Not Started', 'Low', 3);

        Map<String, Object> filters = new Map<String, Object>{
            'searchTerm' => 'IntT-Page-',
            'limitCount' => 1,
            'offset' => 1,
            'sortField' => 'TLG_Kanban_Sort_Order__c',
            'sortOrder' => 'ASC'
        };
        List<TLG_Task__c> page2 = TaskQueryService.getFilteredTasks(filters);
        System.assertEquals(1, page2.size(), 'One record on page 2');
        System.assertEquals(2, page2[0].TLG_Kanban_Sort_Order__c, 'Second item by order');
    }
}
