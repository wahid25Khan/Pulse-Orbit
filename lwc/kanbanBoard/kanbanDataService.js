/**
 * Data validation and field mapping service for Kanban Board
 * Addresses field name consistency and data validation issues
 */

export class KanbanDataService {
  // Standard field mappings to ensure consistency
  static FIELD_MAPPINGS = {
    status: "TLG_Status__c",
    priority: "TLG_Priority__c",
    assignee: "TLG_Assigned_To__c",
    dueDate: "TLG_Due_Date__c",
    project: "TLG_Opportunity__c",
    team: "TLG_Team__c",
    account: "TLG_Account__c",
    description: "TLG_Shared_Notes__c",
    loggedTime: "TLG_Logged_Time__c"
  };

  // Valid status values
  static VALID_STATUSES = [
    "Not Started",
    "In Progress",
    "Ready for Review",
    "Waiting on Client",
    "On hold",
    "Reopened",
    "Completed",
    "Closed",
    "Cancelled",
    "Pending",
    "QA"
  ];

  // Valid priority values
  static VALID_PRIORITIES = ["Low", "Medium", "High", "Critical"];

  /**
   * Get standardized field name
   * @param {string} fieldName - Input field name
   * @returns {string} Standardized field name
   */
  static getStandardFieldName(fieldName) {
    return this.FIELD_MAPPINGS[fieldName] || fieldName;
  }

  /**
   * Validate task data before save/update
   * @param {Object} taskData - Task data to validate
   * @param {boolean} isUpdate - Whether this is an update operation
   * @returns {Object} Validation result
   */
  static validateTaskData(taskData, isUpdate = false) {
    const errors = {};
    const warnings = [];

    // Required field validation
    if (!isUpdate || Object.prototype.hasOwnProperty.call(taskData, "Name")) {
      if (!taskData.Name || taskData.Name.trim().length === 0) {
        errors.Name = "Task name is required";
      } else if (taskData.Name.length > 80) {
        errors.Name = "Task name cannot exceed 80 characters";
      }
    }

    // Status validation
    if (
      taskData.TLG_Status__c &&
      !this.VALID_STATUSES.includes(taskData.TLG_Status__c)
    ) {
      errors.TLG_Status__c = `Invalid status. Must be one of: ${this.VALID_STATUSES.join(", ")}`;
    }

    // Priority validation
    if (
      taskData.TLG_Priority__c &&
      !this.VALID_PRIORITIES.includes(taskData.TLG_Priority__c)
    ) {
      errors.TLG_Priority__c = `Invalid priority. Must be one of: ${this.VALID_PRIORITIES.join(", ")}`;
    }

    // Due date validation
    if (taskData.TLG_Due_Date__c) {
      const dueDate = new Date(taskData.TLG_Due_Date__c);
      if (isNaN(dueDate.getTime())) {
        errors.TLG_Due_Date__c = "Invalid due date format";
      } else if (dueDate < new Date().setHours(0, 0, 0, 0)) {
        warnings.push("Due date is in the past");
      }
    }

    // Description length validation
    if (
      taskData.TLG_Shared_Notes__c &&
      taskData.TLG_Shared_Notes__c.length > 32000
    ) {
      errors.TLG_Shared_Notes__c =
        "Description is too long (max 32,000 characters)";
    }

    // Email validation for assignee (if provided as email)
    if (
      taskData.TLG_Assigned_To__c &&
      typeof taskData.TLG_Assigned_To__c === "string"
    ) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (
        taskData.TLG_Assigned_To__c.includes("@") &&
        !emailRegex.test(taskData.TLG_Assigned_To__c)
      ) {
        errors.TLG_Assigned_To__c = "Invalid email format for assignee";
      }
    }

    return {
      isValid: Object.keys(errors).length === 0,
      errors,
      warnings
    };
  }

  /**
   * Sanitize HTML content to prevent XSS
   * @param {string} htmlContent - HTML content to sanitize
   * @returns {string} Sanitized HTML
   */
  static sanitizeHtml(htmlContent) {
    if (!htmlContent || typeof htmlContent !== "string") {
      return "";
    }

    // Basic HTML sanitization - remove script tags and dangerous attributes
    // Note: In production, consider using a more robust HTML sanitization library

    // Remove script tags and their content
    let sanitized = htmlContent.replace(
      /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
      ""
    );

    // Remove dangerous event handlers (more comprehensive)
    sanitized = sanitized.replace(
      /\s*on\w+\s*=\s*["']([^"']*["'][^"']*)*[^"']*["']/gi,
      ""
    );
    sanitized = sanitized.replace(/\s*on\w+\s*=\s*[^"\s'>]+/gi, "");

    // Remove javascript: links more thoroughly
    sanitized = sanitized.replace(
      /href\s*=\s*["']javascript:[^"']*["']/gi,
      'href=""'
    );
    sanitized = sanitized.replace(
      /href\s*=\s*javascript:[^"\s'>]+/gi,
      'href=""'
    );

    // Remove style attributes that could contain expression
    sanitized = sanitized.replace(
      /style\s*=\s*["'][^"']*expression[^"']*["']/gi,
      ""
    );

    return sanitized;
  }

  /**
   * File upload validation
   */
  static validateFileUpload(file) {
    const errors = [];
    const maxSize = 5 * 1024 * 1024; // 5MB
    const allowedTypes = [
      "image/jpeg",
      "image/png",
      "image/gif",
      "application/pdf",
      "text/plain",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    ];

    // Validate file size
    if (file.size > maxSize) {
      errors.push("File size exceeds 5MB limit");
    }

    // Validate file type
    if (!allowedTypes.includes(file.type)) {
      errors.push(
        `File type not allowed. Allowed types: ${allowedTypes.join(", ")}`
      );
    }

    // Validate file name
    const invalidChars = /[<>:"/\\|?*]/;
    if (invalidChars.test(file.name)) {
      errors.push("File name contains invalid characters");
    }

    // Check for double extensions (potential security risk)
    const doubleExtension = /\.[a-zA-Z0-9]+\.[a-zA-Z0-9]+$/;
    if (doubleExtension.test(file.name)) {
      errors.push("File name contains suspicious double extension");
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Normalize task data structure
   * @param {Object} rawTaskData - Raw task data from API
   * @returns {Object} Normalized task data
   */
  static normalizeTaskData(rawTaskData) {
    if (!rawTaskData) return null;

    // Create normalized task that matches kanban-card component expectations
    const normalized = {
      // Core identification
      Id: rawTaskData.Id || rawTaskData.id,
      Name: rawTaskData.Name || rawTaskData.name || "",

      // Status and priority (using both formats for compatibility)
      Status__c:
        rawTaskData.TLG_Status__c ||
        rawTaskData.Status__c ||
        rawTaskData.status ||
        "Not Started",
      Priority__c:
        rawTaskData.TLG_Priority__c ||
        rawTaskData.Priority__c ||
        rawTaskData.priority ||
        "Medium",

      // Dates
      DueDate__c:
        rawTaskData.TLG_Due_Date__c ||
        rawTaskData.DueDate__c ||
        rawTaskData.dueDate,
      CreatedDate: rawTaskData.CreatedDate || rawTaskData.createdDate,
      LastModifiedDate:
        rawTaskData.LastModifiedDate || rawTaskData.lastModifiedDate,

      // Relationships
      TLG_Opportunity__c: rawTaskData.TLG_Opportunity__c || rawTaskData.project,
      TLG_Team__c: rawTaskData.TLG_Team__c || rawTaskData.team,
      TLG_Account__c: rawTaskData.TLG_Account__c || rawTaskData.account,
      TLG_Assigned_To__c:
        rawTaskData.TLG_Assigned_To__c || rawTaskData.assignee,

      // Description/Notes
      Description__c: this.sanitizeHtml(
        rawTaskData.TLG_Shared_Notes__c ||
          rawTaskData.Description__c ||
          rawTaskData.description ||
          ""
      ),
      TLG_Shared_Notes__c: this.sanitizeHtml(
        rawTaskData.TLG_Shared_Notes__c || rawTaskData.description || ""
      ),

      // Time tracking
      TLG_Logged_Time__c:
        rawTaskData.TLG_Logged_Time__c || rawTaskData.loggedTime || 0,

      // Additional properties for UI compatibility
      id: rawTaskData.Id || rawTaskData.id,
      name: rawTaskData.Name || rawTaskData.name || "",
      status:
        rawTaskData.TLG_Status__c ||
        rawTaskData.Status__c ||
        rawTaskData.status ||
        "Not Started",
      priority:
        rawTaskData.TLG_Priority__c ||
        rawTaskData.Priority__c ||
        rawTaskData.priority ||
        "Medium",
      dueDate:
        rawTaskData.TLG_Due_Date__c ||
        rawTaskData.DueDate__c ||
        rawTaskData.dueDate,
      description: this.sanitizeHtml(
        rawTaskData.TLG_Shared_Notes__c ||
          rawTaskData.Description__c ||
          rawTaskData.description ||
          ""
      ),

      // Default assignees, tags, attachments for kanban-card compatibility
      assignees: [],
      tags: [],
      attachments: [],
      subtasks: [],
      activityLog: []
    };

    // Add computed properties
    normalized.isOverdue =
      normalized.dueDate && new Date(normalized.dueDate) < new Date();
    normalized.statusClass = this.getStatusClass(normalized.status);
    normalized.priorityClass = this.getPriorityClass(normalized.priority);

    return normalized;
  }

  /**
   * Get CSS class for status
   * @param {string} status - Task status
   * @returns {string} CSS class name
   */
  static getStatusClass(status) {
    const statusClasses = {
      "Not Started": "status-not-started",
      "In Progress": "status-in-progress",
      Blocked: "status-blocked",
      Review: "status-review",
      Completed: "status-completed"
    };
    return statusClasses[status] || "status-default";
  }

  /**
   * Get CSS class for priority
   * @param {string} priority - Task priority
   * @returns {string} CSS class name
   */
  static getPriorityClass(priority) {
    const priorityClasses = {
      Low: "priority-low",
      Medium: "priority-medium",
      High: "priority-high",
      Critical: "priority-critical"
    };
    return priorityClasses[priority] || "priority-default";
  }

  /**
   * Cache management for performance
   */
  static createDataCache() {
    const cache = new Map();
    const maxAge = 5 * 60 * 1000; // 5 minutes

    return {
      get(key) {
        const item = cache.get(key);
        if (item && Date.now() - item.timestamp < maxAge) {
          return item.data;
        }
        return null;
      },

      set(key, data) {
        cache.set(key, {
          data,
          timestamp: Date.now()
        });
      },

      delete(key) {
        cache.delete(key);
      },

      clear() {
        cache.clear();
      },

      // Clean expired entries
      cleanup() {
        const now = Date.now();
        for (const [key, item] of cache.entries()) {
          if (now - item.timestamp >= maxAge) {
            cache.delete(key);
          }
        }
      },

      // Query method for DOM element caching
      query(selector) {
        // This is a simplified version for testing
        // In a real implementation, this would interface with the component's template
        const cachedResult = this.get(selector);
        if (cachedResult) {
          return cachedResult;
        }

        // Mock DOM element for testing
        const mockElement = {
          selector: selector,
          querySelector: () => null,
          querySelectorAll: () => []
        };

        this.set(selector, mockElement);
        return mockElement;
      }
    };
  }

  /**
   * Deep clone object (to avoid reference issues)
   * @param {Object} obj - Object to clone
   * @returns {Object} Cloned object
   */
  static deepClone(obj) {
    if (obj === null || typeof obj !== "object") {
      return obj;
    }

    if (obj instanceof Date) {
      return new Date(obj.getTime());
    }

    if (obj instanceof Array) {
      return obj.map((item) => this.deepClone(item));
    }

    const cloned = {};
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        cloned[key] = this.deepClone(obj[key]);
      }
    }

    return cloned;
  }

  /**
   * Generate unique identifier
   * @returns {string} Unique ID
   */
  static generateUniqueId() {
    return "task_" + Date.now() + "_" + Math.random().toString(36).substr(2, 9);
  }

  /**
   * Validate API response for required fields
   * @param {Object|Array} response - API response to validate
   * @param {Array} requiredFields - Required fields to check
   * @returns {void}
   */
  static validateApiResponse(response, requiredFields = []) {
    if (!response) {
      throw new Error("API response is null or undefined");
    }

    if (Array.isArray(response)) {
      // Validate array response
      if (response.length === 0) {
        console.warn("API returned empty array");
        return;
      }
      // Check first item for required fields
      if (requiredFields.length > 0 && response[0]) {
        this._validateRequiredFields(response[0], requiredFields);
      }
    } else {
      // Validate object response
      if (requiredFields.length > 0) {
        this._validateRequiredFields(response, requiredFields);
      }
    }
  }

  /**
   * Check required fields in an object
   * @param {Object} obj - Object to check
   * @param {Array} fields - Required fields
   * @private
   */
  static _validateRequiredFields(obj, fields) {
    for (const field of fields) {
      if (!(field in obj) || obj[field] === null || obj[field] === undefined) {
        console.warn(`Missing required field: ${field}`);
      }
    }
  }

  /**
   * Validate array of tasks
   * @param {Array} tasks - Array of tasks to validate
   * @returns {Array} Validated tasks
   */
  static validateTaskArray(tasks) {
    if (!Array.isArray(tasks)) {
      console.warn("Expected array of tasks, got:", typeof tasks);
      return [];
    }
    return tasks.filter((task) => task && typeof task === "object");
  }

  /**
   * Get task status with normalization
   * @param {Object} task - Task object
   * @returns {string} Normalized status
   */
  static getTaskStatus(task) {
    if (!task) return "Backlog";

    // Check common status field names
    return (
      task.TLG_Status__c ||
      task.Status__c ||
      task.status ||
      task.Status ||
      "Backlog"
    );
  }

  /**
   * Normalize task query parameters
   * @param {Object} params - Query parameters
   * @returns {Object} Normalized parameters
   */
  static normalizeTaskQueryParams(params) {
    if (!params || typeof params !== "object") {
      return {};
    }

    const normalized = { ...params };

    // Normalize field names
    if (normalized.status) {
      normalized.TLG_Status__c = normalized.status;
      delete normalized.status;
    }

    if (normalized.priority) {
      normalized.TLG_Priority__c = normalized.priority;
      delete normalized.priority;
    }

    return normalized;
  }

  /**
   * Sanitize file name for security
   * @param {string} fileName - Original file name
   * @returns {string} Sanitized file name
   */
  static sanitizeFileName(fileName) {
    if (!fileName || typeof fileName !== "string") {
      return "unknown_file";
    }

    // Remove dangerous characters and normalize
    return fileName
      .replace(/[^a-zA-Z0-9._-]/g, "_")
      .substring(0, 100) // Limit length
      .toLowerCase();
  }
}