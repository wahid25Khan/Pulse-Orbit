import { ShowToastEvent } from "lightning/platformShowToastEvent";
import { LightningElement, api, track } from "lwc";

const STORAGE_KEY = "pulseOrbit_taskTimers";
const TIMER_INTERVAL = 1000; // Update every second

export default class TaskTimer extends LightningElement {
	@api taskId;
	@api taskName;
	@api compact = false; // Compact mode for kanban cards

	@track isRunning = false;
	@track elapsedSeconds = 0;
	@track startTime = null;

	intervalId = null;

	get formattedTime() {
		return this.formatDuration(this.elapsedSeconds);
	}

	get timerClass() {
		return this.compact ? "timer-compact" : "timer-full";
	}

	get playIconName() {
		return this.isRunning ? "utility:pause" : "utility:play";
	}

	get playButtonVariant() {
		return this.isRunning ? "destructive" : "brand";
	}

	get playButtonLabel() {
		return this.isRunning ? "Pause Timer" : "Start Timer";
	}

	get hasElapsedTime() {
		return this.elapsedSeconds > 0;
	}

	get elapsedHours() {
		return (this.elapsedSeconds / 3600).toFixed(2);
	}

	connectedCallback() {
		this.loadTimerState();

		// If timer was running, restart it
		if (this.isRunning && this.startTime) {
			this.startTimer();
		}
	}

	disconnectedCallback() {
		this.stopTimer();
	}

	handlePlayPause() {
		if (this.isRunning) {
			this.pauseTimer();
		} else {
			this.startTimer();
		}
	}

	startTimer() {
		if (!this.taskId) {
			this.showToast("Error", "Cannot start timer without task ID", "error");
			return;
		}

		this.isRunning = true;
		this.startTime = Date.now() - this.elapsedSeconds * 1000;

		this.intervalId = setInterval(() => {
			this.elapsedSeconds = Math.floor((Date.now() - this.startTime) / 1000);
			this.saveTimerState();
		}, TIMER_INTERVAL);

		this.saveTimerState();

		// Dispatch event to parent
		this.dispatchEvent(
			new CustomEvent("timerstart", {
				detail: { taskId: this.taskId },
				bubbles: true,
				composed: true,
			})
		);
	}

	pauseTimer() {
		this.isRunning = false;

		if (this.intervalId) {
			clearInterval(this.intervalId);
			this.intervalId = null;
		}

		this.saveTimerState();

		// Dispatch event to parent
		this.dispatchEvent(
			new CustomEvent("timerpause", {
				detail: {
					taskId: this.taskId,
					elapsedSeconds: this.elapsedSeconds,
					elapsedHours: this.elapsedHours,
				},
				bubbles: true,
				composed: true,
			})
		);
	}

	stopTimer() {
		if (this.intervalId) {
			clearInterval(this.intervalId);
			this.intervalId = null;
		}
	}

	handleReset() {
		this.pauseTimer();
		this.elapsedSeconds = 0;
		this.startTime = null;
		this.saveTimerState();

		// Dispatch event to parent
		this.dispatchEvent(
			new CustomEvent("timerreset", {
				detail: { taskId: this.taskId },
				bubbles: true,
				composed: true,
			})
		);

		this.showToast("Success", "Timer reset", "success");
	}

	handlePreset(event) {
		const minutes = parseInt(event.currentTarget.dataset.minutes, 10);
		if (!minutes || isNaN(minutes)) return;

		// Stop timer if running
		if (this.isRunning) {
			this.pauseTimer();
		}

		// Set preset time
		this.elapsedSeconds = minutes * 60;
		this.startTime = null; // Not running, so no start time
		this.saveTimerState();

		this.showToast("Success", `Timer set to ${minutes} minutes`, "success");
	}

	handleLogTime() {
		if (this.elapsedSeconds === 0) {
			this.showToast("Warning", "No time to log", "warning");
			return;
		}

		// Pause timer before logging
		if (this.isRunning) {
			this.pauseTimer();
		}

		// Dispatch event with time data for parent to handle
		this.dispatchEvent(
			new CustomEvent("logtime", {
				detail: {
					taskId: this.taskId,
					taskName: this.taskName,
					elapsedSeconds: this.elapsedSeconds,
					elapsedHours: this.elapsedHours,
					formattedTime: this.formattedTime,
				},
				bubbles: true,
				composed: true,
			})
		);
	}

	// Public method to clear timer after time is logged
	@api
	clearTimer() {
		this.handleReset();
	}

	// Public method to get current elapsed time
	@api
	getElapsedTime() {
		return {
			seconds: this.elapsedSeconds,
			hours: this.elapsedHours,
			formatted: this.formattedTime,
		};
	}

	formatDuration(totalSeconds) {
		if (totalSeconds === 0) return "0:00:00";

		const hours = Math.floor(totalSeconds / 3600);
		const minutes = Math.floor((totalSeconds % 3600) / 60);
		const seconds = totalSeconds % 60;

		return `${hours}:${String(minutes).padStart(2, "0")}:${String(
			seconds
		).padStart(2, "0")}`;
	}

	loadTimerState() {
		try {
			const timersJson = localStorage.getItem(STORAGE_KEY);
			if (!timersJson) return;

			const timers = JSON.parse(timersJson);
			const timerData = timers[this.taskId];

			if (timerData) {
				this.elapsedSeconds = timerData.elapsedSeconds || 0;
				this.isRunning = timerData.isRunning || false;
				this.startTime = timerData.startTime || null;

				// If timer was running, recalculate elapsed time
				if (this.isRunning && this.startTime) {
					this.elapsedSeconds = Math.floor(
						(Date.now() - this.startTime) / 1000
					);
				}
			}
		} catch (e) {
			console.error("Error loading timer state:", e);
		}
	}

	saveTimerState() {
		try {
			const timersJson = localStorage.getItem(STORAGE_KEY);
			const timers = timersJson ? JSON.parse(timersJson) : {};

			timers[this.taskId] = {
				taskId: this.taskId,
				taskName: this.taskName,
				elapsedSeconds: this.elapsedSeconds,
				isRunning: this.isRunning,
				startTime: this.startTime,
				lastUpdated: Date.now(),
			};

			localStorage.setItem(STORAGE_KEY, JSON.stringify(timers));

			// Clean up old timers (> 7 days)
			this.cleanupOldTimers(timers);
		} catch (e) {
			console.error("Error saving timer state:", e);
		}
	}

	cleanupOldTimers(timers) {
		const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
		let needsCleanup = false;

		Object.keys(timers).forEach((key) => {
			if (timers[key].lastUpdated < sevenDaysAgo && !timers[key].isRunning) {
				delete timers[key];
				needsCleanup = true;
			}
		});

		if (needsCleanup) {
			localStorage.setItem(STORAGE_KEY, JSON.stringify(timers));
		}
	}

	showToast(title, message, variant) {
		this.dispatchEvent(
			new ShowToastEvent({
				title: title,
				message: message,
				variant: variant,
			})
		);
	}
}
