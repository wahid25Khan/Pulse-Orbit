/**
 * @description Service class for handling project-related operations.
 * Provides methods for retrieving and managing Opportunity records as projects.
 */
public with sharing class ProjectService {

    /**
     * @description Get high priority projects (Opportunities)
     * @return List of high priority Opportunity records
     */
    public static List<Opportunity> getHighPriorityProjects() {
        return [
            SELECT Id, Name, StageName, CloseDate, Amount, AccountId, Account.Name,
                   Description, Probability, ExpectedRevenue
            FROM Opportunity
            WHERE IsClosed = false
            AND Probability >= 50
            ORDER BY CloseDate ASC
            LIMIT 10
        ];
    }

    /**
     * @description Search for Opportunities by name, description, or account
     * @param searchTerm The search term to use
     * @return List of matching Opportunity records
     */
    public static List<Opportunity> searchOpportunities(String searchTerm) {
        String searchQuery = '%' + String.escapeSingleQuotes(searchTerm) + '%';

        return [
            SELECT Id, Name, StageName, CloseDate, Amount, AccountId, Account.Name,
                   Description, Probability, ExpectedRevenue
            FROM Opportunity
            WHERE Name LIKE :searchQuery
               OR Account.Name LIKE :searchQuery
            ORDER BY Name ASC
            LIMIT 100
        ];
    }

    /**
     * @description Get all active projects (Opportunities)
     * @return List of open Opportunity records
     */
    public static List<Opportunity> getProjects() {
        return [
            SELECT Id, Name, StageName, CloseDate, Amount, AccountId, Account.Name,
                   Description, Probability, ExpectedRevenue
            FROM Opportunity
            WHERE IsClosed = false
            ORDER BY Name ASC
            LIMIT 100
        ];
    }

    /**
     * @description Get all users who can be assigned to tasks
     * @return List of active User records
     */
    public static List<User> getAssignableUsers() {
        return [
            SELECT Id, Name, Username, Email, SmallPhotoUrl
            FROM User
            WHERE IsActive = true
            ORDER BY Name ASC
            LIMIT 100
        ];
    }
}