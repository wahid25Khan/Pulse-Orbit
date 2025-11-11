/**
 * @description Service class for retrieving task activity feed
 * UX-013: Provides recent activity history for team collaboration
 */
public with sharing class ActivityFeedService {
    
    /**
     * @description Activity item wrapper for UI consumption
     */
    public class ActivityItem {
        @AuraEnabled public String id { get; set; }
        @AuraEnabled public String taskId { get; set; }
        @AuraEnabled public String taskName { get; set; }
        @AuraEnabled public String userName { get; set; }
        @AuraEnabled public String actionType { get; set; } // 'status_change', 'created', 'assigned', etc.
        @AuraEnabled public String oldValue { get; set; }
        @AuraEnabled public String newValue { get; set; }
        @AuraEnabled public DateTime timestamp { get; set; }
        @AuraEnabled public String formattedTime { get; set; }
        @AuraEnabled public String iconName { get; set; }
        @AuraEnabled public String iconVariant { get; set; }
    }
    
    /**
     * @description Get recent activity feed items
     * @param limitCount Number of items to retrieve (default 20)
     * @param teamId Optional team filter
     * @return List of ActivityItem objects
     */
    @AuraEnabled(cacheable=true)
    public static List<ActivityItem> getRecentActivity(Integer limitCount, String teamId) {
        List<ActivityItem> activities = new List<ActivityItem>();
        
        // Default limit
        if (limitCount == null || limitCount <= 0) {
            limitCount = 20;
        }
        // Cap at 50 for performance
        if (limitCount > 50) {
            limitCount = 50;
        }
        
        try {
            // Build query for task history
            String query = 'SELECT Id, Name, TLG_Task__c, TLG_Task__r.Name, ' +
                          'TLG_Status_Old_Value__c, TLG_Status_New_Value__c, ' +
                          'TLG_Date_Stamped__c, CreatedById, CreatedBy.Name, ' +
                          'CreatedDate, LastModifiedDate ' +
                          'FROM TLG_Task_History__c ';
            
            // Add team filter if provided
            List<String> conditions = new List<String>();
            if (String.isNotBlank(teamId)) {
                conditions.add('TLG_Task__r.TLG_Team__c = \'' + String.escapeSingleQuotes(teamId) + '\'');
            }
            
            if (!conditions.isEmpty()) {
                query += 'WHERE ' + String.join(conditions, ' AND ') + ' ';
            }
            
            query += 'ORDER BY CreatedDate DESC ';
            query += 'LIMIT ' + limitCount;
            query += ' WITH SECURITY_ENFORCED';
            
            List<TLG_Task_History__c> histories = Database.query(query);
            
            // Convert to activity items
            for (TLG_Task_History__c history : histories) {
                ActivityItem item = new ActivityItem();
                item.id = history.Id;
                item.taskId = history.TLG_Task__c;
                item.taskName = history.TLG_Task__r?.Name;
                item.userName = history.CreatedBy?.Name;
                item.timestamp = history.CreatedDate;
                
                // Determine action type and values
                if (String.isNotBlank(history.TLG_Status_Old_Value__c) && 
                    String.isNotBlank(history.TLG_Status_New_Value__c)) {
                    item.actionType = 'status_change';
                    item.oldValue = history.TLG_Status_Old_Value__c;
                    item.newValue = history.TLG_Status_New_Value__c;
                    item.iconName = 'utility:change_record_type';
                    item.iconVariant = 'success';
                } else {
                    // Default to generic update
                    item.actionType = 'updated';
                    item.iconName = 'utility:edit';
                    item.iconVariant = 'warning';
                }
                
                // Format relative time
                item.formattedTime = formatRelativeTime(history.CreatedDate);
                
                activities.add(item);
            }
            
        } catch (Exception e) {
            System.debug(LoggingLevel.ERROR, 'Error fetching activity feed: ' + e.getMessage());
            // Return empty list on error to avoid breaking UI
        }
        
        return activities;
    }
    
    /**
     * @description Get recent activity for specific task
     * @param taskId Task ID to get history for
     * @param limitCount Number of items to retrieve
     * @return List of ActivityItem objects
     */
    @AuraEnabled(cacheable=true)
    public static List<ActivityItem> getTaskActivity(String taskId, Integer limitCount) {
        List<ActivityItem> activities = new List<ActivityItem>();
        
        if (String.isBlank(taskId)) {
            return activities;
        }
        
        if (limitCount == null || limitCount <= 0) {
            limitCount = 10;
        }
        
        try {
            List<TLG_Task_History__c> histories = [
                SELECT Id, Name, TLG_Task__c, TLG_Task__r.Name,
                       TLG_Status_Old_Value__c, TLG_Status_New_Value__c,
                       CreatedById, CreatedBy.Name, CreatedDate
                FROM TLG_Task_History__c
                WHERE TLG_Task__c = :taskId
                WITH SECURITY_ENFORCED
                ORDER BY CreatedDate DESC
                LIMIT :limitCount
            ];
            
            for (TLG_Task_History__c history : histories) {
                ActivityItem item = new ActivityItem();
                item.id = history.Id;
                item.taskId = history.TLG_Task__c;
                item.taskName = history.TLG_Task__r?.Name;
                item.userName = history.CreatedBy?.Name;
                item.timestamp = history.CreatedDate;
                item.actionType = 'status_change';
                item.oldValue = history.TLG_Status_Old_Value__c;
                item.newValue = history.TLG_Status_New_Value__c;
                item.formattedTime = formatRelativeTime(history.CreatedDate);
                item.iconName = 'utility:change_record_type';
                item.iconVariant = 'success';
                
                activities.add(item);
            }
            
        } catch (Exception e) {
            System.debug(LoggingLevel.ERROR, 'Error fetching task activity: ' + e.getMessage());
        }
        
        return activities;
    }
    
    /**
     * @description Format datetime to relative time string
     * @param dt DateTime to format
     * @return Formatted string like "2 minutes ago"
     */
    private static String formatRelativeTime(DateTime dt) {
        if (dt == null) {
            return '';
        }
        
        DateTime now = DateTime.now();
        Long diffSeconds = (now.getTime() - dt.getTime()) / 1000;
        
        if (diffSeconds < 60) {
            return 'Just now';
        } else if (diffSeconds < 3600) {
            Long minutes = diffSeconds / 60;
            return minutes + (minutes == 1 ? ' minute ago' : ' minutes ago');
        } else if (diffSeconds < 86400) {
            Long hours = diffSeconds / 3600;
            return hours + (hours == 1 ? ' hour ago' : ' hours ago');
        } else if (diffSeconds < 604800) {
            Long days = diffSeconds / 86400;
            return days + (days == 1 ? ' day ago' : ' days ago');
        } else {
            // For older items, show the actual date
            return dt.format('MMM d, yyyy');
        }
    }
    
    /**
     * @description Get activity stats for dashboard
     * @param teamId Optional team filter
     * @return Map with activity statistics
     */
    @AuraEnabled(cacheable=true)
    public static Map<String, Object> getActivityStats(String teamId) {
        Map<String, Object> stats = new Map<String, Object>();
        
        try {
            String whereClause = '';
            if (String.isNotBlank(teamId)) {
                whereClause = 'WHERE TLG_Task__r.TLG_Team__c = \'' + String.escapeSingleQuotes(teamId) + '\'';
            }
            
            // Count recent activities (last 7 days)
            String query = 'SELECT COUNT() totalCount ' +
                          'FROM TLG_Task_History__c ' +
                          whereClause +
                          (String.isNotBlank(whereClause) ? ' AND ' : ' WHERE ') +
                          'CreatedDate = LAST_N_DAYS:7 ' +
                          'WITH SECURITY_ENFORCED';
            
            Integer recentCount = Database.countQuery(query);
            stats.put('recentActivityCount', recentCount);
            
            // Get most active users (last 7 days)
            String userQuery = 'SELECT CreatedById, CreatedBy.Name, COUNT(Id) activityCount ' +
                              'FROM TLG_Task_History__c ' +
                              whereClause +
                              (String.isNotBlank(whereClause) ? ' AND ' : ' WHERE ') +
                              'CreatedDate = LAST_N_DAYS:7 ' +
                              'GROUP BY CreatedById, CreatedBy.Name ' +
                              'ORDER BY COUNT(Id) DESC ' +
                              'LIMIT 5 ' +
                              'WITH SECURITY_ENFORCED';
            
            List<AggregateResult> userResults = Database.query(userQuery);
            List<Map<String, Object>> activeUsers = new List<Map<String, Object>>();
            
            for (AggregateResult ar : userResults) {
                Map<String, Object> userMap = new Map<String, Object>();
                userMap.put('userId', (String)ar.get('CreatedById'));
                userMap.put('userName', (String)ar.get('Name'));
                userMap.put('activityCount', (Integer)ar.get('activityCount'));
                activeUsers.add(userMap);
            }
            
            stats.put('activeUsers', activeUsers);
            
        } catch (Exception e) {
            System.debug(LoggingLevel.ERROR, 'Error fetching activity stats: ' + e.getMessage());
            stats.put('recentActivityCount', 0);
            stats.put('activeUsers', new List<Object>());
        }
        
        return stats;
    }
    
    /**
     * @description Get recent activity including field history (assignments, priority, etc.)
     * @param limitCount Number of items to retrieve
     * @param teamId Optional team filter
     * @return List of ActivityItem objects with all types of changes
     */
    @AuraEnabled(cacheable=true)
    public static List<ActivityItem> getEnhancedActivity(Integer limitCount, String teamId) {
        List<ActivityItem> activities = new List<ActivityItem>();
        
        if (limitCount == null || limitCount <= 0) {
            limitCount = 20;
        }
        if (limitCount > 50) {
            limitCount = 50;
        }
        
        try {
            // Get field history changes (assignments, logged time, etc.)
            String historyQuery = 'SELECT Id, TaskId, Field, OldValue, NewValue, CreatedDate, CreatedBy.Name ' +
                                 'FROM TLG_Task__History ' +
                                 'WHERE Field IN (\'TLG_Assigned_To__c\', \'TLG_Logged_Time__c\', \'TLG_Priority__c\', \'TLG_Due_Date__c\') ';
            
            if (String.isNotBlank(teamId)) {
                historyQuery += 'AND Task__r.TLG_Team__c = \'' + String.escapeSingleQuotes(teamId) + '\' ';
            }
            
            historyQuery += 'ORDER BY CreatedDate DESC LIMIT ' + limitCount;
            
            List<TLG_Task__History> fieldHistories = Database.query(historyQuery);
            
            for (TLG_Task__History hist : fieldHistories) {
                ActivityItem item = new ActivityItem();
                item.id = hist.Id;
                item.taskId = (String)hist.get('TaskId');
                item.userName = hist.CreatedBy?.Name;
                item.timestamp = hist.CreatedDate;
                item.oldValue = String.valueOf(hist.OldValue);
                item.newValue = String.valueOf(hist.NewValue);
                item.formattedTime = formatRelativeTime(hist.CreatedDate);
                
                // Determine activity type based on field
                if (hist.Field == 'TLG_Assigned_To__c') {
                    item.actionType = 'assignment_change';
                    item.iconName = 'utility:user';
                    item.iconVariant = 'success';
                } else if (hist.Field == 'TLG_Priority__c') {
                    item.actionType = 'priority_change';
                    item.iconName = 'utility:priority';
                    item.iconVariant = 'warning';
                } else if (hist.Field == 'TLG_Logged_Time__c') {
                    item.actionType = 'time_logged';
                    item.iconName = 'utility:clock';
                    item.iconVariant = 'success';
                } else if (hist.Field == 'TLG_Due_Date__c') {
                    item.actionType = 'due_date_change';
                    item.iconName = 'utility:event';
                    item.iconVariant = 'warning';
                } else {
                    item.actionType = 'updated';
                    item.iconName = 'utility:edit';
                    item.iconVariant = 'warning';
                }
                
                activities.add(item);
            }
            
            // Also get status changes from TLG_Task_History__c
            List<ActivityItem> statusActivities = getRecentActivity(limitCount, teamId);
            activities.addAll(statusActivities);
            
            // Sort by timestamp descending using manual sort
            activities = sortActivitiesByTimestamp(activities);
            
            // Trim to limit
            if (activities.size() > limitCount) {
                List<ActivityItem> trimmed = new List<ActivityItem>();
                for (Integer i = 0; i < limitCount; i++) {
                    trimmed.add(activities[i]);
                }
                activities = trimmed;
            }
            
        } catch (Exception e) {
            System.debug(LoggingLevel.ERROR, 'Error fetching enhanced activity: ' + e.getMessage());
            // Fallback to basic activity
            return getRecentActivity(limitCount, teamId);
        }
        
        return activities;
    }
    
    /**
     * @description Sort activities by timestamp descending (newest first)
     */
    private static List<ActivityItem> sortActivitiesByTimestamp(List<ActivityItem> items) {
        if (items == null || items.size() <= 1) {
            return items;
        }
        
        // Simple bubble sort for small lists (sufficient for limit of 50)
        for (Integer i = 0; i < items.size() - 1; i++) {
            for (Integer j = 0; j < items.size() - i - 1; j++) {
                DateTime time1 = items[j].timestamp;
                DateTime time2 = items[j + 1].timestamp;
                
                // Handle nulls
                if (time1 == null || (time2 != null && time1 < time2)) {
                    // Swap
                    ActivityItem temp = items[j];
                    items[j] = items[j + 1];
                    items[j + 1] = temp;
                }
            }
        }
        
        return items;
    }
}