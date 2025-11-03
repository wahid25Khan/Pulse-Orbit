/**
 * @description Service class for handling task CRUD operations and management.
 * Extracted from KanbanBoardController for better maintainability and separation of concerns.
 */
public with sharing class TaskManagementService {
  /**
   * @description Create a new TLG_Task__c with FLS/CRUD and error handling.
   * @param newTask The TLG_Task__c record to create.
   * @return The created TLG_Task__c record.
   * @throws IllegalArgumentException if validation fails, user lacks permissions, or an error occurs during creation.
   */
  public static TLG_Task__c createTask(TLG_Task__c newTask) {
    validateTaskFields(newTask, false);
    try {
      checkTaskCrud('create');
      System.SObjectAccessDecision decision = Security.stripInaccessible(
        System.AccessType.CREATABLE,
        new List<TLG_Task__c>{ newTask }
      );
      List<TLG_Task__c> tasksToInsert = (List<TLG_Task__c>) decision.getRecords();
      insert tasksToInsert;
      return tasksToInsert[0];
    } catch (Exception e) {
      AuraErrorUtil.throwAuraOrIllegal('Failed to create task: ' + e.getMessage());
      return null; // Unreachable, added for static analysis
    }
  }

  /**
   * @description Update a TLG_Task__c with FLS/CRUD and error handling.
   * @param updatedTask The TLG_Task__c record to update.
   * @return The updated TLG_Task__c record.
   * @throws IllegalArgumentException if validation fails, user lacks permissions, or an error occurs during update.
   */
  public static TLG_Task__c updateTask(TLG_Task__c updatedTask) {
    validateTaskFields(updatedTask, true);
    try {
      checkTaskCrud('update');
      System.SObjectAccessDecision decision = Security.stripInaccessible(
        System.AccessType.UPDATABLE,
        new List<TLG_Task__c>{ updatedTask }
      );
      List<TLG_Task__c> tasksToUpdate = (List<TLG_Task__c>) decision.getRecords();
      update tasksToUpdate;
      return tasksToUpdate[0];
    } catch (Exception e) {
      AuraErrorUtil.throwAuraOrIllegal('Failed to update task: ' + e.getMessage());
      return null; // Unreachable, added for static analysis
    }
  }

  /**
   * @description Moves a task to a new status.
   * @param taskId The Id of the TLG_Task__c to move.
   * @param newStatus The new status for the task.
   * @return The updated TLG_Task__c record.
   * @throws IllegalArgumentException if taskId or newStatus is blank, or if the task is not found.
   */
  public static TLG_Task__c moveTask(String taskId, String newStatus) {
    if (String.isBlank(taskId)) {
      AuraErrorUtil.throwAuraOrIllegal('Task ID cannot be null or empty.');
      return null; // Unreachable, added for static analysis
    }
    if (String.isBlank(newStatus)) {
      AuraErrorUtil.throwAuraOrIllegal('New status cannot be null or empty.');
      return null; // Unreachable, added for static analysis
    }

    List<TLG_Task__c> tasks = [
      SELECT Id, TLG_Status__c
      FROM TLG_Task__c
      WHERE Id = :taskId
      WITH SECURITY_ENFORCED
      LIMIT 1
    ];
    if (tasks.isEmpty()) {
      AuraErrorUtil.throwAuraOrIllegal('Task not found with Id: ' + taskId);
      return null; // Unreachable, added for static analysis
    }
  TLG_Task__c task = tasks[0];

    // Avoid DML if status is not actually changing
    if (task.TLG_Status__c == newStatus) {
      return task;
    }

    task.TLG_Status__c = newStatus;
    update task;
    return task;
  }

  /**
   * @description Delete a TLG_TASK__c with FLS/CRUD and error handling.
   * @param taskId The Id of the TLG_TASK__c to delete.
   * @throws IllegalArgumentException if user lacks permissions or an error occurs during deletion.
   */
  public static void deleteTask(String taskId) {
    try {
      checkTaskDeleteCrud();
      findAndDeleteTask(taskId);
    } catch (Exception e) {
      AuraErrorUtil.throwAuraOrIllegal('Failed to delete task: ' + e.getMessage());
    }
  } /**
   * @description Update task order within a column for reordering functionality.
   * Currently implements basic ordering using LastModifiedDate as a workaround.
   * For full ordering support, add a custom Order__c field to TLG_TASK__c.
   * @param taskId The Id of the task to reorder.
   * @param newOrder The new order position.
   * @param columnId The column/status the task belongs to.
   * @return The updated TLG_TASK__c record.
   * @throws IllegalArgumentException if validation fails or update error occurs.
   */
  public static TLG_Task__c updateTaskOrder(
    String taskId,
    Integer newOrder,
    String columnId
  ) {
    if (String.isBlank(taskId)) {
      AuraErrorUtil.throwAuraOrIllegal('Task ID is required for reordering.');
      return null; // Unreachable, added for static analysis
    }
    if (newOrder == null || newOrder < 0) {
      AuraErrorUtil.throwAuraOrIllegal('Valid order position is required.');
      return null; // Unreachable, added for static analysis
    }

    try {
      checkTaskCrud('update');

      List<TLG_Task__c> tasks = [
        SELECT Id, TLG_Status__c, TLG_Kanban_Sort_Order__c
        FROM TLG_Task__c
        WHERE Id = :taskId
        WITH SECURITY_ENFORCED
        LIMIT 1
      ];

      if (tasks.isEmpty()) {
        AuraErrorUtil.throwAuraOrIllegal('Task not found with Id: ' + taskId);
        return null; // Unreachable, added for static analysis
      }

  TLG_Task__c task = tasks[0];

      // If columnId is provided, ensure task is in the correct status
      if (String.isNotBlank(columnId)) {
        // columnId represents the status picklist value directly
        task.TLG_Status__c = columnId;
      }

      // Persist new order to dedicated field
      task.TLG_Kanban_Sort_Order__c = newOrder;

      update task;

      // Refresh the task to get updated values
      task = [
        SELECT Id, Name, TLG_Status__c, TLG_Kanban_Sort_Order__c
        FROM TLG_Task__c
        WHERE Id = :taskId
        WITH SECURITY_ENFORCED
        LIMIT 1
      ];

      return task;
    } catch (Exception e) {
      AuraErrorUtil.throwAuraOrIllegal('Failed to update task order: ' + e.getMessage());
      return null; // Unreachable, added for static analysis
    }
  }

  /**
   * @description Bulk update tasks with new field values.
   * @param taskIds List of task Ids to update.
   * @param fieldUpdates Map of field names to new values.
   * @return List of updated TLG_TASK__c records.
   * @throws IllegalArgumentException if validation fails or update error occurs.
   */
  public static List<TLG_Task__c> bulkUpdateTasks(
    List<String> taskIds,
    Map<String, Object> fieldUpdates
  ) {
    if (taskIds == null || taskIds.isEmpty()) {
      AuraErrorUtil.throwAuraOrIllegal('Task IDs are required for bulk update.');
      return null; // Unreachable, added for static analysis
    }
    if (fieldUpdates == null || fieldUpdates.isEmpty()) {
      AuraErrorUtil.throwAuraOrIllegal('Field updates are required for bulk update.');
      return null; // Unreachable, added for static analysis
    }

    try {
      checkTaskCrud('update');

      // Query only Ids to avoid FLS errors on unrelated fields during WITH SECURITY_ENFORCED
      List<TLG_Task__c> existing = [
        SELECT Id
        FROM TLG_Task__c
        WHERE Id IN :taskIds
        WITH SECURITY_ENFORCED
      ];

      // Build update records with only the fields being changed
      List<TLG_Task__c> tasks = new List<TLG_Task__c>();
      for (TLG_Task__c e : existing) {
        TLG_Task__c task = new TLG_Task__c(Id = e.Id);
        for (String fieldName : fieldUpdates.keySet()) {
          Object fieldValue = fieldUpdates.get(fieldName);

          // Safely set field values based on field name
          switch on fieldName {
            when 'TLG_Status__c' {
              task.TLG_Status__c = (String) fieldValue;
            }
            when 'TLG_Priority__c' {
              task.TLG_Priority__c = (String) fieldValue;
            }
            when 'TLG_Assigned_To__c' {
              // Use dynamic assignment to avoid compile-time dependency on optional field
              try {
                task.put('TLG_Assigned_To__c', (Id) fieldValue);
              } catch (Exception ex) {
                // Ignore if field does not exist in this org
              }
            }
            when 'TLG_Due_Date__c' {
              task.TLG_Due_Date__c = (Date) fieldValue;
            }
            when 'TLG_Team__c' {
              task.TLG_Team__c = (Id) fieldValue;
            }
            when 'TLG_Opportunity__c' {
              task.TLG_Opportunity__c = (Id) fieldValue;
            }
            when else {
              // Skip unknown fields for security
            }
          }
        }
        tasks.add(task);
      }

      System.SObjectAccessDecision decision = Security.stripInaccessible(
        System.AccessType.UPDATABLE,
        tasks
      );
      List<TLG_Task__c> tasksToUpdate = (List<TLG_Task__c>) decision.getRecords();
      update tasksToUpdate;

      return tasksToUpdate;
    } catch (Exception e) {
      AuraErrorUtil.throwAuraOrIllegal('Failed to bulk update tasks: ' + e.getMessage());
      return null; // Unreachable, added for static analysis
    }
  }

  /**
   * @description Create a task from Map data.
   * @param taskData Map containing task field values.
  * @return The created TLG_Task__c record.
   * @throws IllegalArgumentException if creation fails.
   */
  public static TLG_Task__c createTaskFromMap(Map<String, Object> taskData) {
    if (taskData == null || taskData.isEmpty()) {
      AuraErrorUtil.throwAuraOrIllegal('Task data is required.');
      return null; // Unreachable, added for static analysis
    }

    try {
  TLG_Task__c newTask = new TLG_Task__c();

      // Map common fields
      if (taskData.containsKey('Name')) {
        newTask.Name = (String) taskData.get('Name');
      }
      if (taskData.containsKey('TLG_Status__c')) {
        newTask.TLG_Status__c = (String) taskData.get('TLG_Status__c');
      }
      if (taskData.containsKey('TLG_Priority__c')) {
        newTask.TLG_Priority__c = (String) taskData.get('TLG_Priority__c');
      }
      if (taskData.containsKey('TLG_Due_Date__c')) {
        newTask.TLG_Due_Date__c = (Date) taskData.get('TLG_Due_Date__c');
      }
      if (taskData.containsKey('TLG_Shared_Notes__c')) {
        newTask.TLG_Shared_Notes__c = (String) taskData.get(
          'TLG_Shared_Notes__c'
        );
      }
      if (taskData.containsKey('TLG_Team__c')) {
        newTask.TLG_Team__c = (String) taskData.get('TLG_Team__c');
      }
      if (taskData.containsKey('TLG_Opportunity__c')) {
        newTask.TLG_Opportunity__c = (Id) taskData.get('TLG_Opportunity__c');
      }
      if (taskData.containsKey('TLG_Case__c')) {
        newTask.TLG_Case__c = (Id) taskData.get('TLG_Case__c');
      }
      if (taskData.containsKey('Total_Estimated_Time__c')) {
        newTask.Total_Estimated_Time__c = (Decimal) taskData.get('Total_Estimated_Time__c');
      }
      if (taskData.containsKey('Progress__c')) {
        newTask.Progress__c = (Decimal) taskData.get('Progress__c');
      }
      if (taskData.containsKey('TLG_Category__c')) {
        newTask.TLG_Category__c = (String) taskData.get('TLG_Category__c');
      }
      if (taskData.containsKey('Parent__c')) {
        newTask.Parent__c = (String) taskData.get('Parent__c');
      }
      if (taskData.containsKey('TLG_Assigned_To__c')) {
        try {
          newTask.put('TLG_Assigned_To__c', (Id) taskData.get('TLG_Assigned_To__c'));
        } catch (Exception ignore) {}
      }

  return createTask(newTask);
    } catch (Exception e) {
      AuraErrorUtil.throwAuraOrIllegal('Failed to create task from map: ' + e.getMessage());
      return null; // Unreachable, added for static analysis
    }
  }

  /**
   * @description Update a task from Map data.
   * @param taskId The Id of the task to update.
   * @param taskData Map containing updated field values.
  * @return The updated TLG_Task__c record.
   * @throws IllegalArgumentException if update fails.
   */
  public static TLG_Task__c updateTaskFromMap(
    Id taskId,
    Map<String, Object> taskData
  ) {
    if (taskId == null) {
      AuraErrorUtil.throwAuraOrIllegal('Task ID is required.');
      return null; // Unreachable, added for static analysis
    }
    if (taskData == null || taskData.isEmpty()) {
      AuraErrorUtil.throwAuraOrIllegal('Task data is required.');
      return null; // Unreachable, added for static analysis
    }

    try {
  TLG_Task__c taskToUpdate = new TLG_Task__c(Id = taskId);

      // Map common fields
      if (taskData.containsKey('Name')) {
        taskToUpdate.Name = (String) taskData.get('Name');
      }
      if (taskData.containsKey('TLG_Status__c')) {
        taskToUpdate.TLG_Status__c = (String) taskData.get('TLG_Status__c');
      }
      if (taskData.containsKey('TLG_Priority__c')) {
        taskToUpdate.TLG_Priority__c = (String) taskData.get('TLG_Priority__c');
      }
      if (taskData.containsKey('TLG_Due_Date__c')) {
        taskToUpdate.TLG_Due_Date__c = (Date) taskData.get('TLG_Due_Date__c');
      }
      if (taskData.containsKey('TLG_Shared_Notes__c')) {
        taskToUpdate.TLG_Shared_Notes__c = (String) taskData.get(
          'TLG_Shared_Notes__c'
        );
      }
      if (taskData.containsKey('TLG_Team__c')) {
        taskToUpdate.TLG_Team__c = (String) taskData.get('TLG_Team__c');
      }
      if (taskData.containsKey('TLG_Opportunity__c')) {
        taskToUpdate.TLG_Opportunity__c = (Id) taskData.get('TLG_Opportunity__c');
      }
      if (taskData.containsKey('TLG_Case__c')) {
        taskToUpdate.TLG_Case__c = (Id) taskData.get('TLG_Case__c');
      }
      if (taskData.containsKey('Total_Estimated_Time__c')) {
        taskToUpdate.Total_Estimated_Time__c = (Decimal) taskData.get('Total_Estimated_Time__c');
      }
      if (taskData.containsKey('Progress__c')) {
        taskToUpdate.Progress__c = (Decimal) taskData.get('Progress__c');
      }
      if (taskData.containsKey('TLG_Category__c')) {
        taskToUpdate.TLG_Category__c = (String) taskData.get('TLG_Category__c');
      }
      if (taskData.containsKey('Parent__c')) {
        taskToUpdate.Parent__c = (String) taskData.get('Parent__c');
      }
      if (taskData.containsKey('TLG_Assigned_To__c')) {
        try {
          taskToUpdate.put('TLG_Assigned_To__c', (Id) taskData.get('TLG_Assigned_To__c'));
        } catch (Exception ignore) {}
      }

      return updateTask(taskToUpdate);
    } catch (Exception e) {
      AuraErrorUtil.throwAuraOrIllegal('Failed to update task from map: ' + e.getMessage());
      return null; // Unreachable, added for static analysis
    }
  }

  /**
   * @description Update task order from list of task IDs.
   * @param taskIds List of task IDs in new order.
   * @throws IllegalArgumentException if update fails.
   */
  public static void updateTaskOrder(List<String> taskIds) {
    if (taskIds == null || taskIds.isEmpty()) {
      AuraErrorUtil.throwAuraOrIllegal('Task IDs are required.');
    }

    try {
      List<TLG_TASK__c> tasksToUpdate = new List<TLG_TASK__c>();

      for (Integer i = 0; i < taskIds.size(); i++) {
        TLG_TASK__c task = new TLG_TASK__c(
          Id = taskIds[i]
          // Sort order field not available, just updating to trigger LastModifiedDate change
        );
        tasksToUpdate.add(task);
      }

      if (!tasksToUpdate.isEmpty()) {
        update tasksToUpdate;
      }
    } catch (Exception e) {
      AuraErrorUtil.throwAuraOrIllegal('Failed to update task order: ' + e.getMessage());
    }
  }

  // Helper for TLG_TASK__c field validation
  @SuppressWarnings('PMD.CyclomaticComplexity')
  private static void validateTaskFields(TLG_Task__c task, Boolean isUpdate) {
    if (task == null || (isUpdate && task.Id == null)) {
      AuraErrorUtil.throwAuraOrIllegal(
        isUpdate
          ? 'Invalid task data provided for update. Task or Task Id cannot be null.'
          : 'Task data is required.'
      );
    }

    // For updates, only validate required fields if they are being explicitly set
    // For creates, validate all required fields
    if (!isUpdate) {
      List<String> missingFields = new List<String>();
      if (String.isBlank(task.Name)) {
        missingFields.add('Title');
      }
      // Enforce Case (Master-Detail) on create
      if (task.TLG_Case__c == null) {
        missingFields.add('Case');
      }
      // Add more required fields as needed
      if (!missingFields.isEmpty()) {
        AuraErrorUtil.throwAuraOrIllegal(
          'Missing required field(s): ' + String.join(missingFields, ', ')
        );
      }
    }
    // For updates, we skip required field validation since we might be doing partial updates
    // The database will enforce any actual required fields that are missing
  }

  // Helper for TLG_Task__c CRUD check
  private static void checkTaskCrud(String operation) {
    // Use Schema.getGlobalDescribe() instead of direct sObjectType reference
    Map<String, Schema.SObjectType> globalDescribe = Schema.getGlobalDescribe();
  Schema.SObjectType taskType = globalDescribe.get('TLG_Task__c');

    if (
      operation == 'create' && !taskType.getDescribe().isCreateable()
    ) {
      AuraErrorUtil.throwAuraOrIllegal('You do not have permission to create tasks.');
    }
    if (
      operation == 'update' && !taskType.getDescribe().isUpdateable()
    ) {
      AuraErrorUtil.throwAuraOrIllegal('You do not have permission to update tasks.');
    }
  }

  // Helper to check delete CRUD for TLG_Task__c
  private static void checkTaskDeleteCrud() {
    // Use Schema.getGlobalDescribe() instead of direct sObjectType reference
    Map<String, Schema.SObjectType> globalDescribe = Schema.getGlobalDescribe();
  Schema.SObjectType taskType = globalDescribe.get('TLG_Task__c');

    if (!taskType.getDescribe().isDeletable()) {
      AuraErrorUtil.throwAuraOrIllegal('You do not have permission to delete tasks.');
    }
  }

  // Helper to find and delete a task by Id with error handling
  private static void findAndDeleteTask(String taskId) {
    if (String.isBlank(taskId)) {
      AuraErrorUtil.throwAuraOrIllegal('Task ID cannot be null or empty.');
    }
    List<TLG_Task__c> tasks = [
      SELECT Id
      FROM TLG_Task__c
      WHERE Id = :taskId
      WITH SECURITY_ENFORCED
      LIMIT 1
    ];
    if (tasks.isEmpty()) {
      AuraErrorUtil.throwAuraOrIllegal('Task not found with Id: ' + taskId);
    }
    delete tasks[0];
  }
}