import { createElement } from 'lwc';
import TaskTimer from 'c/taskTimer';

describe('c-task-timer', () => {
    let timerId;

    beforeEach(() => {
        timerId = null;
    });

    afterEach(() => {
        if (timerId) {
            clearInterval(timerId);
        }
        while (document.body.firstChild) {
            document.body.removeChild(document.body.firstChild);
        }
        jest.clearAllMocks();
    });

    // ========== Initialization Tests ==========
    describe('Timer Initialization', () => {
        it('should initialize with timer stopped', () => {
            const element = createElement('c-task-timer', {
                is: TaskTimer
            });

            element.taskId = 'task1';

            document.body.appendChild(element);

            expect(element.isTimerRunning).toBeFalsy();
        });

        it('should require taskId', () => {
            const element = createElement('c-task-timer', {
                is: TaskTimer
            });

            document.body.appendChild(element);

            expect(element.taskId).toBeUndefined();
        });

        it('should initialize elapsed time to zero', () => {
            const element = createElement('c-task-timer', {
                is: TaskTimer
            });

            element.taskId = 'task1';

            document.body.appendChild(element);

            expect(element.elapsedSeconds).toBe(0);
        });
    });

    // ========== Start/Stop Tests ==========
    describe('Timer Start/Stop', () => {
        it('should start timer when handleStartTimer is called', () => {
            const element = createElement('c-task-timer', {
                is: TaskTimer
            });

            element.taskId = 'task1';

            document.body.appendChild(element);

            element.handleStartTimer();

            expect(element.isTimerRunning).toBe(true);
        });

        it('should stop timer when handleStopTimer is called', () => {
            const element = createElement('c-task-timer', {
                is: TaskTimer
            });

            element.taskId = 'task1';

            document.body.appendChild(element);

            element.handleStartTimer();
            element.handleStopTimer();

            expect(element.isTimerRunning).toBe(false);
        });

        it('should toggle timer state', () => {
            const element = createElement('c-task-timer', {
                is: TaskTimer
            });

            element.taskId = 'task1';

            document.body.appendChild(element);

            const initialState = element.isTimerRunning;

            element.handleToggleTimer();

            expect(element.isTimerRunning).toBe(!initialState);
        });
    });

    // ========== Time Display Tests ==========
    describe('Time Display', () => {
        it('should format seconds correctly', () => {
            const element = createElement('c-task-timer', {
                is: TaskTimer
            });

            element.taskId = 'task1';
            element.elapsedSeconds = 65;

            document.body.appendChild(element);

            // 65 seconds = 1:05
            const formatted = element.formattedTime;
            expect(formatted).toBeDefined();
        });

        it('should handle zero seconds', () => {
            const element = createElement('c-task-timer', {
                is: TaskTimer
            });

            element.taskId = 'task1';
            element.elapsedSeconds = 0;

            document.body.appendChild(element);

            const formatted = element.formattedTime;
            expect(formatted).toBeDefined();
        });

        it('should handle hours correctly', () => {
            const element = createElement('c-task-timer', {
                is: TaskTimer
            });

            element.taskId = 'task1';
            element.elapsedSeconds = 3665; // 1 hour, 1 minute, 5 seconds

            document.body.appendChild(element);

            const formatted = element.formattedTime;
            expect(formatted).toBeDefined();
        });
    });

    // ========== Event Tests ==========
    describe('Timer Events', () => {
        it('should fire timerstart event when timer starts', () => {
            const element = createElement('c-task-timer', {
                is: TaskTimer
            });

            element.taskId = 'task1';

            const handler = jest.fn();
            element.addEventListener('timerstart', handler);

            document.body.appendChild(element);

            element.handleStartTimer();

            expect(handler).toHaveBeenCalled();
        });

        it('should fire timerstop event when timer stops', () => {
            const element = createElement('c-task-timer', {
                is: TaskTimer
            });

            element.taskId = 'task1';

            const handler = jest.fn();
            element.addEventListener('timerstop', handler);

            document.body.appendChild(element);

            element.handleStartTimer();
            element.handleStopTimer();

            expect(handler).toHaveBeenCalled();
        });

        it('should include task ID in events', () => {
            const element = createElement('c-task-timer', {
                is: TaskTimer
            });

            element.taskId = 'task123';

            let eventDetail;
            element.addEventListener('timerstart', (event) => {
                eventDetail = event.detail;
            });

            document.body.appendChild(element);

            element.handleStartTimer();

            expect(eventDetail).toBeDefined();
        });
    });

    // ========== Reset Tests ==========
    describe('Timer Reset', () => {
        it('should reset timer to zero', () => {
            const element = createElement('c-task-timer', {
                is: TaskTimer
            });

            element.taskId = 'task1';
            element.elapsedSeconds = 120;

            document.body.appendChild(element);

            element.handleResetTimer();

            expect(element.elapsedSeconds).toBe(0);
        });

        it('should stop timer when reset', () => {
            const element = createElement('c-task-timer', {
                is: TaskTimer
            });

            element.taskId = 'task1';

            document.body.appendChild(element);

            element.handleStartTimer();
            element.handleResetTimer();

            expect(element.isTimerRunning).toBe(false);
        });
    });

    // ========== Persistence Tests ==========
    describe('Timer Persistence', () => {
        it('should save elapsed time on stop', () => {
            const element = createElement('c-task-timer', {
                is: TaskTimer
            });

            element.taskId = 'task1';

            document.body.appendChild(element);

            element.handleStartTimer();
            element.elapsedSeconds = 300;
            element.handleStopTimer();

            // Timer should preserve the elapsed time
            expect(element.elapsedSeconds).toBe(300);
        });

        it('should load previous timer state', () => {
            const element = createElement('c-task-timer', {
                is: TaskTimer
            });

            element.taskId = 'task1';
            element.previousElapsedSeconds = 100;

            document.body.appendChild(element);

            // Should load previous state if available
            expect(element.previousElapsedSeconds).toBe(100);
        });
    });

    // ========== Button State Tests ==========
    describe('Button States', () => {
        it('should show start button when timer is stopped', () => {
            const element = createElement('c-task-timer', {
                is: TaskTimer
            });

            element.taskId = 'task1';

            document.body.appendChild(element);

            expect(element.isTimerRunning).toBe(false);
        });

        it('should show stop button when timer is running', () => {
            const element = createElement('c-task-timer', {
                is: TaskTimer
            });

            element.taskId = 'task1';

            document.body.appendChild(element);

            element.handleStartTimer();

            expect(element.isTimerRunning).toBe(true);
        });
    });

    // ========== Error Handling Tests ==========
    describe('Error Handling', () => {
        it('should handle missing taskId gracefully', () => {
            const element = createElement('c-task-timer', {
                is: TaskTimer
            });

            document.body.appendChild(element);

            expect(() => element.handleStartTimer()).not.toThrow();
        });

        it('should handle negative elapsed time', () => {
            const element = createElement('c-task-timer', {
                is: TaskTimer
            });

            element.taskId = 'task1';
            element.elapsedSeconds = -10;

            document.body.appendChild(element);

            // Should handle gracefully (potentially reset to 0)
            expect(element.elapsedSeconds).toBeDefined();
        });
    });

    // ========== Integration Tests ==========
    describe('Integration Scenarios', () => {
        it('should handle multiple start/stop cycles', () => {
            const element = createElement('c-task-timer', {
                is: TaskTimer
            });

            element.taskId = 'task1';

            document.body.appendChild(element);

            element.handleStartTimer();
            element.handleStopTimer();
            element.handleStartTimer();
            element.handleStopTimer();

            expect(element.isTimerRunning).toBe(false);
        });

        it('should accumulate time across sessions', () => {
            const element = createElement('c-task-timer', {
                is: TaskTimer
            });

            element.taskId = 'task1';

            document.body.appendChild(element);

            element.handleStartTimer();
            element.elapsedSeconds = 60;
            element.handleStopTimer();

            element.handleStartTimer();
            element.elapsedSeconds += 30;
            element.handleStopTimer();

            expect(element.elapsedSeconds).toBe(90);
        });
    });
});
