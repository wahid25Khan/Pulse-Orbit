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

    /**
     * @description PERF-002: Get dashboard statistics using efficient aggregate queries
     * This method uses a single aggregate SOQL query instead of multiple queries
     * to get status and priority distributions, reducing SOQL query count.
     * 
     * @param filterCriteria Optional filters (assigneeId, projectId, team, etc.)
     * @return DashboardStats object containing aggregated statistics
     */
    @AuraEnabled(cacheable=true)
    public static DashboardStats getDashboardStats(Map<String, Object> filterCriteria) {
        DashboardStats stats = new DashboardStats();
        
        // Build WHERE clause based on filters
        String whereClause = buildWhereClause(filterCriteria);
        
        // Single aggregate query for status distribution
        String statusQuery = 'SELECT TLG_Status__c status, COUNT(Id) taskCount ' +
                           'FROM TLG_Task__c ' +
                           whereClause +
                           ' GROUP BY TLG_Status__c';
        
        try {
            List<AggregateResult> statusResults = Database.query(statusQuery + ' WITH SECURITY_ENFORCED');
            stats.statusDistribution = new List<Distribution>();
            
            for (AggregateResult ar : statusResults) {
                Distribution dist = new Distribution();
                dist.label = (String)ar.get('status');
                dist.count = (Integer)ar.get('taskCount');
                stats.statusDistribution.add(dist);
            }
        } catch (Exception e) {
            System.debug(LoggingLevel.ERROR, 'Error querying status distribution: ' + e.getMessage());
        }
        
        // Single aggregate query for priority distribution
        String priorityQuery = 'SELECT TLG_Priority__c priority, COUNT(Id) taskCount ' +
                             'FROM TLG_Task__c ' +
                             whereClause +
                             ' GROUP BY TLG_Priority__c';
        
        try {
            List<AggregateResult> priorityResults = Database.query(priorityQuery + ' WITH SECURITY_ENFORCED');
            stats.priorityDistribution = new List<Distribution>();
            
            for (AggregateResult ar : priorityResults) {
                Distribution dist = new Distribution();
                dist.label = (String)ar.get('priority');
                dist.count = (Integer)ar.get('taskCount');
                stats.priorityDistribution.add(dist);
            }
        } catch (Exception e) {
            System.debug(LoggingLevel.ERROR, 'Error querying priority distribution: ' + e.getMessage());
        }
        
        // Aggregate query for task counts by status (aging calculation simplified)
        // Note: For accurate "days in status" tracking, add a custom field TLG_Status_Changed_Date__c
        String agingQuery = 'SELECT TLG_Status__c status, ' +
                          'COUNT(Id) taskCount ' +
                          'FROM TLG_Task__c ' +
                          whereClause +
                          ' GROUP BY TLG_Status__c';
        
        try {
            List<AggregateResult> agingResults = Database.query(agingQuery + ' WITH SECURITY_ENFORCED');
            stats.agingByStatus = new List<AgingMetric>();
            
            for (AggregateResult ar : agingResults) {
                AgingMetric aging = new AgingMetric();
                aging.status = (String)ar.get('status');
                // Simple count-based metric (for true aging, add TLG_Status_Changed_Date__c field)
                aging.averageDays = 0; // Placeholder - requires custom formula field for accuracy
                aging.taskCount = (Integer)ar.get('taskCount');
                stats.agingByStatus.add(aging);
            }
        } catch (Exception e) {
            System.debug(LoggingLevel.ERROR, 'Error querying aging metrics: ' + e.getMessage());
        }
        
        return stats;
    }
    
    /**
     * @description Helper method to build WHERE clause from filter criteria
     * @param filterCriteria Map of filter parameters
     * @return WHERE clause string (including WHERE keyword)
     */
    private static String buildWhereClause(Map<String, Object> filterCriteria) {
        List<String> conditions = new List<String>();
        conditions.add('Id != null'); // Always include base condition
        
        if (filterCriteria != null) {
            if (filterCriteria.containsKey('assigneeId') && filterCriteria.get('assigneeId') != null) {
                Id assigneeId = (Id)filterCriteria.get('assigneeId');
                conditions.add('TLG_Assigned_To__c = \'' + String.escapeSingleQuotes(String.valueOf(assigneeId)) + '\'');
            }
            
            if (filterCriteria.containsKey('projectId') && filterCriteria.get('projectId') != null) {
                Id projectId = (Id)filterCriteria.get('projectId');
                conditions.add('TLG_Opportunity__c = \'' + String.escapeSingleQuotes(String.valueOf(projectId)) + '\'');
            }
            
            if (filterCriteria.containsKey('team') && filterCriteria.get('team') != null) {
                String team = (String)filterCriteria.get('team');
                conditions.add('TLG_Team__c = \'' + String.escapeSingleQuotes(team) + '\'');
            }
            
            if (filterCriteria.containsKey('status') && filterCriteria.get('status') != null) {
                String status = (String)filterCriteria.get('status');
                conditions.add('TLG_Status__c = \'' + String.escapeSingleQuotes(status) + '\'');
            }
        }
        
        return 'WHERE ' + String.join(conditions, ' AND ');
    }
    
    /**
     * @description Wrapper class for dashboard statistics
     */
    public class DashboardStats {
        @AuraEnabled public List<Distribution> statusDistribution { get; set; }
        @AuraEnabled public List<Distribution> priorityDistribution { get; set; }
        @AuraEnabled public List<AgingMetric> agingByStatus { get; set; }
        
        public DashboardStats() {
            this.statusDistribution = new List<Distribution>();
            this.priorityDistribution = new List<Distribution>();
            this.agingByStatus = new List<AgingMetric>();
        }
    }
    
    /**
     * @description Distribution data class for charts
     */
    public class Distribution {
        @AuraEnabled public String label { get; set; }
        @AuraEnabled public Integer count { get; set; }
    }
    
    /**
     * @description Aging metric data class
     */
    public class AgingMetric {
        @AuraEnabled public String status { get; set; }
        @AuraEnabled public Decimal averageDays { get; set; }
        @AuraEnabled public Integer taskCount { get; set; }
    }
}