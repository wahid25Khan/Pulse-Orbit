import { LightningElement, api, track } from "lwc";

/**
 * @description Error Boundary component to catch and handle JavaScript errors
 * Wraps child components and displays friendly error UI when errors occur
 */
export default class ErrorBoundary extends LightningElement {
	@track hasError = false;
	@track errorMessage = "";
	@track errorStack = "";
	@track showDetails = false;

	@api retryCallback; // Optional callback function to retry failed operation
	@api fallbackMessage = "An unexpected error occurred.";

	/**
	 * Error callback - LWC lifecycle hook
	 * Called when an error is thrown from a child component
	 */
	errorCallback(error, stack) {
		this.hasError = true;
		this.errorMessage =
			error?.message || error?.toString() || this.fallbackMessage;
		this.errorStack = stack || "";

		// Log error to console for debugging
		console.error("ErrorBoundary caught error:", {
			error,
			stack,
			message: this.errorMessage,
		});

		// Optionally send to logging service
		this.logErrorToService(error, stack);
	}

	get detailsButtonLabel() {
		return this.showDetails ? "Hide Details" : "Show Details";
	}

	handleRefresh() {
		// Reload the page
		window.location.reload();
	}

	handleToggleDetails() {
		this.showDetails = !this.showDetails;
	}

	handleRetry() {
		if (typeof this.retryCallback === "function") {
			// Reset error state and call retry callback
			this.hasError = false;
			this.errorMessage = "";
			this.errorStack = "";
			this.showDetails = false;

			try {
				this.retryCallback();
			} catch (error) {
				// If retry fails, show error again
				this.errorCallback(error, error.stack);
			}
		}
	}

	/**
	 * Reset error state programmatically
	 */
	@api
	reset() {
		this.hasError = false;
		this.errorMessage = "";
		this.errorStack = "";
		this.showDetails = false;
	}

	/**
	 * Log error to external service (implement as needed)
	 */
	logErrorToService(error, stack) {
		// TODO: Integrate with logging service like Sentry, LogRocket, etc.
		// Example:
		// Sentry.captureException(error, { extra: { stack } });

		// For now, just log to console
		if (window.console && typeof window.console.error === "function") {
			console.error("[ErrorBoundary] Error logged:", {
				message: error?.message,
				stack,
				timestamp: new Date().toISOString(),
			});
		}
	}
}
