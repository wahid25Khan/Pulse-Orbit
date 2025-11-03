// Increase Kanban max expanded columns to a more user-friendly default
List<TLG_Kanban_Board_Config__c> rows = [SELECT Id, TLG_Max_Expanded_Columns__c FROM TLG_Kanban_Board_Config__c];
for (TLG_Kanban_Board_Config__c r : rows) {
    // Set to 8 if null or less than 8
    if (r.TLG_Max_Expanded_Columns__c == null || r.TLG_Max_Expanded_Columns__c < 8) {
        r.TLG_Max_Expanded_Columns__c = 8;
    }
}
if (!rows.isEmpty()) update rows;
System.debug('Updated rows: ' + rows.size());
