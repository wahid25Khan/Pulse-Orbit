/**
 * @description Custom logging utility for Pulse Orbit Kanban Board
 * Provides centralized logging with debug mode control
 * Addresses Issue #009: System.debug calls in production code
 */
public with sharing class PulseOrbitLogger {
    
    // Enable/disable logging via custom metadata or custom setting
    private static Boolean debugEnabled = false; // Set to false for production
    
    // Log levels
    public enum LogLevel {
        DEBUG, INFO, WARN, ERROR
    }
    
    /**
     * @description Log a debug message (only if debug mode enabled)
     * @param message The message to log
     */
    public static void debug(String message) {
        if (debugEnabled) {
            System.debug(LoggingLevel.DEBUG, '[PULSE-ORBIT] ' + message);
        }
    }
    
    /**
     * @description Log an info message
     * @param message The message to log
     */
    public static void info(String message) {
        if (debugEnabled) {
            System.debug(LoggingLevel.INFO, '[PULSE-ORBIT] ' + message);
        }
    }
    
    /**
     * @description Log a warning message
     * @param message The message to log
     */
    public static void warn(String message) {
        if (debugEnabled) {
            System.debug(LoggingLevel.WARN, '[PULSE-ORBIT] ' + message);
        }
    }
    
    /**
     * @description Log an error message (always logged)
     * @param message The message to log
     */
    public static void error(String message) {
        // Errors are always logged, even in production
        System.debug(LoggingLevel.ERROR, '[PULSE-ORBIT] ' + message);
    }
    
    /**
     * @description Log an error with exception details (always logged)
     * @param message The message to log
     * @param ex The exception to log
     */
    public static void error(String message, Exception ex) {
        // Errors are always logged, even in production
        System.debug(LoggingLevel.ERROR, '[PULSE-ORBIT] ' + message + ' | Exception: ' + ex.getMessage() + ' | Stack: ' + ex.getStackTraceString());
    }
    
    /**
     * @description Set debug mode
     * @param enabled Whether debug logging should be enabled
     */
    public static void setDebugMode(Boolean enabled) {
        debugEnabled = enabled;
    }
    
    /**
     * @description Check if debug mode is enabled
     * @return Boolean indicating if debug mode is on
     */
    public static Boolean isDebugEnabled() {
        return debugEnabled;
    }
    
    /**
     * @description Log query execution for debugging
     * @param queryString The SOQL query being executed
     * @param recordCount Number of records returned
     */
    public static void logQuery(String queryString, Integer recordCount) {
        if (debugEnabled) {
            System.debug(LoggingLevel.DEBUG, '[PULSE-ORBIT QUERY] ' + queryString + ' | Records: ' + recordCount);
        }
    }
}
