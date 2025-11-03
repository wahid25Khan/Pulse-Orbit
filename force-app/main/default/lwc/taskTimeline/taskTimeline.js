import { LightningElement, wire, track, api } from 'lwc';
import getTasks from '@salesforce/apex/KanbanBoardController.getTasks';

const VIEW_MODES = {
    DAY: 'day',
    WEEK: 'week',
    MONTH: 'month',
    YEAR: 'year'
};

const GROUP_MODES = {
    CATEGORY: 'TLG_Category__c',
    STATUS: 'Status__c',
    TEAM: 'TLG_Team__c',
    ASSIGNEE: 'TLG_Assigned_To__c'
};

const COLORS = ['#0056D2', '#E16022', '#06A59A', '#9040E2', '#F23746', '#FFC857'];

export default class TaskTimeline extends LightningElement {
    @api groupBy = GROUP_MODES.CATEGORY;
    @track lanes = [];
    @track ticks = [];
    @track isEmpty = false;

    @track view = VIEW_MODES.DAY;
    @track selectedDate = new Date();
    @track startHour = 8;
    @track endHour = 21;
    @track groupMode = GROUP_MODES.CATEGORY;

    _tasks = [];
    _colorMap = new Map();
    _colorIndex = 0;

    get viewVariantDay() {
        return this.view === VIEW_MODES.DAY ? 'brand' : 'base';
    }

    get viewVariantWeek() {
        return this.view === VIEW_MODES.WEEK ? 'brand' : 'base';
    }

    get viewVariantMonth() {
        return this.view === VIEW_MODES.MONTH ? 'brand' : 'base';
    }

    get viewVariantYear() {
        return this.view === VIEW_MODES.YEAR ? 'brand' : 'base';
    }

    get groupVariantCategory() {
        return this.groupMode === GROUP_MODES.CATEGORY ? 'brand' : 'base';
    }

    get groupVariantStatus() {
        return this.groupMode === GROUP_MODES.STATUS ? 'brand' : 'base';
    }

    get groupVariantTeam() {
        return this.groupMode === GROUP_MODES.TEAM ? 'brand' : 'base';
    }

    get groupVariantAssignee() {
        return this.groupMode === GROUP_MODES.ASSIGNEE ? 'brand' : 'base';
    }

    get selectedDateISO() {
        const d = new Date(this.selectedDate);
        return d.toISOString().split('T')[0];
    }

    get dateDisplay() {
        const options = { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' };
        const d = new Date(this.selectedDate);
        return d.toLocaleDateString('en-US', options).toUpperCase();
    }

    get startHourDisplay() {
        return `${String(this.startHour).padStart(2, '0')}:00`;
    }

    get endHourDisplay() {
        return `${String(this.endHour).padStart(2, '0')}:00`;
    }

    @wire(getTasks, { filterDate: '$selectedDateISO' })
    wiredTasks({ data, error }) {
        if (data) {
            this._tasks = data || [];
            this._buildTimeline();
        } else if (error) {
            console.error('Error fetching tasks:', error);
            this._tasks = [];
            this._buildTimeline();
        }
    }

    handleDateChange(e) {
        const newDate = new Date(e.target.value);
        this.selectedDate = newDate;
    }

    handleViewDay() {
        this.view = VIEW_MODES.DAY;
        this._buildTimeline();
    }

    handleViewWeek() {
        this.view = VIEW_MODES.WEEK;
        this._buildTimeline();
    }

    handleViewMonth() {
        this.view = VIEW_MODES.MONTH;
        this._buildTimeline();
    }

    handleViewYear() {
        this.view = VIEW_MODES.YEAR;
        this._buildTimeline();
    }

    handleGroupByCategory() {
        this.groupMode = GROUP_MODES.CATEGORY;
        this._buildTimeline();
    }

    handleGroupByStatus() {
        this.groupMode = GROUP_MODES.STATUS;
        this._buildTimeline();
    }

    handleGroupByTeam() {
        this.groupMode = GROUP_MODES.TEAM;
        this._buildTimeline();
    }

    handleGroupByAssignee() {
        this.groupMode = GROUP_MODES.ASSIGNEE;
        this._buildTimeline();
    }

    handleStartHourChange(e) {
        const val = e.target.value.replace(/\D/g, '');
        const hour = Math.min(23, Math.max(0, parseInt(val, 10) || 0));
        this.startHour = hour;
        if (this.startHour >= this.endHour) {
            this.endHour = Math.min(23, this.startHour + 1);
        }
        this._buildTimeline();
    }

    handleEndHourChange(e) {
        const val = e.target.value.replace(/\D/g, '');
        const hour = Math.min(23, Math.max(0, parseInt(val, 10) || 0));
        this.endHour = hour;
        if (this.endHour <= this.startHour) {
            this.startHour = Math.max(0, this.endHour - 1);
        }
        this._buildTimeline();
    }

    _buildTimeline() {
        if (!this._tasks || this._tasks.length === 0) {
            this.isEmpty = true;
            this.lanes = [];
            this.ticks = [];
            return;
        }

        this._colorMap.clear();
        this._colorIndex = 0;

        if (this.view === VIEW_MODES.DAY) {
            this._buildDayView();
        } else if (this.view === VIEW_MODES.WEEK) {
            this._buildWeekView();
        } else if (this.view === VIEW_MODES.MONTH) {
            this._buildMonthView();
        } else if (this.view === VIEW_MODES.YEAR) {
            this._buildYearView();
        }

        this.isEmpty = this.lanes.length === 0;
    }

    _buildDayView() {
        this._buildTicks(1); // 1-hour intervals
        const groupMap = new Map();

        this._tasks.forEach(task => {
            if (!task.TLG_Start_Time__c || !task.TLG_End_Time__c) return;

            const groupKey = task[this.groupMode] || '(Ungrouped)';
            if (!groupMap.has(groupKey)) {
                groupMap.set(groupKey, []);
            }
            groupMap.get(groupKey).push(task);
        });

        this.lanes = Array.from(groupMap).map(([key, tasks]) => ({
            id: key,
            label: key,
            bars: this._buildBars(tasks)
        }));
    }

    _buildWeekView() {
        this._buildTicks(6); // 6-hour intervals for week
        const groupMap = new Map();

        this._tasks.forEach(task => {
            if (!task.TLG_Start_Time__c || !task.TLG_End_Time__c) return;

            const groupKey = task[this.groupMode] || '(Ungrouped)';
            if (!groupMap.has(groupKey)) {
                groupMap.set(groupKey, []);
            }
            groupMap.get(groupKey).push(task);
        });

        this.lanes = Array.from(groupMap).map(([key, tasks]) => ({
            id: key,
            label: key,
            bars: this._buildBars(tasks, true)
        }));
    }

    _buildMonthView() {
        this._buildTicks(24, true); // Day intervals for month
        const groupMap = new Map();

        this._tasks.forEach(task => {
            if (!task.TLG_Start_Time__c || !task.TLG_End_Time__c) return;

            const groupKey = task[this.groupMode] || '(Ungrouped)';
            if (!groupMap.has(groupKey)) {
                groupMap.set(groupKey, []);
            }
            groupMap.get(groupKey).push(task);
        });

        this.lanes = Array.from(groupMap).map(([key, tasks]) => ({
            id: key,
            label: key,
            bars: this._buildBars(tasks, true)
        }));
    }

    _buildYearView() {
        // Year view: monthly bars
        const groupMap = new Map();
        this._buildTicks(12, false, true); // Month-level ticks

        this._tasks.forEach(task => {
            if (!task.TLG_Start_Time__c || !task.TLG_End_Time__c) return;

            const groupKey = task[this.groupMode] || '(Ungrouped)';
            if (!groupMap.has(groupKey)) {
                groupMap.set(groupKey, []);
            }
            groupMap.get(groupKey).push(task);
        });

        this.lanes = Array.from(groupMap).map(([key, tasks]) => ({
            id: key,
            label: key,
            bars: tasks.map((task, idx) => this._buildSingleBar(task, idx, true))
        }));
    }

    _buildTicks(interval = 1, isMonthly = false, isYearly = false) {
        this.ticks = [];

        if (isYearly) {
            const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            for (let i = 0; i < 12; i++) {
                this.ticks.push({
                    key: `tick-${i}`,
                    label: months[i],
                    percent: `${(i / 12) * 100}%`
                });
            }
        } else if (isMonthly) {
            for (let d = 1; d <= 31; d += 5) {
                this.ticks.push({
                    key: `tick-${d}`,
                    label: `${d}`,
                    percent: `${((d - 1) / 30) * 100}%`
                });
            }
        } else {
            for (let h = this.startHour; h <= this.endHour; h += interval) {
                this.ticks.push({
                    key: `tick-${h}`,
                    label: `${String(h).padStart(2, '0')}:00`,
                    percent: `${((h - this.startHour) / (this.endHour - this.startHour)) * 100}%`
                });
            }
        }
    }

    _buildBars(tasks, isExtended = false) {
        return tasks.map((task, idx) => this._buildSingleBar(task, idx, isExtended));
    }

    _buildSingleBar(task, index, isExtended = false) {
        let position, width, startTime, endTime;

        if (isExtended) {
            // For week/month views, all tasks span across the view
            position = index * 15; // Offset each task vertically
            width = 85; // Approximate width for extended views
        } else {
            // For day view, calculate position and width based on time
            startTime = this._parseTime(task.TLG_Start_Time__c);
            endTime = this._parseTime(task.TLG_End_Time__c);

            if (startTime === null || endTime === null) {
                return null;
            }

            const totalMinutes = (this.endHour - this.startHour) * 60;
            const startMinutes = (startTime.hours - this.startHour) * 60 + startTime.minutes;
            const durationMinutes = (endTime.hours - startTime.hours) * 60 + (endTime.minutes - startTime.minutes);

            position = (startMinutes / totalMinutes) * 100;
            width = (durationMinutes / totalMinutes) * 100;

            // Skip tasks outside the visible time range
            if (position + width < 0 || position > 100) {
                return null;
            }

            position = Math.max(0, position);
            width = Math.min(100 - position, width);
        }

        const laneKey = task[this.groupMode] || '(Ungrouped)';
        const colorKey = `${laneKey}`;
        if (!this._colorMap.has(colorKey)) {
            this._colorMap.set(colorKey, COLORS[this._colorIndex % COLORS.length]);
            this._colorIndex++;
        }

        const avatars = this._buildAvatars(task);
        const progressLabel = task.TLG_Progress__c ? `${Math.round(task.TLG_Progress__c)}%` : '';

        return {
            id: task.Id,
            label: task.Name,
            position: `${position}%`,
            width: `${width}%`,
            color: this._colorMap.get(colorKey),
            progressLabel,
            avatars,
            title: `${task.Name} (${task.Status__c || 'No Status'})`
        };
    }

    _buildAvatars(task) {
        const avatars = [];

        // Add assigned user avatar
        if (task.TLG_Assigned_To__r) {
            const user = task.TLG_Assigned_To__r;
            avatars.push({
                key: `avatar-${user.Id}`,
                title: user.Name || 'Assigned User',
                hue: this._generateHue(user.Name || user.Id),
                photoUrl: user.SmallPhotoUrl || null
            });
        }

        // Add team members if available
        if (task.TLG_Team__c) {
            avatars.push({
                key: `avatar-team-${task.TLG_Team__c}`,
                title: task.TLG_Team__r?.Name || 'Team',
                hue: this._generateHue(task.TLG_Team__c),
                photoUrl: null
            });
        }

        return avatars;
    }

    _parseTime(timeString) {
        if (!timeString) return null;

        // Handle both "HH:MM:SS" and "HH:MM" formats
        const parts = timeString.split(':').map(p => parseInt(p, 10));
        if (parts.length < 2 || isNaN(parts[0]) || isNaN(parts[1])) {
            return null;
        }

        return {
            hours: parts[0],
            minutes: parts[1]
        };
    }

    _generateHue(str) {
        if (!str) return 0;
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            hash = ((hash << 5) - hash) + str.charCodeAt(i);
            hash = hash & hash; // Convert to 32-bit integer
        }
        return Math.abs(hash) % 360;
    }
}
