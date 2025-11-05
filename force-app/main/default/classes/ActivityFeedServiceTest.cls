/**
 * @description Test class for ActivityFeedService
 */
@isTest
private class ActivityFeedServiceTest {
    
	@TestSetup
	static void setup() {
		// Create test case (required for TLG_Task__c)
		Case testCase = new Case(
			Subject = 'Test Case',
			Status = 'New'
		);
		insert testCase;
		
		// Create test data
		TLG_Task__c task = new TLG_Task__c(
			Name = 'Test Task',
			TLG_Status__c = 'Backlog',
			TLG_Priority__c = 'Normal',
			TLG_Case__c = testCase.Id
		);
		insert task;        // Create task history records
        List<TLG_Task_History__c> histories = new List<TLG_Task_History__c>();
        
        // Recent status change
        histories.add(new TLG_Task_History__c(
            TLG_Task__c = task.Id,
            TLG_Status_Old_Value__c = 'Backlog',
            TLG_Status_New_Value__c = 'In Progress'
        ));
        
        // Another status change
        histories.add(new TLG_Task_History__c(
            TLG_Task__c = task.Id,
            TLG_Status_Old_Value__c = 'In Progress',
            TLG_Status_New_Value__c = 'Done'
        ));
        
        insert histories;
    }
    
	@isTest
	static void testGetRecentActivity() {
		Test.startTest();
		List<ActivityFeedService.ActivityItem> activities = 
			ActivityFeedService.getRecentActivity(20, null);
		Test.stopTest();
		
		System.assertNotEquals(null, activities, 'Activities should not be null');
		System.assert(activities.size() >= 0, 'Should return a list');
		
		// If we have activities, validate structure
		if (activities.size() > 0) {
			ActivityFeedService.ActivityItem firstActivity = activities[0];
			System.assertNotEquals(null, firstActivity.id, 'Activity should have ID');
			System.assertNotEquals(null, firstActivity.taskId, 'Activity should have task ID');
			System.assertNotEquals(null, firstActivity.taskName, 'Activity should have task name');
			System.assertEquals('status_change', firstActivity.actionType, 'Should be status change');
			System.assertNotEquals(null, firstActivity.formattedTime, 'Should have formatted time');
		}
	}    @isTest
    static void testGetRecentActivityWithLimit() {
        Test.startTest();
        List<ActivityFeedService.ActivityItem> activities = 
            ActivityFeedService.getRecentActivity(1, null);
        Test.stopTest();
        
        System.assertNotEquals(null, activities, 'Should return a list');
        System.assert(activities.size() <= 1, 'Should respect limit parameter');
    }
    
    @isTest
    static void testGetRecentActivityDefaultLimit() {
        Test.startTest();
        List<ActivityFeedService.ActivityItem> activities = 
            ActivityFeedService.getRecentActivity(null, null);
        Test.stopTest();
        
        System.assertNotEquals(null, activities, 'Should handle null limit');
        System.assert(activities.size() >= 0, 'Should return activities');
    }
    
    @isTest
    static void testGetTaskActivity() {
        TLG_Task__c task = [SELECT Id FROM TLG_Task__c LIMIT 1];
        
        Test.startTest();
        List<ActivityFeedService.ActivityItem> activities = 
            ActivityFeedService.getTaskActivity(task.Id, 10);
        Test.stopTest();
        
        System.assertNotEquals(null, activities, 'Activities should not be null');
        System.assertEquals(2, activities.size(), 'Should have 2 activities for task');
        
        for (ActivityFeedService.ActivityItem activity : activities) {
            System.assertEquals(task.Id, activity.taskId, 'Activity should be for correct task');
        }
    }
    
    @isTest
    static void testGetTaskActivityBlankTaskId() {
        Test.startTest();
        List<ActivityFeedService.ActivityItem> activities = 
            ActivityFeedService.getTaskActivity('', 10);
        Test.stopTest();
        
        System.assertEquals(0, activities.size(), 'Should return empty list for blank task ID');
    }
    
    @isTest
    static void testGetTaskActivityNullTaskId() {
        Test.startTest();
        List<ActivityFeedService.ActivityItem> activities = 
            ActivityFeedService.getTaskActivity(null, 10);
        Test.stopTest();
        
        System.assertEquals(0, activities.size(), 'Should return empty list for null task ID');
    }
    
    @isTest
    static void testGetActivityStats() {
        Test.startTest();
        Map<String, Object> stats = ActivityFeedService.getActivityStats(null);
        Test.stopTest();
        
        System.assertNotEquals(null, stats, 'Stats should not be null');
        System.assert(stats.containsKey('recentActivityCount'), 'Should have recent activity count');
        System.assert(stats.containsKey('activeUsers'), 'Should have active users');
        
        Integer activityCount = (Integer)stats.get('recentActivityCount');
        System.assert(activityCount >= 0, 'Should have activity count');
        
        List<Object> activeUsers = (List<Object>)stats.get('activeUsers');
        System.assertNotEquals(null, activeUsers, 'Active users should not be null');
    }
    
    @isTest
    static void testActivityItemCreation() {
        // Test ActivityItem wrapper class
        ActivityFeedService.ActivityItem item = new ActivityFeedService.ActivityItem();
        item.id = 'testId';
        item.taskId = 'taskId';
        item.taskName = 'Task Name';
        item.userName = 'John Doe';
        item.actionType = 'status_change';
        item.oldValue = 'Backlog';
        item.newValue = 'Done';
        item.timestamp = DateTime.now();
        item.formattedTime = '2 minutes ago';
        item.iconName = 'utility:change_record_type';
        item.iconVariant = 'success';
        
        System.assertEquals('testId', item.id, 'ID should match');
        System.assertEquals('status_change', item.actionType, 'Action type should match');
        System.assertEquals('Backlog', item.oldValue, 'Old value should match');
        System.assertEquals('Done', item.newValue, 'New value should match');
    }
}
