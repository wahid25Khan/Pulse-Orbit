/**
 * @description Lightweight controller for Kanban Board Lightning Web Component.
 * Delegates operations to specialized service classes for better maintainability.
 * Refactored to reduce class size and improve separation of concerns.
 */
@SuppressWarnings('PMD.ExcessivePublicCount,PMD.CognitiveComplexity,PMD.CyclomaticComplexity,PMD.ExcessiveClassLength,PMD.TooManyMethods')
public with sharing class KanbanBoardController {

  // Lightweight DTO for user options to avoid returning List<User> to AuraEnabled directly
  public class UserOption {
    @AuraEnabled public Id id;
    @AuraEnabled public String name;
    public UserOption(User u) { this.id = u.Id; this.name = u.Name; }
  }

  // Lightweight context for current user details used by LWCs
  public class CurrentUserContext {
    @AuraEnabled public Id userId;
    @AuraEnabled public Boolean isPortalUser;
    @AuraEnabled public String userType;
  }

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

  // No local error helper; use shared AuraErrorUtil.throwAuraOrIllegal for consistency

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

  // Return AuraEnabled DTOs for user options (compatible with LWC and language server)
  @AuraEnabled(cacheable=true)
  public static List<UserOption> getAssignableUsers() {
    List<UserOption> result = new List<UserOption>();
    for (User u : [SELECT Id, Name FROM User WHERE IsActive = TRUE ORDER BY Name LIMIT 1000]) {
      result.add(new UserOption(u));
    }
    return result;
  }

  // ========================================
  // TASK QUERY OPERATIONS (delegated to TaskQueryService)
  // ========================================

  @AuraEnabled(cacheable=true)
  public static List<Case> searchCases(String searchTerm, Id opportunityId) {
    return TaskQueryService.searchCases(searchTerm, opportunityId);
  }

  // Accept a Map from LWC instead of a custom Apex class to satisfy AuraEnabled constraints
  @AuraEnabled(cacheable=true)
  public static List<TLG_Task__c> getTasks(Map<String, Object> params) {
    return TaskQueryService.getFilteredTasks(params);
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
   * @description Provide current user metadata required by the Kanban board (portal vs internal).
   * @return CurrentUserContext containing user id, portal flag, and user type string.
   */
  @AuraEnabled(cacheable=true)
  public static CurrentUserContext getCurrentUserContext() {
    CurrentUserContext ctx = new CurrentUserContext();
    ctx.userId = UserInfo.getUserId();
    ctx.userType = UserInfo.getUserType();

    try {
      List<User> matches = [
        SELECT UserType
        FROM User
        WHERE Id = :ctx.userId
        LIMIT 1
      ];
      if (!matches.isEmpty()) {
        User current = matches[0];
        String rawType = String.valueOf(current.UserType);
        if (String.isBlank(ctx.userType)) {
          ctx.userType = rawType;
        }
        String evaluationType = String.isNotBlank(rawType) ? rawType.toLowerCase() : '';
        ctx.isPortalUser = evaluationType.contains('portal')
          || evaluationType.contains('community')
          || evaluationType.contains('network')
          || evaluationType.contains('customer')
          || evaluationType.contains('partner')
          || evaluationType.contains('guest');
      }
    } catch (Exception ignore) {
      // Fall back to userType heuristic if the user query fails
      ctx.isPortalUser = ctx.userType != null && ctx.userType.toLowerCase().contains('portal');
    }
    return ctx;
  }

  /**
   * @description Save user's collapsed column preferences
   * @param collapsedColumns Comma-separated list of collapsed column status names
   */
  @AuraEnabled
  public static void saveUserPreferences(String collapsedColumns) {
    try {
      List<User> users = [SELECT Id, TLG_Collapsed_Columns__c FROM User WHERE Id = :UserInfo.getUserId() LIMIT 1];
      if (!users.isEmpty()) {
        User currentUser = users[0];
        // Use dynamic put to avoid local language server false-positives
        currentUser.put('TLG_Collapsed_Columns__c', collapsedColumns);
        update currentUser;
      }
    } catch (Exception e) {
      AuraErrorUtil.throwAuraOrIllegal('Error saving user preferences: ' + e.getMessage());
    }
  }

  /**
   * @description Get user's collapsed column preferences
   * @return Comma-separated list of collapsed column status names
   */
  @AuraEnabled(cacheable=true)
  public static String getUserPreferences() {
    try {
      List<User> users = [SELECT Id, TLG_Collapsed_Columns__c FROM User WHERE Id = :UserInfo.getUserId() LIMIT 1];
      if (!users.isEmpty()) {
        User currentUser = users[0];
        String collapsed = (String)currentUser.get('TLG_Collapsed_Columns__c');
        return collapsed != null ? collapsed : '';
      }
      return '';
    } catch (Exception e) {
      AuraErrorUtil.throwAuraOrIllegal('Error retrieving user preferences: ' + e.getMessage());
      return null; // Unreachable, added for static analysis
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
      AuraErrorUtil.throwAuraOrIllegal('Error retrieving status colors: ' + e.getMessage());
      return null; // Unreachable, added for static analysis
    }
  }

  @AuraEnabled(cacheable=true)
  public static List<TLG_Task__c> getFilteredTasks(Map<String, Object> filterCriteria) {
    return TaskQueryService.getFilteredTasks(filterCriteria);
  }

  @AuraEnabled
  public static List<TLG_Task__c> getAllTasks() {
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

    List<TLG_Task__c> tasks = [
      SELECT TLG_Team__c
      FROM TLG_Task__c
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
  public static TLG_Task__c createTask(TLG_Task__c newTask) {
    return TaskManagementService.createTask(newTask);
  }

  @AuraEnabled
  public static TLG_Task__c createTaskFromMap(Map<String, Object> taskData) {
    return TaskManagementService.createTaskFromMap(taskData);
  }

  @AuraEnabled
  public static TLG_Task__c updateTask(TLG_Task__c updatedTask) {
    return TaskManagementService.updateTask(updatedTask);
  }

  @AuraEnabled
  public static TLG_Task__c updateTaskFromMap(Id taskId, Map<String, Object> taskData) {
    return TaskManagementService.updateTaskFromMap(taskId, taskData);
  }

  @AuraEnabled
  public static TLG_Task__c moveTask(String taskId, String newStatus) {
    return TaskManagementService.moveTask(taskId, newStatus);
  }

  @AuraEnabled
  public static TLG_Task__c updateTaskOrder(String taskId, Integer newOrder, String columnId) {
    return TaskManagementService.updateTaskOrder(taskId, newOrder, columnId);
  }

  @AuraEnabled
  public static void updateTaskOrderFromList(List<String> taskIds) {
    TaskManagementService.updateTaskOrder(taskIds);
  }

  @AuraEnabled
  public static List<TLG_Task__c> bulkUpdateTasks(List<String> taskIds, Map<String, Object> fieldUpdates) {
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
  public static Case updateIssueStatus(String issueId, String newStatus) {
    // Accept String to avoid platform casting error on blank Ids
    if (String.isBlank(issueId)) {
  AuraErrorUtil.throwAuraOrIllegal('Issue ID cannot be blank');
    }
    if (String.isBlank(newStatus)) {
  AuraErrorUtil.throwAuraOrIllegal('New status cannot be blank');
    }
    Case c;
    try {
      c = [SELECT Id, Status FROM Case WHERE Id = :((Id)issueId) LIMIT 1];
    } catch (Exception e) {
  AuraErrorUtil.throwAuraOrIllegal('Issue ID is invalid');
    }
    c.Status = newStatus;
    update c;
    return c;
  }

  @AuraEnabled
  public static Case createIssue(Map<String, Object> issueData) {
    if (issueData == null || issueData.isEmpty()) {
  AuraErrorUtil.throwAuraOrIllegal('Issue data cannot be empty');
    }
    Case newCase = mapIssueData(issueData);
    if (String.isBlank(newCase.Subject)) {
  AuraErrorUtil.throwAuraOrIllegal('Issue subject is required');
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

  /**
   * @description Create a new task comment with optional @mentions (Map-based for LWC compatibility)
   */
  @AuraEnabled
  public static Map<String, Object> createTaskCommentFromMap(Map<String, Object> commentData) {
    if (commentData == null) {
      AuraErrorUtil.throwAuraOrIllegal('Comment data is required');
    }

    TaskCommentService.CommentWithTags dto = new TaskCommentService.CommentWithTags();
    if (commentData.containsKey('text')) dto.text = (String)commentData.get('text');
    if (commentData.containsKey('taskId')) dto.taskId = (Id)commentData.get('taskId');

    // Mentions: expect a List<Map<String, Object>> with at least userId and name
    if (commentData.containsKey('mentions')) {
      List<Object> raw = (List<Object>)commentData.get('mentions');
      List<TaskCommentService.UserMention> mentions = new List<TaskCommentService.UserMention>();
      if (raw != null) {
        for (Object o : raw) {
          Map<String, Object> m = (Map<String, Object>)o;
          TaskCommentService.UserMention um = new TaskCommentService.UserMention();
          if (m.containsKey('userId')) um.userId = (Id)m.get('userId');
          if (m.containsKey('username')) um.username = (String)m.get('username');
          if (m.containsKey('name')) um.name = (String)m.get('name');
          if (m.containsKey('startIndex')) um.startIndex = (Integer)m.get('startIndex');
          if (m.containsKey('endIndex')) um.endIndex = (Integer)m.get('endIndex');
          mentions.add(um);
        }
      }
      dto.mentions = mentions;
    }

    TaskCommentService.CommentDetails created = TaskCommentService.createTaskComment(dto);
    return mapFromComment(created);
  }

  /**
   * @description Get comments for a task (newest-first). Returns List<Map<...>> for LWC.
   */
  @AuraEnabled(cacheable=true)
  public static List<Map<String, Object>> getTaskCommentsAsMaps(Id taskId) {
    List<TaskCommentService.CommentDetails> items = TaskCommentService.getTaskComments(taskId);
    List<Map<String, Object>> out = new List<Map<String, Object>>();
    for (TaskCommentService.CommentDetails d : items) {
      out.add(mapFromComment(d));
    }
    return out;
  }

  private static Map<String, Object> mapFromComment(TaskCommentService.CommentDetails d) {
    Map<String, Object> m = new Map<String, Object>();
    if (d == null) return m;
    m.put('id', d.id);
    m.put('text', d.text);
    m.put('taskId', d.taskId);
    m.put('createdById', d.createdById);
    m.put('createdByName', d.createdByName);
    m.put('createdByPhotoUrl', d.createdByPhotoUrl);
    m.put('createdDate', d.createdDate);
    // Mentions simplified to array of maps with userId/name/username
    List<Map<String, Object>> mentionsOut = new List<Map<String, Object>>();
    if (d.mentions != null) {
      for (TaskCommentService.UserMention um : d.mentions) {
        Map<String, Object> mm = new Map<String, Object>();
        mm.put('userId', um.userId);
        mm.put('username', um.username);
        mm.put('name', um.name);
        mm.put('startIndex', um.startIndex);
        mm.put('endIndex', um.endIndex);
        mentionsOut.add(mm);
      }
    }
    m.put('mentions', mentionsOut);
    return m;
  }

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
   * @description DTO for time log aggregates
   */
  public class TimeLogAggregates {
    @AuraEnabled public Integer totalMinutes;
    @AuraEnabled public Integer totalCompletion;
    @AuraEnabled public Integer entryCount;
    public TimeLogAggregates(Integer m, Integer c, Integer n){ totalMinutes=m; totalCompletion=c; entryCount=n; }
  }

  /**
   * @description Convert base-60 decimal hours to total minutes (normalizes values like 1.75 => 1h 75m => 2h 15m)
   */
  private static Integer hoursDecimalToMinutes(Decimal hoursDec) {
    if (hoursDec == null) return 0;
    Decimal abs = hoursDec.abs();
    Integer sign = hoursDec < 0 ? -1 : 1;
    Integer hours = abs.intValue();
    // Extract two-decimal minute component safely (avoid Decimal.valueOf(Integer) and Math.round(Long))
    Decimal intPart = Decimal.valueOf(String.valueOf(hours));
    Decimal fractional = abs - intPart;
    Integer minutes = ((fractional * 100).setScale(0)).intValue();
    // Normalize overflow minutes
    hours += (minutes / 60);
    minutes = Math.mod(minutes, 60);
    Integer total = (hours * 60) + minutes;
    return sign * total;
  }

  /**
   * @description Convert total minutes to base-60 decimal hours (e.g., 75 => 1.15)
   */
  private static Decimal minutesToHoursDecimal(Integer totalMinutes) {
    if (totalMinutes == null) return 0;
    Integer sign = totalMinutes < 0 ? -1 : 1;
    Integer mins = Math.abs(totalMinutes);
    Integer hours = mins / 60;
    Integer minutes = Math.mod(mins, 60);
    String minsStr = (minutes < 10) ? ('0' + String.valueOf(minutes)) : String.valueOf(minutes);
    // Build a base-60 decimal string like "H.MM" and convert to Decimal
    Decimal result = Decimal.valueOf(String.valueOf(hours) + '.' + minsStr);
    if (sign == -1) {
      result = result * -1;
    }
    return result;
  }

  /**
   * @description Get aggregates of time logs for a task: total minutes (base-60) and cumulative Completion__c
   */
  @AuraEnabled(cacheable=true)
  public static TimeLogAggregates getTimeLogAggregates(Id taskId) {
    if (taskId == null) return new TimeLogAggregates(0, 0, 0);

    List<TLG_TaskFeed__c> logs = [
      SELECT TLG_Time_Spent__c, Completion__c
      FROM TLG_TaskFeed__c
      WHERE TLG_Task__c = :taskId
        AND RecordType.DeveloperName = 'TLG_Logged_Time'
    ];
    Integer totalMins = 0;
    Integer totalPct = 0;
    for (TLG_TaskFeed__c l : logs) {
      totalMins += hoursDecimalToMinutes(l.TLG_Time_Spent__c);
      // Completion__c is a picklist like '25%'; parse integer portion if present
      String pctVal = (String)l.get('Completion__c');
      if (!String.isBlank(pctVal)) {
        String digits = pctVal.replace('%', '');
        if (Pattern.matches('^\\d+$', digits)) {
          totalPct += Integer.valueOf(digits);
        }
      }
    }
    return new TimeLogAggregates(totalMins, totalPct, logs.size());
  }

  /**
   * @description Return picklist metadata and dependency map for Delay modal (Origin and Category)
   */
  // getDelayPicklistMetadata removed - UI will use lightning/uiObjectInfoApi in LWC for dependency mapping.

  /**
   * @description Create a Logged Time entry with optional Task Delay fields (persisted on TLG_TaskFeed__c when available)
   * Accepts map-based inputs for LWC compatibility.
   */
  @AuraEnabled
  public static Id createLoggedTimeWithOptionalDelay(Map<String, Object> logData, Map<String, Object> delayData) {
    if (logData == null) {
      AuraErrorUtil.throwAuraOrIllegal('Log data is required');
    }
    Id taskId = (Id)logData.get('TLG_Task__c');
    if (taskId == null) {
      AuraErrorUtil.throwAuraOrIllegal('Task ID is required');
    }

    // Resolve RecordType Id for Logged Time
    Id rtId = null;
    try {
      rtId = [SELECT Id FROM RecordType WHERE SObjectType = 'TLG_TaskFeed__c' AND DeveloperName = 'TLG_Logged_Time' LIMIT 1].Id;
    } catch (Exception e) {
      // optional
    }

  // Query task (dynamic get for fields to avoid local lint issues)
  SObject t = [SELECT Id, TLG_Assigned_To__c, Total_Estimated_Time__c FROM TLG_Task__c WHERE Id = :taskId LIMIT 1];

    // Build record
    TLG_TaskFeed__c rec = new TLG_TaskFeed__c();
    rec.RecordTypeId = rtId;
    rec.TLG_Task__c = taskId;
    if (logData.containsKey('TLG_Time_Spent__c')) rec.TLG_Time_Spent__c = (Decimal)logData.get('TLG_Time_Spent__c');
    if (logData.containsKey('TLG_Description__c')) rec.TLG_Description__c = (String)logData.get('TLG_Description__c');
    rec.TLG_Date_Record__c = (Date)(logData.containsKey('TLG_Date_Record__c') ? logData.get('TLG_Date_Record__c') : Date.today());
    // Completion__c is a picklist like '25%'; accept numbers or strings and normalize to suffixed string
    if (logData.containsKey('Completion__c') && logData.get('Completion__c') != null) {
      String compStr = String.valueOf(logData.get('Completion__c'));
      if (!compStr.endsWith('%')) compStr += '%';
      rec.put('Completion__c', compStr);
    }

    // Set TLG_Is_Owner__c when available using dynamic put
    Object assignedTo = t.get('TLG_Assigned_To__c');
    if (assignedTo != null) {
      rec.put('TLG_Is_Owner__c', ((Id)assignedTo) == UserInfo.getUserId());
    }

    // Apply delay fields if provided and present on object
    if (delayData != null && !delayData.isEmpty()) {
      for (String key : delayData.keySet()) {
        // Trust keys from UI; fields exist per metadata; dynamic put avoids local lint false-positives
        rec.put(key, delayData.get(key));
      }
    }

    insert rec;
    return rec.Id;
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
      AuraErrorUtil.throwAuraOrIllegal('Task ID and valid time spent are required');
      return null; // Unreachable, added for static analysis
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
        RecordTypeId = loggedTimeRecordTypeId
      );

      insert timeLog;
      return timeLog.Id;
    } catch (Exception e) {
      System.debug('Error logging time: ' + e.getMessage());
      AuraErrorUtil.throwAuraOrIllegal('Error logging time: ' + e.getMessage());
      return null; // Unreachable, added for static analysis
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
      AuraErrorUtil.throwAuraOrIllegal('Time log ID is required');
      return null; // Unreachable, added for static analysis
    }

    try {
      TLG_TaskFeed__c timeLog = [
        SELECT Id, CreatedById
        FROM TLG_TaskFeed__c
        WHERE Id = :timeLogId
          AND RecordType.DeveloperName = 'TLG_Logged_Time'
        LIMIT 1
      ];
      // Only allow the creator to update (Contributor is Portal User lookup)
      Boolean canEdit = (timeLog.CreatedById == UserInfo.getUserId());
      if (!canEdit) {
        AuraErrorUtil.throwAuraOrIllegal('You can only edit your own time logs');
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
      AuraErrorUtil.throwAuraOrIllegal('Error updating time log: ' + e.getMessage());
      return null; // Unreachable, added for static analysis
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
      AuraErrorUtil.throwAuraOrIllegal('Time log ID is required');
      return null; // Unreachable, added for static analysis
    }

    try {
      TLG_TaskFeed__c timeLog = [
        SELECT Id, CreatedById
        FROM TLG_TaskFeed__c
        WHERE Id = :timeLogId
          AND RecordType.DeveloperName = 'TLG_Logged_Time'
        LIMIT 1
      ];
      // Only allow the creator to delete (Contributor is Portal User lookup)
      Boolean canDelete = (timeLog.CreatedById == UserInfo.getUserId());
      if (!canDelete) {
        AuraErrorUtil.throwAuraOrIllegal('You can only delete your own time logs');
      }

      delete timeLog;
      return true;
    } catch (Exception e) {
      System.debug('Error deleting time log: ' + e.getMessage());
      AuraErrorUtil.throwAuraOrIllegal('Error deleting time log: ' + e.getMessage());
      return null; // Unreachable, added for static analysis
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
      this.contributorName = (log.TLG_Contributor__r != null ? log.TLG_Contributor__r.Name : null);
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