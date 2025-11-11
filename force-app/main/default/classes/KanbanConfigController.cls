public with sharing class KanbanConfigController {
    public class UserVisibleException extends Exception {}
    @AuraEnabled(cacheable=true)
    public static List<TLG_Kanban_Board_Config__c> getConfigs() {
        return [
            SELECT Id,
                   TLG_Status_Name__c,
                   TLG_Color_Code__c,
                   TLG_Display_Order__c,
                   TLG_Is_Active__c,
                   TLG_Max_Expanded_Columns__c,
                   TLG_Card_Gradient_Light_Top__c,
                   TLG_Card_Gradient_Light_Bottom__c,
                   TLG_Card_Gradient_Dark_Top__c,
                   TLG_Card_Gradient_Dark_Bottom__c,
                   TLG_Collapsed_Color_Start__c,
                   TLG_Collapsed_Color_End__c
            FROM TLG_Kanban_Board_Config__c
            ORDER BY TLG_Display_Order__c ASC, TLG_Status_Name__c ASC
        ];
    }

    // ===== Team Status management =====

    @AuraEnabled(cacheable=true)
    public static List<TLG_Team_Status__c> getTeamStatuses() {
        return [
            SELECT Id,
                   Name,
                   TLG_Order_Number__c
            FROM TLG_Team_Status__c
            ORDER BY TLG_Order_Number__c ASC, Name ASC
        ];
    }

    @AuraEnabled
    public static List<TLG_Team_Status__c> upsertTeamStatuses(List<TLG_Team_Status__c> statuses) {
        if (statuses == null || statuses.isEmpty()) return new List<TLG_Team_Status__c>();
        try {
            upsert statuses;
            Set<Id> ids = new Set<Id>();
            for (TLG_Team_Status__c s : statuses) if (s.Id != null) ids.add(s.Id);
            if (ids.isEmpty()) return new List<TLG_Team_Status__c>();
            return [SELECT Id, Name, TLG_Order_Number__c FROM TLG_Team_Status__c WHERE Id IN :ids];
        } catch (DmlException e) {
            throw new UserVisibleException('Save failed: ' + e.getDmlMessage(0));
        }
    }

    @AuraEnabled
    public static TLG_Team_Status__c createTeamStatus(TLG_Team_Status__c status) {
        if (status == null) throw new UserVisibleException('No data to create');
        try {
            insert status;
            return [SELECT Id, Name, TLG_Order_Number__c FROM TLG_Team_Status__c WHERE Id = :status.Id LIMIT 1];
        } catch (DmlException e) {
            throw new UserVisibleException('Create failed: ' + e.getDmlMessage(0));
        }
    }

    @AuraEnabled
    public static void deleteTeamStatuses(List<Id> ids) {
        if (ids == null || ids.isEmpty()) return;
        try {
            delete [SELECT Id FROM TLG_Team_Status__c WHERE Id IN :ids];
        } catch (DmlException e) {
            throw new UserVisibleException('Delete failed: ' + e.getDmlMessage(0));
        }
    }

    @AuraEnabled
    public static List<TLG_Kanban_Board_Config__c> upsertConfigs(List<TLG_Kanban_Board_Config__c> configs) {
        if (configs == null || configs.isEmpty()) return new List<TLG_Kanban_Board_Config__c>();
        try {
            upsert configs;
            // Requery to return fresh values
            Set<Id> ids = new Set<Id>();
            for (TLG_Kanban_Board_Config__c c : configs) {
                if (c.Id != null) ids.add(c.Id);
            }
            if (!ids.isEmpty()) {
                return [
                    SELECT Id,
                           TLG_Status_Name__c,
                           TLG_Color_Code__c,
                           TLG_Display_Order__c,
                           TLG_Is_Active__c,
                           TLG_Max_Expanded_Columns__c
                    FROM TLG_Kanban_Board_Config__c
                    WHERE Id IN :ids
                ];
            }
            return new List<TLG_Kanban_Board_Config__c>();
        } catch (DmlException e) {
            throw new UserVisibleException('Save failed: ' + e.getDmlMessage(0));
        }
    }

    @AuraEnabled
    public static TLG_Kanban_Board_Config__c createConfig(TLG_Kanban_Board_Config__c config) {
    if (config == null) throw new UserVisibleException('No data to create');
        try {
            insert config;
            return [
                SELECT Id,
                       TLG_Status_Name__c,
                       TLG_Color_Code__c,
                       TLG_Display_Order__c,
                       TLG_Is_Active__c,
                       TLG_Max_Expanded_Columns__c
                FROM TLG_Kanban_Board_Config__c
                WHERE Id = :config.Id
                LIMIT 1
            ];
        } catch (DmlException e) {
            throw new UserVisibleException('Create failed: ' + e.getDmlMessage(0));
        }
    }

    @AuraEnabled
    public static void deleteConfigs(List<Id> ids) {
        if (ids == null || ids.isEmpty()) return;
        try {
            delete [SELECT Id FROM TLG_Kanban_Board_Config__c WHERE Id IN :ids];
        } catch (DmlException e) {
            throw new UserVisibleException('Delete failed: ' + e.getDmlMessage(0));
        }
    }
}