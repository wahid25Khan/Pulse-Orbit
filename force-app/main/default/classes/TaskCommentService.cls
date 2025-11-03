/**
 * @description Service class for handling task comments and @mentions.
 */
public with sharing class TaskCommentService {

    /**
     * @description Comment details wrapper class for returning to LWC
     */
    public class CommentDetails {
        @AuraEnabled public Id id { get; set; }
        @AuraEnabled public String text { get; set; }
        @AuraEnabled public Id taskId { get; set; }
        @AuraEnabled public Id createdById { get; set; }
        @AuraEnabled public String createdByName { get; set; }
        @AuraEnabled public String createdByPhotoUrl { get; set; }
        @AuraEnabled public Datetime createdDate { get; set; }
        @AuraEnabled public List<UserMention> mentions { get; set; }
    }

    /**
     * @description Comment with tags wrapper class for incoming comment data
     */
    public class CommentWithTags {
        @AuraEnabled public String text { get; set; }
        @AuraEnabled public Id taskId { get; set; }
        @AuraEnabled public List<UserMention> mentions { get; set; }
    }

    /**
     * @description User mention wrapper class
     */
    public class UserMention {
        @AuraEnabled public Id userId { get; set; }
        @AuraEnabled public String username { get; set; }
        @AuraEnabled public String name { get; set; }
        @AuraEnabled public Integer startIndex { get; set; }
        @AuraEnabled public Integer endIndex { get; set; }
    }

    /**
     * @description Creates a new task comment with @mentions
     * @param commentData Comment data including text, taskId, and mentions
     * @return Comment details object
     */
    public static CommentDetails createTaskComment(CommentWithTags commentData) {
        if (commentData == null || String.isBlank(commentData.text) || commentData.taskId == null) {
            AuraErrorUtil.throwAuraOrIllegal('Comment text and task ID are required');
            return null; // Unreachable, added for static analysis
        }

        try {
            // Create a ContentVersion (document) to store the comment
            ContentVersion cv = new ContentVersion();
            cv.Title = 'Comment on task ' + commentData.taskId;
            cv.VersionData = Blob.valueOf(commentData.text);
            cv.PathOnClient = 'comment_' + System.now().getTime() + '.txt';
            cv.IsMajorVersion = true;

            insert cv;

            // Query the ContentDocument ID after insert
            ContentVersion insertedCv = [
                SELECT ContentDocumentId
                FROM ContentVersion
                WHERE Id = :cv.Id
                LIMIT 1
            ];

            // Link the document to the task
            ContentDocumentLink cdl = new ContentDocumentLink();
            cdl.LinkedEntityId = commentData.taskId;
            cdl.ContentDocumentId = insertedCv.ContentDocumentId;
            cdl.ShareType = 'V';
            cdl.Visibility = 'AllUsers';

            insert cdl;

            // Return comment details
            CommentDetails details = new CommentDetails();
            details.id = insertedCv.ContentDocumentId;
            details.text = commentData.text;
            details.taskId = commentData.taskId;
            details.createdById = UserInfo.getUserId();
            details.createdByName = UserInfo.getName();
            details.createdDate = System.now();
            details.mentions = commentData.mentions;

            // Handle @mentions notifications
            if (commentData.mentions != null && !commentData.mentions.isEmpty()) {
                notifyMentionedUsers(commentData.mentions, commentData.taskId, commentData.text);
            }

            return details;
        } catch (Exception e) {
            AuraErrorUtil.throwAuraOrIllegal('Error creating task comment: ' + e.getMessage());
            return null; // Unreachable, added for static analysis
        }
    }

    /**
     * @description Gets comments for a task
     * @param taskId Task ID to get comments for
     * @return List of comment details
     */
    public static List<CommentDetails> getTaskComments(Id taskId) {
        if (taskId == null) {
            AuraErrorUtil.throwAuraOrIllegal('Task ID is required');
            return null; // Unreachable, added for static analysis
        }

        try {
            List<CommentDetails> comments = new List<CommentDetails>();

            // Query ContentDocumentLinks for documents attached to the task
            List<ContentDocumentLink> links = [
                SELECT ContentDocumentId, ContentDocument.Title, ContentDocument.CreatedById,
                       ContentDocument.CreatedBy.Name, ContentDocument.CreatedBy.SmallPhotoUrl,
                       ContentDocument.CreatedDate
                FROM ContentDocumentLink
                WHERE LinkedEntityId = :taskId
                // Title starts with 'Comment on task'
                AND ContentDocument.Title LIKE 'Comment on task%'
                ORDER BY ContentDocument.CreatedDate DESC
            ];

            // Query ContentVersion content separately to avoid governor limits
            Set<Id> docIds = new Set<Id>();
            Map<Id, ContentDocumentLink> linkMap = new Map<Id, ContentDocumentLink>();

            for (ContentDocumentLink link : links) {
                docIds.add(link.ContentDocumentId);
                linkMap.put(link.ContentDocumentId, link);
            }

            // Query document content from ContentVersion
            for (ContentVersion cv : [
                SELECT Id, ContentDocumentId, VersionData
                FROM ContentVersion
                WHERE ContentDocumentId IN :docIds
                AND IsLatest = true
            ]) {
                ContentDocumentLink link = linkMap.get(cv.ContentDocumentId);
                if (link != null) {
                    CommentDetails comment = new CommentDetails();
                    comment.id = cv.ContentDocumentId;
                    comment.text = cv.VersionData.toString();
                    comment.taskId = taskId;
                    comment.createdById = link.ContentDocument.CreatedById;
                    comment.createdByName = link.ContentDocument.CreatedBy.Name;
                    comment.createdByPhotoUrl = link.ContentDocument.CreatedBy.SmallPhotoUrl;
                    comment.createdDate = link.ContentDocument.CreatedDate;
                    comment.mentions = extractMentionsFromText(cv.VersionData.toString());

                    comments.add(comment);
                }
            }

            return comments;
        } catch (Exception e) {
            AuraErrorUtil.throwAuraOrIllegal('Error retrieving task comments: ' + e.getMessage());
            return null; // Unreachable, added for static analysis
        }
    }

    /**
     * @description Search for portal users for @mention tagging
     * @param searchTerm Search term to find users
     * @param communityId Community ID for portal users
     * @return List of User records matching the search term
     */
    @AuraEnabled(cacheable=true)
    public static List<User> searchPortalUsersForTagging(String searchTerm, String communityId) {
        if (String.isBlank(searchTerm)) {
            return new List<User>();
        }

        String searchQuery = '%' + String.escapeSingleQuotes(searchTerm) + '%';

        return [
            SELECT Id, Name, Username, Email, SmallPhotoUrl
            FROM User
            WHERE IsActive = true
            AND (Name LIKE :searchQuery OR Username LIKE :searchQuery)
            AND UserType = 'PowerCustomerSuccess'
            LIMIT 10
        ];
    }

    /**
     * @description Search for internal users for @mention tagging
     * @param searchTerm Search term to find users
     * @return List of User records matching the search term
     */
    @AuraEnabled(cacheable=true)
    public static List<User> searchInternalUsersForTagging(String searchTerm) {
        if (String.isBlank(searchTerm)) {
            return new List<User>();
        }

        String searchQuery = '%' + String.escapeSingleQuotes(searchTerm) + '%';

        return [
            SELECT Id, Name, Username, Email, SmallPhotoUrl
            FROM User
            WHERE IsActive = true
            AND (Name LIKE :searchQuery OR Username LIKE :searchQuery)
            AND UserType = 'Standard'
            LIMIT 10
        ];
    }

    /**
     * @description Update the text of an existing task comment
     * @param commentId Comment ID to update
     * @param newCommentText New text for the comment
     * @return Updated comment details
     */
    public static CommentDetails updateTaskComment(Id commentId, String newCommentText) {
        if (commentId == null || String.isBlank(newCommentText)) {
            AuraErrorUtil.throwAuraOrIllegal('Comment ID and new text are required');
            return null; // Unreachable, added for static analysis
        }

        try {
            // Query the ContentVersion to update
            ContentVersion cv = [
                SELECT Id, ContentDocumentId, Title, CreatedById
                FROM ContentVersion
                WHERE ContentDocumentId = :commentId
                AND IsLatest = true
            ];

            // Check permissions
            if (cv.CreatedById != UserInfo.getUserId()) {
                AuraErrorUtil.throwAuraOrIllegal('You don\'t have permission to update this comment');
                return null; // Unreachable, added for static analysis
            }

            // Create a new version with updated content
            ContentVersion newVersion = new ContentVersion();
            newVersion.ContentDocumentId = cv.ContentDocumentId;
            newVersion.Title = cv.Title;
            newVersion.VersionData = Blob.valueOf(newCommentText);
            newVersion.PathOnClient = 'comment_update_' + System.now().getTime() + '.txt';
            newVersion.IsMajorVersion = true;

            insert newVersion;

            // Query the linked task
            ContentDocumentLink link = [
                SELECT LinkedEntityId
                FROM ContentDocumentLink
                WHERE ContentDocumentId = :commentId
                LIMIT 1
            ];

            // Return comment details
            CommentDetails details = new CommentDetails();
            details.id = cv.ContentDocumentId;
            details.text = newCommentText;
            details.taskId = link.LinkedEntityId;
            details.createdById = UserInfo.getUserId();
            details.createdByName = UserInfo.getName();
            details.createdDate = System.now();
            details.mentions = extractMentionsFromText(newCommentText);

            return details;
        } catch (Exception e) {
            AuraErrorUtil.throwAuraOrIllegal('Error updating task comment: ' + e.getMessage());
            return null; // Unreachable, added for static analysis
        }
    }

    /**
     * @description Delete a task comment
     * @param commentId Comment ID to delete
     */
    public static void deleteTaskComment(Id commentId) {
        if (commentId == null) {
            AuraErrorUtil.throwAuraOrIllegal('Comment ID is required');
        }

        try {
            ContentVersion cv = [
                SELECT Id, ContentDocumentId, CreatedById
                FROM ContentVersion
                WHERE ContentDocumentId = :commentId
                AND IsLatest = true
            ];

            // Check permissions
            if (cv.CreatedById != UserInfo.getUserId()) {
                AuraErrorUtil.throwAuraOrIllegal('You don\'t have permission to delete this comment');
                return; // Unreachable, added for static analysis
            }

            // Delete the entire document (this will cascade delete all versions)
            delete [
                SELECT Id
                FROM ContentDocument
                WHERE Id = :commentId
            ];
        } catch (Exception e) {
            AuraErrorUtil.throwAuraOrIllegal('Error deleting task comment: ' + e.getMessage());
        }
    }

    // Private helper methods

    /**
     * @description Extract @mentions from comment text
     * @param text Comment text to parse for @mentions
     * @return List of UserMention objects
     */
    private static List<UserMention> extractMentionsFromText(String text) {
        // Simplified implementation - in a real scenario, you'd need more sophisticated parsing
        List<UserMention> mentions = new List<UserMention>();

        // In a real implementation, you'd parse the text and extract @mentions
        // This is just a placeholder

        return mentions;
    }

    /**
     * @description Notify users who were mentioned in a comment
     * @param mentions List of UserMention objects
     * @param taskId Task ID the comment is on
     * @param commentText Text of the comment
     */
    private static void notifyMentionedUsers(List<UserMention> mentions, Id taskId, String commentText) {
        // Get task details
        TLG_TASK__c task = [
            SELECT Id, Name
            FROM TLG_TASK__c
            WHERE Id = :taskId
            LIMIT 1
        ];

        Set<Id> userIds = new Set<Id>();
        for (UserMention mention : mentions) {
            userIds.add(mention.userId);
        }

        // In a real implementation, you'd send notifications to users
        // This is just a placeholder
    }
}