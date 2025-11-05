# Deploy Timer Enhancements Script
# This script provides instructions and helper functions for deploying timer enhancements

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Timer Enhancements Deployment Helper" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "STATUS CHECK:" -ForegroundColor Yellow
Write-Host "✅ taskTimer component: DEPLOYED" -ForegroundColor Green
Write-Host "❌ kanbanBoard component: BLOCKED (TOKEN error in org)" -ForegroundColor Red
Write-Host ""

Write-Host "TOKEN ERROR:" -ForegroundColor Yellow
Write-Host "  Error: Access to TOKEN 'force:base.colorBackgroundAlt2' with access 'INTERNAL'" -ForegroundColor Red
Write-Host "  This is a pre-existing org issue, NOT caused by our timer changes" -ForegroundColor Gray
Write-Host ""

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "DEPLOYMENT OPTIONS:" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "OPTION 1: VS Code Deploy (Recommended)" -ForegroundColor Green
Write-Host "  1. Right-click on: force-app/main/default/lwc/kanbanBoard" -ForegroundColor White
Write-Host "  2. Select: 'SFDX: Deploy Source to Org'" -ForegroundColor White
Write-Host "  3. Sometimes VS Code deployment bypasses CLI validation errors" -ForegroundColor Gray
Write-Host ""

Write-Host "OPTION 2: Manual Developer Console (Most Reliable)" -ForegroundColor Green
Write-Host "  1. Open Developer Console in your org" -ForegroundColor White
Write-Host "  2. File → Open Lightning Resources" -ForegroundColor White
Write-Host "  3. Find 'kanbanBoard' bundle" -ForegroundColor White
Write-Host "  4. Copy/paste the following changes:" -ForegroundColor White
Write-Host ""
Write-Host "     FILE: kanbanBoard.html (after line 899)" -ForegroundColor Cyan
Write-Host '     Add:' -ForegroundColor Yellow
Write-Host '       <!-- Task Timer (Full Display Mode) -->' -ForegroundColor White
Write-Host '       <div class="task-timer-container">' -ForegroundColor White
Write-Host '         <c-task-timer' -ForegroundColor White
Write-Host '           task-id={selectedTaskId}' -ForegroundColor White
Write-Host '           task-name={editTaskData.Name}' -ForegroundColor White
Write-Host '           onlogtime={handleTimerLogTime}>' -ForegroundColor White
Write-Host '         </c-task-timer>' -ForegroundColor White
Write-Host '       </div>' -ForegroundColor White
Write-Host ""
Write-Host "     FILE: kanbanBoard.css (after line 1432)" -ForegroundColor Cyan
Write-Host '     Add:' -ForegroundColor Yellow
Write-Host '       .task-timer-container {' -ForegroundColor White
Write-Host '         padding: 1rem 0;' -ForegroundColor White
Write-Host '         margin-bottom: 1rem;' -ForegroundColor White
Write-Host '         border-bottom: 1px solid var(--color-border);' -ForegroundColor White
Write-Host '       }' -ForegroundColor White
Write-Host ""
Write-Host "     FILE: kanbanBoard.js (after line 946, inside handleLogFieldChange method)" -ForegroundColor Cyan
Write-Host '     Add new method:' -ForegroundColor Yellow
Write-Host '       handleTimerLogTime(event) {' -ForegroundColor White
Write-Host '         const { elapsedHours, formattedTime, taskName } = event.detail;' -ForegroundColor White
Write-Host '         const hours = Math.floor(parseFloat(elapsedHours));' -ForegroundColor White
Write-Host '         const decimalPart = parseFloat(elapsedHours) - hours;' -ForegroundColor White
Write-Host '         const minutes = Math.round(decimalPart * 60);' -ForegroundColor White
Write-Host '         const timeSpent = `${hours}.${String(minutes).padStart(2, "0")}`;' -ForegroundColor White
Write-Host '         this.logTimeData = {' -ForegroundColor White
Write-Host '           ...this.logTimeData,' -ForegroundColor White
Write-Host '           TLG_Time_Spent__c: timeSpent,' -ForegroundColor White
Write-Host '           TLG_Description__c: this.logTimeData.TLG_Description__c || `Work on ${taskName || "task"}`,' -ForegroundColor White
Write-Host '           TLG_Date_Record__c: this.logTimeData.TLG_Date_Record__c || getTodayISO()' -ForegroundColor White
Write-Host '         };' -ForegroundColor White
Write-Host '         this.showTimeLogSection = true;' -ForegroundColor White
Write-Host '         showToast(this, "Success", `Time set to ${timeSpent} hours (${formattedTime})`, "success");' -ForegroundColor White
Write-Host '       }' -ForegroundColor White
Write-Host ""

Write-Host "OPTION 3: Fix TOKEN Error First" -ForegroundColor Green
Write-Host "  Search the org's kanbanBoard.js for 'colorBackgroundAlt2'" -ForegroundColor White
Write-Host "  Replace with a valid design token or custom CSS" -ForegroundColor White
Write-Host "  Then deploy normally" -ForegroundColor White
Write-Host ""

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "VERIFICATION AFTER DEPLOYMENT:" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "1. Open a task detail modal in the Kanban board" -ForegroundColor White
Write-Host "2. Verify timer appears below 'Details' header" -ForegroundColor White
Write-Host "3. Test preset buttons (15min, 30min, 1hr)" -ForegroundColor White
Write-Host "4. Click 'Log Time' button on timer" -ForegroundColor White
Write-Host "5. Verify 'Logged Time' section auto-fills with timer data" -ForegroundColor White
Write-Host ""

Write-Host "Press any key to open the deployment URL in browser..." -ForegroundColor Yellow
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")

# Open deployment URL
Start-Process "https://thelodestonegroup6-dev-ed.develop.lightning.force.com/lightning/setup/SetupOneHome/home"

Write-Host ""
Write-Host "Opening Salesforce Setup..." -ForegroundColor Green
Write-Host "Navigate to: Setup → Custom Code → Lightning Components → kanbanBoard" -ForegroundColor White
