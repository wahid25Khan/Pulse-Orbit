// Seeds multiple records for Team Status and Kanban Board Config if missing
List<String> statusNames = new List<String>{'Backlog','In Progress','Blocked','Done'};
Map<String, Integer> orderMap = new Map<String, Integer>{
    'Backlog' => 10,
    'In Progress' => 20,
    'Blocked' => 30,
    'Done' => 40
};
Map<String, String> colorMap = new Map<String, String>{
    'Backlog' => '#94a3b8',      // slate-400
    'In Progress' => '#10b981',  // emerald-500
    'Blocked' => '#ef4444',      // red-500
    'Done' => '#3b82f6'          // blue-500
};

// TEAM STATUS: insert missing by Name
Map<String, TLG_Team_Status__c> existingStatuses = new Map<String, TLG_Team_Status__c>();
for (TLG_Team_Status__c ts : [SELECT Id, Name FROM TLG_Team_Status__c WHERE Name IN :statusNames]) {
    existingStatuses.put(ts.Name, ts);
}
List<TLG_Team_Status__c> toInsertStatuses = new List<TLG_Team_Status__c>();
for (String nm : statusNames) {
    if (!existingStatuses.containsKey(nm)) {
        toInsertStatuses.add(new TLG_Team_Status__c(
            Name = nm,
            TLG_Order_Number__c = orderMap.get(nm)
        ));
    }
}
if (!toInsertStatuses.isEmpty()) {
    insert toInsertStatuses;
}
System.debug('SEEDED_TEAM_STATUS_COUNT=' + toInsertStatuses.size());
for (TLG_Team_Status__c s : toInsertStatuses) {
    System.debug('TEAM_STATUS: ' + s.Name + ' => ' + s.Id);
}

// KANBAN BOARD CONFIG: insert missing by unique Status Name
Map<String, TLG_Kanban_Board_Config__c> existingConfs = new Map<String, TLG_Kanban_Board_Config__c>();
for (TLG_Kanban_Board_Config__c c : [SELECT Id, TLG_Status_Name__c FROM TLG_Kanban_Board_Config__c WHERE TLG_Status_Name__c IN :statusNames]) {
    existingConfs.put(c.TLG_Status_Name__c, c);
}
List<TLG_Kanban_Board_Config__c> toInsertConfs = new List<TLG_Kanban_Board_Config__c>();
for (String nm : statusNames) {
    if (!existingConfs.containsKey(nm)) {
        toInsertConfs.add(new TLG_Kanban_Board_Config__c(
            TLG_Status_Name__c = nm,
            TLG_Color_Code__c = colorMap.get(nm),
            TLG_Display_Order__c = orderMap.get(nm),
            TLG_Is_Active__c = true,
            TLG_Max_Expanded_Columns__c = 3
        ));
    }
}
if (!toInsertConfs.isEmpty()) {
    insert toInsertConfs;
}
System.debug('SEEDED_KBCONFIG_COUNT=' + toInsertConfs.size());
for (TLG_Kanban_Board_Config__c c : toInsertConfs) {
    System.debug('KBCONFIG: ' + c.TLG_Status_Name__c + ' => ' + c.Id);
}
