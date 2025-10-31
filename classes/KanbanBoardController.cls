/**
 * @description Lightweight controller for Kanban Board Lightning Web Component.
 * Delegates operations to specialized service classes for better maintainability.
 * Refactored to reduce class size and improve separation of concerns.
 */
@SuppressWarnings('PMD.ExcessivePublicCount,PMD.CognitiveComplexity,PMD.CyclomaticComplexity,PMD.ExcessiveClassLength,PMD.TooManyMethods')
public with sharing class KanbanBoardController {

  // ========================================
  // INNER CLASSES
  // ========================================

  /**
   * @description Wrapper class for status color configuration
   */
  public class StatusColorConfig {
    @AuraEnabled public String statusName;
    @AuraEnabled public String colorCode;
    @AuraEnabled public String collapsedColorStart;
    @AuraEnabled public String collapsedColorEnd;
    @AuraEnabled public Integer displayOrder;
    @AuraEnabled public Integer maxExpandedColumns;
  }

  // ========================================
  // FILE MANAGEMENT OPERATIONS (delegated to FileManagementService)
  // ========================================

  /**
   * @description Relate uploaded files to one or more TLG_TASK__c records by creating ContentDocumentLink records.
   */
  @AuraEnabled
  public static Map<Id, List<Id>> relateFilesToTasks(List<Id> taskIds, List<Id> contentDocumentIds) {
    return FileManagementService.relateFilesToTasks(taskIds, contentDocumentIds);
  }

  /**
   * @description Relate uploaded files to a single TLG_TASK__c record.
   */
  @AuraEnabled
  public static List<Id> relateFilesToTask(Id taskId, List<Id> contentDocumentIds) {
    return FileManagementService.relateFilesToTask(taskId, contentDocumentIds);
  }

  /**
   * @description Upload a file and relate it to multiple tasks.
   * Accepts base64 data and forwards to service with inferred content type.
   */
  // @AuraEnabled
  // public static Map<String, String> uploadFileToTasks(String base64Data, String fileName, List<String> taskIds) {
  //   String contentType = 'application/octet-stream';
  //   return FileManagementService.uploadFileToTasks(fileName, base64Data, contentType, taskIds);
  // }

  /**
   * @description Get files for a task with metadata for UI.
   */
  @AuraEnabled(cacheable=true)
  public static List<Map<String, Object>> getTaskFiles(String taskId) {
    return FileManagementService.getTaskFilesWithMetadata(taskId);
  }

  // ========================================
  // PROJECT OPERATIONS (delegated to ProjectService)
  // ========================================

  @AuraEnabled(cacheable=true)
  public static List<Opportunity> getHighPriorityProjects() {
    return ProjectService.getHighPriorityProjects();
  }

  @AuraEnabled(cacheable=true)
  public static List<Opportunity> searchOpportunities(String searchTerm) {
    return ProjectService.searchOpportunities(searchTerm);
  }

  @AuraEnabled(cacheable=true)
  public static List<Opportunity> getProjects() {
    return ProjectService.getProjects();
  }

  @AuraEnabled(cacheable=true)
  public static List<User> getAssignableUsers() {
    return [SELECT Id, Name FROM User WHERE IsActive = TRUE ORDER BY Name LIMIT 1000];
  }

  // ========================================
  // TASK QUERY OPERATIONS (delegated to TaskQueryService)
  // ========================================

  @AuraEnabled(cacheable=true)
  public static List<Case> searchCases(String searchTerm, Id opportunityId) {
    return TaskQueryService.searchCases(searchTerm, opportunityId);
  }

  @AuraEnabled(cacheable=true)
  public static List<TLG_TASK__c> getTasks(TaskQueryService.TaskQueryParams params) {
    return TaskQueryService.getTasks(params);
  }

  /**
   * @description Get the current logged-in user's ID
   * @return The ID of the current user (works for both internal and portal users)
   */
  @AuraEnabled(cacheable=true)
  public static Id getCurrentUserId() {
    return UserInfo.getUserId();
  }

  /**
   * @description Save user's collapsed column preferences
   * @param collapsedColumns Comma-separated list of collapsed column status names
   */
  @AuraEnabled
  public static void saveUserPreferences(String collapsedColumns) {
    try {
      User currentUser = [SELECT Id, TLG_Collapsed_Columns__c FROM User WHERE Id = :UserInfo.getUserId() LIMIT 1];
      currentUser.TLG_Collapsed_Columns__c = collapsedColumns;
      update currentUser;
    } catch (Exception e) {
      throw new AuraHandledException('Error saving user preferences: ' + e.getMessage());
    }
  }

  /**
   * @description Get user's collapsed column preferences
   * @return Comma-separated list of collapsed column status names
   */
  @AuraEnabled(cacheable=true)
  public static String getUserPreferences() {
    try {
      User currentUser = [SELECT Id, TLG_Collapsed_Columns__c FROM User WHERE Id = :UserInfo.getUserId() LIMIT 1];
      return currentUser.TLG_Collapsed_Columns__c != null ? currentUser.TLG_Collapsed_Columns__c : '';
    } catch (Exception e) {
      throw new AuraHandledException('Error retrieving user preferences: ' + e.getMessage());
    }
  }

  /**
   * @description Get status color configurations from Kanban Board Config object
   * @return List of status color configurations
   */
  @AuraEnabled(cacheable=true)
  public static List<StatusColorConfig> getStatusColors() {
    List<StatusColorConfig> configs = new List<StatusColorConfig>();

    try {
      List<TLG_Kanban_Board_Config__c> colorConfigs = [
        SELECT
          TLG_Status_Name__c,
          TLG_Color_Code__c,
          TLG_Collapsed_Color_Start__c,
          TLG_Collapsed_Color_End__c,
          TLG_Display_Order__c,
          TLG_Max_Expanded_Columns__c
        FROM TLG_Kanban_Board_Config__c
        WHERE TLG_Is_Active__c = true
        ORDER BY TLG_Display_Order__c ASC NULLS LAST, TLG_Status_Name__c ASC
      ];

      for (TLG_Kanban_Board_Config__c config : colorConfigs) {
        StatusColorConfig colorConfig = new StatusColorConfig();
        colorConfig.statusName = config.TLG_Status_Name__c;
        colorConfig.colorCode = config.TLG_Color_Code__c;
        colorConfig.collapsedColorStart = config.TLG_Collapsed_Color_Start__c;
        colorConfig.collapsedColorEnd = config.TLG_Collapsed_Color_End__c;
        colorConfig.displayOrder = config.TLG_Display_Order__c != null ? config.TLG_Display_Order__c.intValue() : 0;
        colorConfig.maxExpandedColumns = config.TLG_Max_Expanded_Columns__c != null
          ? config.TLG_Max_Expanded_Columns__c.intValue()
          : null;
        configs.add(colorConfig);
      }

      return configs;
    } catch (Exception e) {
      throw new AuraHandledException('Error retrieving status colors: ' + e.getMessage());
    }
  }

  @AuraEnabled(cacheable=true)
  public static List<TLG_TASK__c> getFilteredTasks(Map<String, Object> filterCriteria) {
    return TaskQueryService.getFilteredTasks(filterCriteria);
  }

  @AuraEnabled
  public static List<TLG_TASK__c> getAllTasks() {
    return TaskQueryService.getAllTasks();
  }

  /**
   * @description Get team statuses for kanban board columns, ordered by sequence
   * @param teamId The ID of the team to get statuses for
   * @return List of team status records ordered by TLG_Order_Number__c
   */
  @AuraEnabled(cacheable=true)
  public static List<TLG_Team_Status__c> getTeamStatuses(Id teamId) {
    if (teamId == null) {
      return new List<TLG_Team_Status__c>();
    }

    return [
      SELECT Id, Name, TLG_Display_Label__c, TLG_Order_Number__c, TLG_Team__c
      FROM TLG_Team_Status__c
      WHERE TLG_Team__c = :teamId
      ORDER BY TLG_Order_Number__c ASC NULLS LAST, Name ASC
    ];
  }

  /**
   * @description Get suggested order number for new team status based on existing ones
   * @param teamId The ID of the team to get next order for
   * @return Suggested order number (highest existing + 10, or 10 if none exist)
   */
  @AuraEnabled(cacheable=true)
  public static Integer getSuggestedOrderNumber(Id teamId) {
    if (teamId == null) {
      return 10;
    }

    try {
      List<TLG_Team_Status__c> existingStatuses = [
        SELECT TLG_Order_Number__c
        FROM TLG_Team_Status__c
        WHERE TLG_Team__c = :teamId
          AND TLG_Order_Number__c != null
        ORDER BY TLG_Order_Number__c DESC
        LIMIT 1
      ];

      if (existingStatuses.isEmpty()) {
        return 10;
      }

      return existingStatuses[0].TLG_Order_Number__c.intValue() + 10;
    } catch (Exception e) {
      return 10;
    }
  }

  /**
   * @description Get the team ID from a task or set of tasks to determine which team statuses to use
   * @param taskIds List of task IDs to find team for
   * @return Team ID if found consistently across tasks, null otherwise
   */
  @AuraEnabled(cacheable=true)
  public static Id getTeamFromTasks(List<Id> taskIds) {
    if (taskIds == null || taskIds.isEmpty()) {
      return null;
    }

    List<TLG_TASK__c> tasks = [
      SELECT TLG_Team__c
      FROM TLG_TASK__c
      WHERE Id IN :taskIds
        AND TLG_Team__c != null
      LIMIT 1
    ];

    return tasks.isEmpty() ? null : tasks[0].TLG_Team__c;
  }

  // ========================================
  // TASK MANAGEMENT OPERATIONS (delegated to TaskManagementService)
  // ========================================

  @AuraEnabled
  public static TLG_TASK__c createTask(TLG_TASK__c newTask) {
    return TaskManagementService.createTask(newTask);
  }

  @AuraEnabled
  public static TLG_TASK__c createTaskFromMap(Map<String, Object> taskData) {
    return TaskManagementService.createTaskFromMap(taskData);
  }

  @AuraEnabled
  public static TLG_TASK__c updateTask(TLG_TASK__c updatedTask) {
    return TaskManagementService.updateTask(updatedTask);
  }

  @AuraEnabled
  public static TLG_TASK__c updateTaskFromMap(Id taskId, Map<String, Object> taskData) {
    return TaskManagementService.updateTaskFromMap(taskId, taskData);
  }

  @AuraEnabled
  public static TLG_TASK__c moveTask(String taskId, String newStatus) {
    return TaskManagementService.moveTask(taskId, newStatus);
  }

  @AuraEnabled
  public static TLG_TASK__c updateTaskOrder(String taskId, Integer newOrder, String columnId) {
    return TaskManagementService.updateTaskOrder(taskId, newOrder, columnId);
  }

  @AuraEnabled
  public static void updateTaskOrderFromList(List<String> taskIds) {
    TaskManagementService.updateTaskOrder(taskIds);
  }

  @AuraEnabled
  public static List<TLG_TASK__c> bulkUpdateTasks(List<String> taskIds, Map<String, Object> fieldUpdates) {
    return TaskManagementService.bulkUpdateTasks(taskIds, fieldUpdates);
  }

  // ========================================
  // ISSUE MANAGEMENT (Case)
  // ========================================

  @AuraEnabled(cacheable=true)
  public static List<Case> getIssues() {
    return [
      SELECT Id, CaseNumber, Subject, Status, Priority, CreatedDate, LastModifiedDate, Owner.Name, Account.Name, Description
      FROM Case
      WHERE IsClosed = FALSE
      ORDER BY LastModifiedDate DESC
      LIMIT 100
    ];
  }

  @AuraEnabled
  public static Case updateIssueStatus(Id issueId, String newStatus) {
    if (issueId == null) {
      throw new IllegalArgumentException('Issue ID cannot be blank.');
    }
    if (String.isBlank(newStatus)) {
      throw new IllegalArgumentException('New status cannot be blank.');
    }

    Case c = [SELECT Id, Status FROM Case WHERE Id = :issueId LIMIT 1];
    c.Status = newStatus;
    update c;
    return c;
  }

  @AuraEnabled
  public static Case createIssue(Map<String, Object> issueData) {
    if (issueData == null || issueData.isEmpty()) {
      throw new IllegalArgumentException('Issue data cannot be empty.');
    }
    Case newCase = mapIssueData(issueData);
    if (String.isBlank(newCase.Subject)) {
      throw new IllegalArgumentException('Issue subject is required.');
    }
    insert newCase;
    return newCase;
  }

  private static Case mapIssueData(Map<String, Object> issueData) {
    Case newCase = new Case();
    if (issueData.containsKey('Subject')) newCase.Subject = (String)issueData.get('Subject');
    if (issueData.containsKey('Description')) newCase.Description = (String)issueData.get('Description');
    if (issueData.containsKey('Priority')) newCase.Priority = (String)issueData.get('Priority');
    if (issueData.containsKey('Status')) newCase.Status = (String)issueData.get('Status');
    if (issueData.containsKey('AccountId')) newCase.AccountId = (Id)issueData.get('AccountId');
    return newCase;
  }

  // ========================================
  // TASK COMMENT AND TAGGING OPERATIONS
  // ========================================

  @AuraEnabled
  public static TaskCommentService.CommentDetails createTaskComment(TaskCommentService.CommentWithTags commentData) {
    return TaskCommentService.createTaskComment(commentData);
  }

  @AuraEnabled(cacheable=true)
  public static List<TaskCommentService.CommentDetails> getTaskComments(String taskId) {
    return TaskCommentService.getTaskComments(taskId);
  }

  // @AuraEnabled(cacheable=true)
  // public static List<User> searchPortalUsersForTagging(String searchTerm, Integer limitSize) {
  //   return TaskCommentService.searchPortalUsersForTagging(searchTerm, null);
  // }

  // @AuraEnabled(cacheable=true)
  // public static List<User> searchInternalUsersForTagging(String searchTerm, Integer limitSize) {
  //   return TaskCommentService.searchInternalUsersForTagging(searchTerm);
  // }

  @AuraEnabled
  public static TaskCommentService.CommentDetails updateTaskComment(String commentId, String newCommentText) {
    return TaskCommentService.updateTaskComment(commentId, newCommentText);
  }

  @AuraEnabled
  public static void deleteTaskComment(String commentId) {
    TaskCommentService.deleteTaskComment(commentId);
  }

  @AuraEnabled
  public static void deleteTask(String taskId) {
    TaskManagementService.deleteTask(taskId);
  }

  // ========================================
  // TIME LOGGING OPERATIONS (using TLG_TaskFeed__c)
  // ========================================

  /**
   * @description Get total logged time for a specific task from TLG_TaskFeed__c records with Logged Time record type
   * @param taskId The ID of the task to get logged time for
   * @return Total hours logged as Decimal
   */
  @AuraEnabled(cacheable=true)
  public static Decimal getTotalLoggedTime(Id taskId) {
    if (taskId == null) {
      return 0;
    }

    try {
      // Get all time log records and sum manually to avoid aggregate query issues
      List<TLG_TaskFeed__c> timeLogs = [
        SELECT TLG_Time_Spent__c
        FROM TLG_TaskFeed__c
        WHERE TLG_Task__c = :taskId
          AND RecordType.DeveloperName = 'TLG_Logged_Time'
          AND TLG_Time_Spent__c != null
      ];

      Decimal totalTime = 0;
      for (TLG_TaskFeed__c log : timeLogs) {
        totalTime += log.TLG_Time_Spent__c;
      }

      return totalTime;
    } catch (Exception e) {
      System.debug('Error getting total logged time: ' + e.getMessage());
      return 0;
    }
  }

  /**
   * @description Log time for a specific task using TLG_TaskFeed__c with Logged Time record type
   * @param taskId The ID of the task to log time for
   * @param timeSpent The hours spent (decimal)
   * @param description Description of work done
   * @param logDate The date when work was performed
   * @return ID of the created time log record
   */
  @AuraEnabled
  public static Id logTimeForTask(Id taskId, Decimal timeSpent, String description, Date logDate) {
    if (taskId == null || timeSpent == null || timeSpent <= 0) {
      throw new IllegalArgumentException('Task ID and valid time spent are required');
    }

    try {
      // Get the Logged Time record type
      List<RecordType> recordTypes = [
        SELECT Id
        FROM RecordType
        WHERE SObjectType = 'TLG_TaskFeed__c'
          AND DeveloperName = 'TLG_Logged_Time'
        LIMIT 1
      ];

      Id loggedTimeRecordTypeId = recordTypes.isEmpty() ? null : recordTypes[0].Id;

      TLG_TaskFeed__c timeLog = new TLG_TaskFeed__c(
        TLG_Task__c = taskId,
        TLG_Time_Spent__c = timeSpent,
        TLG_Description__c = description,
        TLG_Date_Record__c = logDate != null ? logDate : Date.today(),
        RecordTypeId = loggedTimeRecordTypeId,
        TLG_Contributor__c = UserInfo.getUserId()
      );

      insert timeLog;
      return timeLog.Id;
    } catch (Exception e) {
      System.debug('Error logging time: ' + e.getMessage());
      throw new IllegalArgumentException('Error logging time: ' + e.getMessage());
    }
  }

  /**
   * @description Get time log entries for a specific task
   * @param taskId The ID of the task to get time logs for
   * @return List of time log records with user information
   */
  @AuraEnabled(cacheable=true)
  public static List<TimeLogEntry> getTimeLogsForTask(Id taskId) {
    if (taskId == null) {
      return new List<TimeLogEntry>();
    }

    try {
      List<TLG_TaskFeed__c> timeLogs = [
        SELECT Id, TLG_Time_Spent__c, TLG_Description__c, TLG_Date_Record__c,
               TLG_Contributor__c, TLG_Contributor__r.Name, CreatedDate
        FROM TLG_TaskFeed__c
        WHERE TLG_Task__c = :taskId
          AND RecordType.DeveloperName = 'TLG_Logged_Time'
          AND TLG_Time_Spent__c != null
        ORDER BY TLG_Date_Record__c DESC, CreatedDate DESC
      ];

      List<TimeLogEntry> result = new List<TimeLogEntry>();
      for (TLG_TaskFeed__c log : timeLogs) {
        result.add(new TimeLogEntry(log));
      }

      return result;
    } catch (Exception e) {
      System.debug('Error getting time logs: ' + e.getMessage());
      return new List<TimeLogEntry>();
    }
  }

  /**
   * @description Update an existing time log entry
   * @param timeLogId ID of the time log to update
   * @param timeSpent Updated hours spent
   * @param description Updated description
   * @param logDate Updated date
   * @return Success/failure indicator
   */
  @AuraEnabled
  public static Boolean updateTimeLog(Id timeLogId, Decimal timeSpent, String description, Date logDate) {
    if (timeLogId == null) {
      throw new IllegalArgumentException('Time log ID is required');
    }

    try {
      TLG_TaskFeed__c timeLog = [
        SELECT Id, TLG_Contributor__c
        FROM TLG_TaskFeed__c
        WHERE Id = :timeLogId
          AND RecordType.DeveloperName = 'TLG_Logged_Time'
        LIMIT 1
      ];

      // Only allow the creator or admin to update
      if (timeLog.TLG_Contributor__c != UserInfo.getUserId()) {
        throw new IllegalArgumentException('You can only edit your own time logs');
      }

      if (timeSpent != null && timeSpent > 0) {
        timeLog.TLG_Time_Spent__c = timeSpent;
      }
      if (String.isNotBlank(description)) {
        timeLog.TLG_Description__c = description;
      }
      if (logDate != null) {
        timeLog.TLG_Date_Record__c = logDate;
      }

      update timeLog;
      return true;
    } catch (Exception e) {
      System.debug('Error updating time log: ' + e.getMessage());
      throw new IllegalArgumentException('Error updating time log: ' + e.getMessage());
    }
  }

  /**
   * @description Delete a time log entry
   * @param timeLogId ID of the time log to delete
   * @return Success/failure indicator
   */
  @AuraEnabled
  public static Boolean deleteTimeLog(Id timeLogId) {
    if (timeLogId == null) {
      throw new IllegalArgumentException('Time log ID is required');
    }

    try {
      TLG_TaskFeed__c timeLog = [
        SELECT Id, TLG_Contributor__c
        FROM TLG_TaskFeed__c
        WHERE Id = :timeLogId
          AND RecordType.DeveloperName = 'TLG_Logged_Time'
        LIMIT 1
      ];

      // Only allow the creator or admin to delete
      if (timeLog.TLG_Contributor__c != UserInfo.getUserId()) {
        throw new IllegalArgumentException('You can only delete your own time logs');
      }

      delete timeLog;
      return true;
    } catch (Exception e) {
      System.debug('Error deleting time log: ' + e.getMessage());
      throw new IllegalArgumentException('Error deleting time log: ' + e.getMessage());
    }
  }

  /**
   * @description Wrapper class for time log entries with formatted data
   */
  public class TimeLogEntry {
    @AuraEnabled public Id id;
    @AuraEnabled public Decimal timeSpent;
    @AuraEnabled public String description;
    @AuraEnabled public Date logDate;
    @AuraEnabled public Id contributorId;
    @AuraEnabled public String contributorName;
    @AuraEnabled public DateTime createdDate;
    @AuraEnabled public String formattedTime;

    public TimeLogEntry(TLG_TaskFeed__c log) {
      this.id = log.Id;
      this.timeSpent = log.TLG_Time_Spent__c;
      this.description = log.TLG_Description__c;
      this.logDate = log.TLG_Date_Record__c;
      this.contributorId = log.TLG_Contributor__c;
      this.contributorName = log.TLG_Contributor__r?.Name;
      this.createdDate = log.CreatedDate;
      this.formattedTime = formatTime(log.TLG_Time_Spent__c);
    }

    private String formatTime(Decimal hours) {
      if (hours == null) return '0h';
      if (hours == hours.intValue()) {
        return hours.intValue() + 'h';
      }
      return String.valueOf(hours) + 'h';
    }
  }
}