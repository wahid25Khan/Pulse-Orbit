/**
 * @description Service class for handling file operations related to tasks.
 * Manages file associations, uploads, and metadata retrieval with proper
 * security checks and error handling.
 */
public with sharing class FileManagementService {

    /**
     * @description Associate existing files with multiple tasks.
     * @param taskIds List of task IDs to associate files with.
     * @param contentDocumentIds List of ContentDocument IDs to associate.
     * @return Map of task IDs to lists of successfully related ContentDocument IDs.
     * @throws Exception if validation fails or an error occurs.
     */
    public static Map<Id, List<Id>> relateFilesToTasks(List<Id> taskIds, List<Id> contentDocumentIds) {
        if (taskIds == null || taskIds.isEmpty() || contentDocumentIds == null || contentDocumentIds.isEmpty()) {
            throw new IllegalArgumentException('Task IDs and ContentDocument IDs cannot be null or empty');
        }

        Map<Id, List<Id>> result = new Map<Id, List<Id>>();
        List<ContentDocumentLink> linksToCreate = new List<ContentDocumentLink>();

        try {
            // Check permissions
            checkFilePermissions('create');

            // Create a ContentDocumentLink for each task-file combination
            for (Id taskId : taskIds) {
                List<Id> linkedFiles = new List<Id>();

                for (Id contentDocumentId : contentDocumentIds) {
                    ContentDocumentLink cdl = new ContentDocumentLink();
                    cdl.LinkedEntityId = taskId;
                    cdl.ContentDocumentId = contentDocumentId;
                    cdl.ShareType = 'V'; // V = Viewer permission
                    cdl.Visibility = 'AllUsers';
                    linksToCreate.add(cdl);
                    linkedFiles.add(contentDocumentId);
                }

                result.put(taskId, linkedFiles);
            }

            if (!linksToCreate.isEmpty()) {
                insert linksToCreate;
            }

            return result;
        } catch (Exception e) {
            String errorMsg = 'Error relating files to tasks: ' + e.getMessage();
            throw new IllegalArgumentException(errorMsg);
        }
    }

    /**
     * @description Associate existing files with a single task.
     * @param taskId The ID of the task to associate files with.
     * @param contentDocumentIds List of ContentDocument IDs to associate.
     * @return List of ContentDocument IDs that were successfully linked.
     * @throws AuraHandledException if validation fails or an error occurs.
     */
    public static List<Id> relateFilesToTask(Id taskId, List<Id> contentDocumentIds) {
        if (taskId == null || contentDocumentIds == null || contentDocumentIds.isEmpty()) {
            throw new IllegalArgumentException('Task ID and ContentDocument IDs cannot be null or empty');
        }

        try {
            Map<Id, List<Id>> result = relateFilesToTasks(new List<Id>{taskId}, contentDocumentIds);
            return result.get(taskId);
        } catch (Exception e) {
            String errorMsg = 'Error relating files to task: ' + e.getMessage();
            throw new IllegalArgumentException(errorMsg);
        }
    }

    /**
     * @description Upload a file and associate it with multiple tasks.
     * @param fileName The name of the file.
     * @param fileContent Base64-encoded file content.
     * @param contentType MIME type of the file.
     * @param taskIds List of task IDs to associate the file with.
     * @return Map with file ID and name for UI display.
     * @throws AuraHandledException if validation fails or an error occurs.
     */
    public static Map<String, String> uploadFileToTasks(
        String fileName,
        String fileContent,
        String contentType,
        List<String> taskIds
    ) {
        if (String.isBlank(fileName) || String.isBlank(fileContent) || taskIds == null || taskIds.isEmpty()) {
            throw new IllegalArgumentException('File name, content, and task IDs cannot be null or empty');
        }

        try {
            // Check permissions
            checkFilePermissions('create');

            // Validate file size (10MB max)
            validateFileSize(fileContent, 10);

            // Create ContentVersion
            ContentVersion cv = new ContentVersion();
            cv.VersionData = EncodingUtil.base64Decode(fileContent);
            cv.Title = fileName;
            cv.PathOnClient = fileName;
            cv.IsMajorVersion = true;

            insert cv;

            // Get ContentDocument ID
            ContentVersion insertedCv = [
                SELECT ContentDocumentId
                FROM ContentVersion
                WHERE Id = :cv.Id
                LIMIT 1
            ];

            // Link to tasks
            List<Id> taskIdList = new List<Id>();
            for (String taskId : taskIds) {
                taskIdList.add(Id.valueOf(taskId));
            }

            relateFilesToTasks(taskIdList, new List<Id>{insertedCv.ContentDocumentId});

            // Return file info
            Map<String, String> result = new Map<String, String>();
            result.put('documentId', insertedCv.ContentDocumentId);
            result.put('fileName', fileName);

            return result;
        } catch (Exception e) {
            String errorMsg = 'Error uploading file: ' + e.getMessage();
            throw new IllegalArgumentException(errorMsg);
        }
    }

    /**
     * @description Get files associated with a task along with metadata.
     * @param taskId The ID of the task to get files for.
     * @return List of maps containing file details and metadata.
     * @throws AuraHandledException if taskId is invalid or an error occurs.
     */
    public static List<Map<String, Object>> getTaskFilesWithMetadata(String taskId) {
        if (String.isBlank(taskId)) {
            throw new IllegalArgumentException('Task ID cannot be null or empty');
        }

        try {
            // Check permissions
            checkFilePermissions('read');

            List<Map<String, Object>> result = new List<Map<String, Object>>();

            // Query ContentDocumentLinks
            List<ContentDocumentLink> links = [
                SELECT ContentDocumentId, ContentDocument.Title, ContentDocument.FileExtension,
                       ContentDocument.ContentSize, ContentDocument.FileType,
                       ContentDocument.LatestPublishedVersionId
                FROM ContentDocumentLink
                WHERE LinkedEntityId = :taskId
                ORDER BY ContentDocument.LastModifiedDate DESC
            ];

            // Build response
            for (ContentDocumentLink cdl : links) {
                Map<String, Object> fileInfo = new Map<String, Object>();
                fileInfo.put('documentId', cdl.ContentDocumentId);
                fileInfo.put('title', cdl.ContentDocument.Title);
                fileInfo.put('extension', cdl.ContentDocument.FileExtension);
                fileInfo.put('size', cdl.ContentDocument.ContentSize);
                fileInfo.put('fileType', cdl.ContentDocument.FileType);
                fileInfo.put('versionId', cdl.ContentDocument.LatestPublishedVersionId);
                fileInfo.put('downloadUrl', '/sfc/servlet.shepherd/document/download/' + cdl.ContentDocumentId);
                fileInfo.put('previewUrl', getFilePreviewUrl(cdl.ContentDocumentId));

                result.add(fileInfo);
            }

            return result;
        } catch (Exception e) {
            String errorMsg = 'Error retrieving task files: ' + e.getMessage();
            throw new IllegalArgumentException(errorMsg);
        }
    }

    /**
     * @description Remove the association between a file and a task.
     * @param taskId The ID of the task.
     * @param contentDocumentId The ID of the ContentDocument.
     * @throws AuraHandledException if validation fails or an error occurs.
     */
    public static void deleteFileTaskAssociation(Id taskId, Id contentDocumentId) {
        if (taskId == null || contentDocumentId == null) {
            throw new IllegalArgumentException('Task ID and ContentDocument ID cannot be null');
        }

        try {
            // Check permissions
            checkFilePermissions('delete');

            // Query for the ContentDocumentLink
            ContentDocumentLink link = [
                SELECT Id
                FROM ContentDocumentLink
                WHERE LinkedEntityId = :taskId
                AND ContentDocumentId = :contentDocumentId
                LIMIT 1
            ];

            delete link;
        } catch (Exception e) {
            String errorMsg = 'Error deleting file association: ' + e.getMessage();
            throw new IllegalArgumentException(errorMsg);
        }
    }

    /**
     * @description Get a URL for previewing a file in Salesforce.
     * @param contentDocumentId The ID of the ContentDocument.
     * @return String URL for file preview.
     */
    public static String getFilePreviewUrl(Id contentDocumentId) {
        return '/sfc/servlet.shepherd/version/renditionDownload?rendition=THUMB720BY480&versionId=' +
               contentDocumentId + '&operationContext=CHATTER&contentId=' + contentDocumentId;
    }

    /**
     * @description Checks if the current user has the necessary permissions for file operations.
     * @param operation The operation type ('create', 'read', 'update', 'delete').
     * @throws AuraHandledException if the user lacks the necessary permissions.
     */
    private static void checkFilePermissions(String operation) {
        // Use Schema.getGlobalDescribe() to get the describe for ContentVersion
        Map<String, Schema.SObjectType> globalDescribe = Schema.getGlobalDescribe();
        Schema.DescribeSObjectResult contentVersionDescribe = globalDescribe.get('ContentVersion').getDescribe();

        Boolean hasPermission = false;
        String lowerOp = operation.toLowerCase();

        if (lowerOp == 'create') {
            hasPermission = contentVersionDescribe.isCreateable();
        } else if (lowerOp == 'read') {
            hasPermission = contentVersionDescribe.isAccessible();
        } else if (lowerOp == 'update') {
            hasPermission = contentVersionDescribe.isUpdateable();
        } else if (lowerOp == 'delete') {
            hasPermission = contentVersionDescribe.isDeletable();
        } else {
            hasPermission = false;
        }

        if (!hasPermission) {
            throw new IllegalArgumentException('Insufficient permissions to ' + operation + ' files');
        }
    }

    /**
     * @description Validates that a file doesn't exceed maximum size limits.
     * @param fileContent The Base64-encoded file content.
     * @param maxSizeInMB Maximum allowed size in MB.
     * @throws AuraHandledException if the file exceeds the size limit.
     */
    private static void validateFileSize(String fileContent, Integer maxSizeInMB) {
        Integer maxSizeInBytes = maxSizeInMB * 1024 * 1024;
        Integer contentSize = (fileContent.length() * 3) / 4;

        if (contentSize > maxSizeInBytes) {
            throw new IllegalArgumentException('File size exceeds the maximum limit of ' + maxSizeInMB + 'MB');
        }
    }
}