/**
 * @description Service class for handling task CRUD operations and management.
 * Extracted from KanbanBoardController for better maintainability and separation of concerns.
 */
public with sharing class TaskManagementService {
  /**
   * @description Create a new TLG_TASK__c with FLS/CRUD and error handling.
   * @param newTask The TLG_TASK__c record to create.
   * @return The created TLG_TASK__c record.
   * @throws IllegalArgumentException if validation fails, user lacks permissions, or an error occurs during creation.
   */
  public static TLG_TASK__c createTask(TLG_TASK__c newTask) {
    validateTaskFields(newTask, false);
    try {
      checkTaskCrud('create');
      SObjectAccessDecision decision = Security.stripInaccessible(
        AccessType.CREATABLE,
        new List<TLG_TASK__c>{ newTask }
      );
      List<TLG_TASK__c> tasksToInsert = (List<TLG_TASK__c>) decision.getRecords();
      insert tasksToInsert;
      return tasksToInsert[0];
    } catch (Exception e) {
      throw new IllegalArgumentException(
        'Failed to create task: ' + e.getMessage()
      );
    }
  }

  /**
   * @description Update a TLG_TASK__c with FLS/CRUD and error handling.
   * @param updatedTask The TLG_TASK__c record to update.
   * @return The updated TLG_TASK__c record.
   * @throws IllegalArgumentException if validation fails, user lacks permissions, or an error occurs during update.
   */
  public static TLG_TASK__c updateTask(TLG_TASK__c updatedTask) {
    validateTaskFields(updatedTask, true);
    try {
      checkTaskCrud('update');
      SObjectAccessDecision decision = Security.stripInaccessible(
        AccessType.UPDATABLE,
        new List<TLG_TASK__c>{ updatedTask }
      );
      List<TLG_TASK__c> tasksToUpdate = (List<TLG_TASK__c>) decision.getRecords();
      update tasksToUpdate;
      return tasksToUpdate[0];
    } catch (Exception e) {
      throw new IllegalArgumentException(
        'Failed to update task: ' + e.getMessage()
      );
    }
  }

  /**
   * @description Moves a task to a new status.
   * @param taskId The Id of the TLG_TASK__c to move.
   * @param newStatus The new status for the task.
   * @return The updated TLG_TASK__c record.
   * @throws IllegalArgumentException if taskId or newStatus is blank, or if the task is not found.
   */
  public static TLG_TASK__c moveTask(String taskId, String newStatus) {
    if (String.isBlank(taskId)) {
      throw new IllegalArgumentException('Task ID cannot be null or empty.');
    }
    if (String.isBlank(newStatus)) {
      throw new IllegalArgumentException('New status cannot be null or empty.');
    }

    List<TLG_TASK__c> tasks = [
      SELECT Id, TLG_Status__c
      FROM TLG_TASK__c
      WHERE Id = :taskId
      WITH SECURITY_ENFORCED
      LIMIT 1
    ];
    if (tasks.isEmpty()) {
      throw new IllegalArgumentException('Task not found with Id: ' + taskId);
    }
    TLG_TASK__c task = tasks[0];

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
      throw new IllegalArgumentException(
        'Failed to delete task: ' + e.getMessage()
      );
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
  public static TLG_TASK__c updateTaskOrder(
    String taskId,
    Integer newOrder,
    String columnId
  ) {
    if (String.isBlank(taskId)) {
      throw new IllegalArgumentException('Task ID is required for reordering.');
    }
    if (newOrder == null || newOrder < 0) {
      throw new IllegalArgumentException('Valid order position is required.');
    }

    try {
      checkTaskCrud('update');

      List<TLG_TASK__c> tasks = [
        SELECT Id, TLG_Status__c, LastModifiedDate
        FROM TLG_TASK__c
        WHERE Id = :taskId
        WITH SECURITY_ENFORCED
        LIMIT 1
      ];

      if (tasks.isEmpty()) {
        throw new IllegalArgumentException('Task not found with Id: ' + taskId);
      }

      TLG_TASK__c task = tasks[0];

      // Workaround: Update LastModifiedDate to simulate ordering
      // This will affect the sort order in queries that ORDER BY LastModifiedDate DESC
      // To implement true ordering, add an Order__c or Sort_Order__c field to TLG_TASK__c

      // If columnId is provided, ensure task is in the correct status
      if (String.isNotBlank(columnId)) {
        // columnId represents the status picklist value directly
        task.TLG_Status__c = columnId;
      }

      // Force an update to change LastModifiedDate (ordering workaround)
      update task;

      // Refresh the task to get updated values
      task = [
        SELECT Id, Name, TLG_Status__c, LastModifiedDate
        FROM TLG_TASK__c
        WHERE Id = :taskId
        WITH SECURITY_ENFORCED
        LIMIT 1
      ];

      return task;
    } catch (Exception e) {
      throw new IllegalArgumentException(
        'Failed to update task order: ' + e.getMessage()
      );
    }
  }

  /**
   * @description Bulk update tasks with new field values.
   * @param taskIds List of task Ids to update.
   * @param fieldUpdates Map of field names to new values.
   * @return List of updated TLG_TASK__c records.
   * @throws IllegalArgumentException if validation fails or update error occurs.
   */
  public static List<TLG_TASK__c> bulkUpdateTasks(
    List<String> taskIds,
    Map<String, Object> fieldUpdates
  ) {
    if (taskIds == null || taskIds.isEmpty()) {
      throw new IllegalArgumentException('Task IDs are required for bulk update.');
    }
    if (fieldUpdates == null || fieldUpdates.isEmpty()) {
      throw new IllegalArgumentException(
        'Field updates are required for bulk update.'
      );
    }

    try {
      checkTaskCrud('update');

      List<TLG_TASK__c> tasks = [
        SELECT
          Id,
          Name,
          TLG_Status__c,
          TLG_Priority__c,
          TLG_Assigned_To__c,
          TLG_Due_Date__c,
          TLG_Team__c,
          TLG_Opportunity__c
        FROM TLG_TASK__c
        WHERE Id IN :taskIds
        WITH SECURITY_ENFORCED
      ];

      // Apply field updates to each task
      for (TLG_TASK__c task : tasks) {
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
              task.TLG_Assigned_To__c = (Id) fieldValue;
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
              continue;
            }
          }
        }
      }

      SObjectAccessDecision decision = Security.stripInaccessible(
        AccessType.UPDATABLE,
        tasks
      );
      List<TLG_TASK__c> tasksToUpdate = (List<TLG_TASK__c>) decision.getRecords();
      update tasksToUpdate;

      return tasksToUpdate;
    } catch (Exception e) {
      throw new IllegalArgumentException(
        'Failed to bulk update tasks: ' + e.getMessage()
      );
    }
  }

  /**
   * @description Create a task from Map data.
   * @param taskData Map containing task field values.
   * @return The created TLG_TASK__c record.
   * @throws IllegalArgumentException if creation fails.
   */
  public static TLG_TASK__c createTaskFromMap(Map<String, Object> taskData) {
    if (taskData == null || taskData.isEmpty()) {
      throw new IllegalArgumentException('Task data is required.');
    }

    try {
      TLG_TASK__c newTask = new TLG_TASK__c();

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

      return createTask(newTask);
    } catch (Exception e) {
      throw new IllegalArgumentException(
        'Failed to create task from map: ' + e.getMessage()
      );
    }
  }

  /**
   * @description Update a task from Map data.
   * @param taskId The Id of the task to update.
   * @param taskData Map containing updated field values.
   * @return The updated TLG_TASK__c record.
   * @throws IllegalArgumentException if update fails.
   */
  public static TLG_TASK__c updateTaskFromMap(
    Id taskId,
    Map<String, Object> taskData
  ) {
    if (taskId == null) {
      throw new IllegalArgumentException('Task ID is required.');
    }
    if (taskData == null || taskData.isEmpty()) {
      throw new IllegalArgumentException('Task data is required.');
    }

    try {
      TLG_TASK__c taskToUpdate = new TLG_TASK__c(Id = taskId);

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

      return updateTask(taskToUpdate);
    } catch (Exception e) {
      throw new IllegalArgumentException(
        'Failed to update task from map: ' + e.getMessage()
      );
    }
  }

  /**
   * @description Update task order from list of task IDs.
   * @param taskIds List of task IDs in new order.
   * @throws IllegalArgumentException if update fails.
   */
  public static void updateTaskOrder(List<String> taskIds) {
    if (taskIds == null || taskIds.isEmpty()) {
      throw new IllegalArgumentException('Task IDs are required.');
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
      throw new IllegalArgumentException(
        'Failed to update task order: ' + e.getMessage()
      );
    }
  }

  // Helper for TLG_TASK__c field validation
  @SuppressWarnings('PMD.CyclomaticComplexity')
  private static void validateTaskFields(TLG_TASK__c task, Boolean isUpdate) {
    if (task == null || (isUpdate && task.Id == null)) {
      throw new IllegalArgumentException(
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
      if (task.TLG_Opportunity__c == null) {
        missingFields.add('Project');
      }
      // Add more required fields as needed
      if (!missingFields.isEmpty()) {
        throw new IllegalArgumentException(
          'Missing required field(s): ' + String.join(missingFields, ', ')
        );
      }
    }
    // For updates, we skip required field validation since we might be doing partial updates
    // The database will enforce any actual required fields that are missing
  }

  // Helper for TLG_TASK__c CRUD check
  private static void checkTaskCrud(String operation) {
    // Use Schema.getGlobalDescribe() instead of direct sObjectType reference
    Map<String, Schema.SObjectType> globalDescribe = Schema.getGlobalDescribe();
    Schema.SObjectType taskType = globalDescribe.get('TLG_TASK__c');

    if (
      operation == 'create' && !taskType.getDescribe().isCreateable()
    ) {
      throw new IllegalArgumentException(
        'You do not have permission to create tasks.'
      );
    }
    if (
      operation == 'update' && !taskType.getDescribe().isUpdateable()
    ) {
      throw new IllegalArgumentException(
        'You do not have permission to update tasks.'
      );
    }
  }

  // Helper to check delete CRUD for TLG_TASK__c
  private static void checkTaskDeleteCrud() {
    // Use Schema.getGlobalDescribe() instead of direct sObjectType reference
    Map<String, Schema.SObjectType> globalDescribe = Schema.getGlobalDescribe();
    Schema.SObjectType taskType = globalDescribe.get('TLG_TASK__c');

    if (!taskType.getDescribe().isDeletable()) {
      throw new IllegalArgumentException(
        'You do not have permission to delete tasks.'
      );
    }
  }

  // Helper to find and delete a task by Id with error handling
  private static void findAndDeleteTask(String taskId) {
    if (String.isBlank(taskId)) {
      throw new IllegalArgumentException('Task ID cannot be null or empty.');
    }
    List<TLG_TASK__c> tasks = [
      SELECT Id
      FROM TLG_TASK__c
      WHERE Id = :taskId
      WITH SECURITY_ENFORCED
      LIMIT 1
    ];
    if (tasks.isEmpty()) {
      throw new IllegalArgumentException('Task not found with Id: ' + taskId);
    }
    delete tasks[0];
  }
}