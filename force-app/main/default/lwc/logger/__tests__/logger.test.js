import {
	debug,
	error,
	info,
	isDebugMode,
	logAction,
	performance as logPerformance,
	setDebugMode,
	warn,
} from "c/logger";

describe("c-logger", () => {
	let consoleErrorSpy;
	let consoleWarnSpy;
	let consoleLogSpy;

	beforeEach(() => {
		// Spy on console methods
		consoleErrorSpy = jest.spyOn(console, "error").mockImplementation();
		consoleWarnSpy = jest.spyOn(console, "warn").mockImplementation();
		consoleLogSpy = jest.spyOn(console, "log").mockImplementation();

		// Reset debug mode to default (false)
		setDebugMode(false);
		jest.clearAllMocks();
	});

	afterEach(() => {
		consoleErrorSpy.mockRestore();
		consoleWarnSpy.mockRestore();
		consoleLogSpy.mockRestore();
	});

	describe("error", () => {
		it("should log error with message", () => {
			error("Test error message");
			expect(consoleErrorSpy).toHaveBeenCalledWith(
				"[KANBAN ERROR]",
				"Test error message"
			);
		});

		it("should log error with message and details when debug mode is enabled", () => {
			setDebugMode(true);
			const errorDetails = { code: 500, stack: "Error stack" };
			error("Test error", errorDetails);

			expect(consoleErrorSpy).toHaveBeenCalledWith(
				"[KANBAN ERROR]",
				"Test error",
				errorDetails
			);
		});

		it("should log details even when debug mode is disabled", () => {
			setDebugMode(false);
			const errorDetails = { code: 500, stack: "Error stack" };
			error("Test error", errorDetails);

			// Error details are always logged for errors (critical)
			expect(consoleErrorSpy).toHaveBeenCalledWith(
				"[KANBAN ERROR]",
				"Test error",
				errorDetails
			);
		});

		it("should handle null message", () => {
			error(null);
			expect(consoleErrorSpy).toHaveBeenCalledWith("[KANBAN ERROR]", null);
		});

		it("should handle undefined message", () => {
			error(undefined);
			expect(consoleErrorSpy).toHaveBeenCalledWith("[KANBAN ERROR]", undefined);
		});
	});

	describe("warn", () => {
		it("should not log warning when debug mode is disabled", () => {
			setDebugMode(false);
			warn("Test warning message");
			expect(consoleWarnSpy).not.toHaveBeenCalled();
		});

		it("should log warning with message when debug mode is enabled", () => {
			setDebugMode(true);
			warn("Test warning message");
			expect(consoleWarnSpy).toHaveBeenCalledWith(
				"[KANBAN WARN]",
				"Test warning message"
			);
		});

		it("should log warning with message and details when debug mode is enabled", () => {
			setDebugMode(true);
			const warnDetails = { deprecated: true };
			warn("Test warning", warnDetails);

			expect(consoleWarnSpy).toHaveBeenCalledWith(
				"[KANBAN WARN]",
				"Test warning",
				warnDetails
			);
		});
	});

	describe("debug", () => {
		it("should log debug message when debug mode is enabled", () => {
			setDebugMode(true);
			debug("Debug message", { data: "test" });

			expect(consoleLogSpy).toHaveBeenCalledWith(
				"[KANBAN DEBUG]",
				"Debug message",
				{ data: "test" }
			);
		});

		it("should not log debug message when debug mode is disabled", () => {
			setDebugMode(false);
			debug("Debug message", { data: "test" });

			expect(consoleLogSpy).not.toHaveBeenCalled();
		});

		it("should handle debug message without details", () => {
			setDebugMode(true);
			debug("Debug message");

			// When no data is provided, implementation only logs 2 arguments
			expect(consoleLogSpy).toHaveBeenCalledWith(
				"[KANBAN DEBUG]",
				"Debug message"
			);
		});
	});

	describe("info", () => {
		it("should not log info when debug mode is disabled", () => {
			setDebugMode(false);
			info("Info message");
			expect(consoleLogSpy).not.toHaveBeenCalled();
		});

		it("should log info message when debug mode is enabled", () => {
			setDebugMode(true);
			info("Info message");
			// logger.js uses console.info, not console.log
			const consoleInfoSpy = jest.spyOn(console, "info").mockImplementation();
			info("Info message");
			expect(consoleInfoSpy).toHaveBeenCalledWith(
				"[KANBAN INFO]",
				"Info message"
			);
			consoleInfoSpy.mockRestore();
		});

		it("should log info with details when debug mode is enabled", () => {
			setDebugMode(true);
			const infoDetails = { status: "success" };
			const consoleInfoSpy = jest.spyOn(console, "info").mockImplementation();
			info("Info message", infoDetails);

			expect(consoleInfoSpy).toHaveBeenCalledWith(
				"[KANBAN INFO]",
				"Info message",
				infoDetails
			);
			consoleInfoSpy.mockRestore();
		});
	});

	describe("logAction", () => {
		it("should not log action when debug mode is disabled", () => {
			setDebugMode(false);
			logAction("testAction", { detail: "hidden" });
			expect(consoleLogSpy).not.toHaveBeenCalled();
		});

		it("should log user action when debug mode is enabled", () => {
			setDebugMode(true);
			logAction("buttonClick", { buttonId: "saveBtn" });
			expect(consoleLogSpy).toHaveBeenCalledWith(
				"[KANBAN ACTION]",
				"buttonClick",
				{ buttonId: "saveBtn" }
			);
		});

		it("should handle action without data when debug mode is enabled", () => {
			setDebugMode(true);
			logAction("pageLoad");
			expect(consoleLogSpy).toHaveBeenCalledWith(
				"[KANBAN ACTION]",
				"pageLoad",
				undefined
			);
		});
	});

	describe("performance", () => {
		it("should log performance metric with formatted string", () => {
			setDebugMode(true);
			logPerformance("taskLoad", 250);
			expect(consoleLogSpy).toHaveBeenCalledWith(
				"[KANBAN PERF] taskLoad: 250ms"
			);
		});

		it("should handle zero duration", () => {
			setDebugMode(true);
			logPerformance("instantAction", 0);
			expect(consoleLogSpy).toHaveBeenCalledWith(
				"[KANBAN PERF] instantAction: 0ms"
			);
		});

		it("should handle large durations", () => {
			setDebugMode(true);
			logPerformance("slowOperation", 5000);
			expect(consoleLogSpy).toHaveBeenCalledWith(
				"[KANBAN PERF] slowOperation: 5000ms"
			);
		});

		it("should respect debug mode", () => {
			setDebugMode(false);
			logPerformance("hiddenMetric", 100);

			expect(consoleLogSpy).not.toHaveBeenCalled();
		});

		it("should log when debug mode is enabled", () => {
			setDebugMode(true);
			logPerformance("visibleMetric", 150);

			expect(consoleLogSpy).toHaveBeenCalledWith(
				"[KANBAN PERF] visibleMetric: 150ms"
			);
		});
	});

	describe("setDebugMode", () => {
		it("should enable debug mode", () => {
			setDebugMode(true);
			expect(isDebugMode()).toBe(true);

			debug("Should be visible");
			expect(consoleLogSpy).toHaveBeenCalled();
		});

		it("should disable debug mode", () => {
			setDebugMode(true);
			setDebugMode(false);
			expect(isDebugMode()).toBe(false);

			debug("Should not be visible");
			expect(consoleLogSpy).not.toHaveBeenCalled();
		});

		it("should toggle debug mode multiple times", () => {
			setDebugMode(true);
			expect(isDebugMode()).toBe(true);

			setDebugMode(false);
			expect(isDebugMode()).toBe(false);

			setDebugMode(true);
			expect(isDebugMode()).toBe(true);
		});
	});

	describe("isDebugMode", () => {
		it("should return false by default", () => {
			expect(isDebugMode()).toBe(false);
		});

		it("should return true when debug mode is enabled", () => {
			setDebugMode(true);
			expect(isDebugMode()).toBe(true);
		});

		it("should return false when debug mode is disabled", () => {
			setDebugMode(false);
			expect(isDebugMode()).toBe(false);
		});
	});

	describe("Integration Scenarios", () => {
		it("should handle rapid consecutive logs", () => {
			setDebugMode(true);
			error("Error 1");
			warn("Warning 1");
			debug("Debug 1");

			expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
			expect(consoleWarnSpy).toHaveBeenCalledTimes(1);
			expect(consoleLogSpy).toHaveBeenCalledTimes(1);
		});

		it("should handle mixed logging levels with debug mode changes", () => {
			setDebugMode(false);
			error("Error without debug");
			debug("Should not appear");

			setDebugMode(true);
			error("Error with debug", { details: "shown" });
			debug("Should appear");

			expect(consoleErrorSpy).toHaveBeenCalledTimes(2);
			expect(consoleLogSpy).toHaveBeenCalledTimes(1); // Only the debug call
		});

		it("should handle complex error objects", () => {
			setDebugMode(true);
			const complexError = {
				message: "Complex error",
				code: 500,
				stack: new Error().stack,
				nested: {
					level1: {
						level2: "deep value",
					},
				},
			};
			error("Complex error", complexError);

			expect(consoleErrorSpy).toHaveBeenCalledWith(
				"[KANBAN ERROR]",
				"Complex error",
				complexError
			);
		});
	});
});
