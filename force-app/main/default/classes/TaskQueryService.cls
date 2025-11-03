/**
 * @description Service class for handling task queries and search operations.
 * Provides methods for retrieving tasks with various filtering options.
 */
public with sharing class TaskQueryService {

    /**
     * @description Task query parameters class for flexible task querying
     */
    public class TaskQueryParams {
        @AuraEnabled public String searchTerm { get; set; }
        @AuraEnabled public String status { get; set; }
        @AuraEnabled public String priority { get; set; }
        @AuraEnabled public Id projectId { get; set; }
        @AuraEnabled public Id assigneeId { get; set; }
        @AuraEnabled public String team { get; set; }
        @AuraEnabled public Integer limitCount { get; set; }
        @AuraEnabled public Integer offset { get; set; }
        @AuraEnabled public String sortField { get; set; }
        @AuraEnabled public String sortOrder { get; set; }
    }

    /**
     * @description Search for cases by term and optionally filter by opportunity
     * @param searchTerm The search term to use
     * @param opportunityId Optional opportunity ID to filter by
     * @return List of matching Case records
     */
    public static List<Case> searchCases(String searchTerm, Id opportunityId) {
        String searchQuery = '%' + String.escapeSingleQuotes(searchTerm) + '%';

        if (opportunityId != null) {
            return [
                SELECT Id, Subject, Status, Priority, CreatedDate
                FROM Case
                WHERE (Subject LIKE :searchQuery)
                AND AccountId IN (SELECT AccountId FROM Opportunity WHERE Id = :opportunityId)
                ORDER BY CreatedDate DESC
                LIMIT 100
            ];
        } else {
            return [
                SELECT Id, Subject, Status, Priority, CreatedDate
                FROM Case
                WHERE Subject LIKE :searchQuery
                ORDER BY CreatedDate DESC
                LIMIT 100
            ];
        }
    }

    /**
     * @description Get tasks based on provided query parameters
     * @param params The TaskQueryParams object containing search and filter criteria
    * @return List of matching TLG_Task__c records
     */
    public static List<TLG_Task__c> getTasks(TaskQueryParams params) {
        if (params == null) {
            params = new TaskQueryParams();
        }

        // Build a safe SELECT field list
        List<String> selectFields = new List<String>{
            'Id', 'Name', 'TLG_Status__c', 'TLG_Kanban_Sort_Order__c',
            'TLG_Priority__c', 'TLG_Due_Date__c', 'TLG_Shared_Notes__c',
            'TLG_Category__c', 'Total_Estimated_Time__c', 'Progress__c',
            'TLG_Case__c', 'Parent__c', 'CreatedDate', 'LastModifiedDate'
        };
        // Attempt to include optional fields; if FLS blocks these, we will retry without them
        selectFields.add('TLG_Assigned_To__c');
        selectFields.add('TLG_Opportunity__c');
        selectFields.add('TLG_Team__c');
        // Attempt to include related Team name for UI labeling
        selectFields.add('TLG_Team__r.Name');

        // Build the dynamic query
        String query = 'SELECT ' + String.join(selectFields, ', ') + ' FROM TLG_Task__c WHERE Id != null';

        // Add filters based on params
        if (params.searchTerm != null && params.searchTerm.trim() != '') {
            String searchTerm = '%' + String.escapeSingleQuotes(params.searchTerm.trim()) + '%';
                query += ' AND (Name LIKE ' + '\'' + searchTerm + '\'' + ')';
        }

        if (params.status != null && params.status.trim() != '') {
                query += ' AND TLG_Status__c = ' + '\'' + String.escapeSingleQuotes(params.status.trim()) + '\'';
        }

        if (params.priority != null && params.priority.trim() != '') {
                query += ' AND TLG_Priority__c = ' + '\'' + String.escapeSingleQuotes(params.priority.trim()) + '\'';
        }

        if (params.projectId != null) {
                query += ' AND TLG_Opportunity__c = ' + '\'' + String.valueOf(params.projectId) + '\'';
        }

        if (params.assigneeId != null) {
                query += ' AND TLG_Assigned_To__c = ' + '\'' + String.valueOf(params.assigneeId) + '\'';
        }

        if (params.team != null && params.team.trim() != '') {
                query += ' AND TLG_Team__c = ' + '\'' + String.escapeSingleQuotes(params.team.trim()) + '\'';
        }

        // Enforce object and field security for queried fields
        query += ' WITH SECURITY_ENFORCED';

        // Add sorting
        query += ' ORDER BY ' + (params.sortField != null ? String.escapeSingleQuotes(params.sortField) : 'TLG_Kanban_Sort_Order__c') +
                 ' ' + (params.sortOrder != null ? String.escapeSingleQuotes(params.sortOrder) : 'ASC');

        // Add limits
        if (params.limitCount != null && params.limitCount > 0) {
            query += ' LIMIT ' + params.limitCount;
        } else {
            query += ' LIMIT 1000'; // Default limit
        }

        if (params.offset != null && params.offset > 0) {
            query += ' OFFSET ' + params.offset;
        }

    // Execute the query and cast to the concrete sObject list type
    try {
        return (List<TLG_Task__c>) Database.query(query);
    } catch (Exception ex) {
        System.debug(LoggingLevel.WARN, 'Primary query failed, retrying without optional fields/filters. Query=' + query + ' message=' + ex.getMessage());

        // Build fallback query without optional fields and their filters
        List<String> baseFields = new List<String>{
            'Id', 'Name', 'TLG_Status__c', 'TLG_Kanban_Sort_Order__c'
        };
        String fbQuery = 'SELECT ' + String.join(baseFields, ', ') + ' FROM TLG_Task__c WHERE Id != null';

        if (params.searchTerm != null && params.searchTerm.trim() != '') {
            String searchTerm = '%' + String.escapeSingleQuotes(params.searchTerm.trim()) + '%';
                fbQuery += ' AND (Name LIKE ' + '\'' + searchTerm + '\'' + ')';
        }

        if (params.status != null && params.status.trim() != '') {
                fbQuery += ' AND TLG_Status__c = ' + '\'' + String.escapeSingleQuotes(params.status.trim()) + '\'';
        }

        if (params.priority != null && params.priority.trim() != '') {
                fbQuery += ' AND TLG_Priority__c = ' + '\'' + String.escapeSingleQuotes(params.priority.trim()) + '\'';
        }

        if (params.team != null && params.team.trim() != '') {
                fbQuery += ' AND TLG_Team__c = ' + '\'' + String.escapeSingleQuotes(params.team.trim()) + '\'';
        }

        fbQuery += ' WITH SECURITY_ENFORCED';
        fbQuery += ' ORDER BY ' + (params.sortField != null ? String.escapeSingleQuotes(params.sortField) : 'TLG_Kanban_Sort_Order__c') +
                 ' ' + (params.sortOrder != null ? String.escapeSingleQuotes(params.sortOrder) : 'ASC');

        if (params.limitCount != null && params.limitCount > 0) {
            fbQuery += ' LIMIT ' + params.limitCount;
        } else {
            fbQuery += ' LIMIT 1000';
        }

        if (params.offset != null && params.offset > 0) {
            fbQuery += ' OFFSET ' + params.offset;
        }

        try {
            return (List<TLG_Task__c>) Database.query(fbQuery);
        } catch (Exception ex2) {
            System.debug(LoggingLevel.ERROR, 'Fallback query failed. Query=' + fbQuery + ' message=' + ex2.getMessage());
            throw ex2;
        }
    }
    }

    /**
     * @description Get tasks filtered by criteria in a map
     * @param filterCriteria Map of field names to filter values
    * @return List of matching TLG_Task__c records
     */
    public static List<TLG_Task__c> getFilteredTasks(Map<String, Object> filterCriteria) {
        // Convert map to TaskQueryParams
        TaskQueryParams params = new TaskQueryParams();

        // Guard against null map to avoid NPEs from containsKey
        if (filterCriteria == null) {
            filterCriteria = new Map<String, Object>();
        }

        if (filterCriteria.containsKey('searchTerm')) {
            params.searchTerm = (String)filterCriteria.get('searchTerm');
        }

        if (filterCriteria.containsKey('status')) {
            params.status = (String)filterCriteria.get('status');
        }

        if (filterCriteria.containsKey('priority')) {
            params.priority = (String)filterCriteria.get('priority');
        }

        if (filterCriteria.containsKey('projectId')) {
            params.projectId = (Id)filterCriteria.get('projectId');
        }

        if (filterCriteria.containsKey('assigneeId')) {
            params.assigneeId = (Id)filterCriteria.get('assigneeId');
        }

        if (filterCriteria.containsKey('team')) {
            params.team = (String)filterCriteria.get('team');
        }

        if (filterCriteria.containsKey('limitCount')) {
            params.limitCount = (Integer)filterCriteria.get('limitCount');
        }

        if (filterCriteria.containsKey('offset')) {
            params.offset = (Integer)filterCriteria.get('offset');
        }

        if (filterCriteria.containsKey('sortField')) {
            params.sortField = (String)filterCriteria.get('sortField');
        }

        if (filterCriteria.containsKey('sortOrder')) {
            params.sortOrder = (String)filterCriteria.get('sortOrder');
        }

    return getTasks(params);
    }

    /**
     * @description Get all tasks (with default sorting and limits)
     * @return List of all TLG_Task__c records (up to the limit)
     */
    public static List<TLG_Task__c> getAllTasks() {
        return getTasks(new TaskQueryParams());
    }
}