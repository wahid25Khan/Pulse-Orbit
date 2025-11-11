/**
 * Drag and Drop Service for Kanban Board
 * Provides comprehensive drag and drop functionality with visual feedback
 */

export class KanbanDragService {
	/**
	 * Initialize drag and drop for the kanban board
	 * @param {HTMLElement} boardElement - The main kanban board element
	 * @param {Object} callbacks - Callback functions for drag events
	 */
	static initializeDragAndDrop(boardElement, callbacks = {}) {
		if (!boardElement) {
			console.warn("KanbanDragService: Board element not provided");
			return;
		}

		// Store callbacks
		this.callbacks = {
			onDragStart: callbacks.onDragStart || (() => {}),
			onDragOver: callbacks.onDragOver || (() => {}),
			onDrop: callbacks.onDrop || (() => {}),
			onDragEnd: callbacks.onDragEnd || (() => {}),
			onDragLeave: callbacks.onDragLeave || (() => {}),
		};

		// Setup drag and drop event listeners
		this.setupDragListeners(boardElement);

		// Drag and drop initialized
	}

	/**
	 * Setup drag event listeners for cards
	 * @param {HTMLElement} boardElement - The board element
	 */
	static setupDragListeners(boardElement) {
		// Find all draggable cards
		const cards = boardElement.querySelectorAll(
			'.kanban-card[draggable="true"]'
		);

		cards.forEach((card) => {
			card.addEventListener("dragstart", this.handleDragStart.bind(this));
			card.addEventListener("dragend", this.handleDragEnd.bind(this));
		});

		// Find all drop zones (columns)
		const dropZones = boardElement.querySelectorAll(".column-content");

		dropZones.forEach((zone) => {
			zone.addEventListener("dragover", this.handleDragOver.bind(this));
			zone.addEventListener("drop", this.handleDrop.bind(this));
			zone.addEventListener("dragleave", this.handleDragLeave.bind(this));
		});
	}

	/**
	 * Handle drag start event
	 * @param {DragEvent} event - Drag start event
	 */
	static handleDragStart(event) {
		const card = event.currentTarget;
		const cardId = card.dataset.id;

		if (!cardId) {
			console.warn("KanbanDragService: Card missing data-id attribute");
			event.preventDefault();
			return;
		}

		// Set drag data
		event.dataTransfer.setData("text/plain", cardId);
		event.dataTransfer.effectAllowed = "move";

		// Add visual feedback
		card.classList.add("dragging");
		card.style.opacity = "0.5";

		// Create custom drag image
		this.createCustomDragImage(event, card);

		// Call callback
		this.callbacks.onDragStart(event, cardId);

		// Drag started for card
	}

	/**
	 * Handle drag over event
	 * @param {DragEvent} event - Drag over event
	 */
	static handleDragOver(event) {
		event.preventDefault();
		event.dataTransfer.dropEffect = "move";

		const dropZone = event.currentTarget;

		// Add visual feedback for drop zone
		if (!dropZone.classList.contains("drag-over")) {
			dropZone.classList.add("drag-over");
		}

		// Call callback
		this.callbacks.onDragOver(event, dropZone);
	}

	/**
	 * Handle drop event
	 * @param {DragEvent} event - Drop event
	 */
	static handleDrop(event) {
		event.preventDefault();

		const dropZone = event.currentTarget;
		const cardId = event.dataTransfer.getData("text/plain");

		// Remove visual feedback
		dropZone.classList.remove("drag-over");

		if (!cardId) {
			console.warn("KanbanDragService: No card ID in drop data");
			return;
		}

		// Call callback
		this.callbacks.onDrop(event, cardId, dropZone);

		// Card dropped successfully
	}

	/**
	 * Handle drag leave event
	 * @param {DragEvent} event - Drag leave event
	 */
	static handleDragLeave(event) {
		const dropZone = event.currentTarget;

		// Only remove visual feedback if we're actually leaving the drop zone
		if (!dropZone.contains(event.relatedTarget)) {
			dropZone.classList.remove("drag-over");
		}

		// Call callback
		this.callbacks.onDragLeave(event, dropZone);
	}

	/**
	 * Handle drag end event
	 * @param {DragEvent} event - Drag end event
	 */
	static handleDragEnd(event) {
		const card = event.currentTarget;
		const boardElement = card.closest(".kanban-board"); // Find the parent board

		// Remove visual feedback
		card.classList.remove("dragging");
		card.style.opacity = "";

		// Remove drag-over from all drop zones within this board
		if (boardElement) {
			const dropZones = boardElement.querySelectorAll(
				".column-content.drag-over"
			);
			dropZones.forEach((zone) => zone.classList.remove("drag-over"));
		}

		// Call callback
		this.callbacks.onDragEnd(event, card.dataset.id);

		// Drag ended, cleanup complete
	}

	/**
	 * Create custom drag image for better visual feedback
	 * @param {DragEvent} event - Drag event
	 * @param {HTMLElement} card - The card element being dragged
	 */
	static createCustomDragImage(event, card) {
		try {
			// Create a clone of the card for drag image
			const dragImage = card.cloneNode(true);
			dragImage.style.width = card.offsetWidth + "px";
			dragImage.style.height = card.offsetHeight + "px";
			dragImage.style.position = "absolute";
			dragImage.style.top = "-1000px";
			dragImage.style.left = "-1000px";
			dragImage.style.opacity = "0.8";
			dragImage.style.transform = "rotate(5deg)";
			dragImage.style.boxShadow = "0 4px 8px rgba(0,0,0,0.3)";

			// Add to document temporarily
			document.body.appendChild(dragImage);

			// Set as drag image
			event.dataTransfer.setDragImage(
				dragImage,
				card.offsetWidth / 2,
				card.offsetHeight / 2
			);

			// Remove after a short delay
			// eslint-disable-next-line @lwc/lwc/no-async-operation
			setTimeout(() => {
				if (document.body.contains(dragImage)) {
					document.body.removeChild(dragImage);
				}
			}, 100);
		} catch (error) {
			console.warn(
				"KanbanDragService: Could not create custom drag image:",
				error
			);
		}
	}

	/**
	 * Enable drag and drop for new cards (call after adding cards dynamically)
	 * @param {HTMLElement} boardElement - The board element
	 */
	static enableDragForNewCards(boardElement) {
		const newCards = boardElement.querySelectorAll(
			".kanban-card:not([data-drag-enabled])"
		);

		newCards.forEach((card) => {
			card.setAttribute("data-drag-enabled", "true");
			card.addEventListener("dragstart", this.handleDragStart.bind(this));
			card.addEventListener("dragend", this.handleDragEnd.bind(this));
		});
	}

	/**
	 * Disable drag and drop functionality
	 * @param {HTMLElement} boardElement - The board element
	 */
	static disableDragAndDrop(boardElement) {
		const cards = boardElement.querySelectorAll(".kanban-card");
		const dropZones = boardElement.querySelectorAll(".column-content");

		// Remove event listeners from cards
		cards.forEach((card) => {
			card.removeEventListener("dragstart", this.handleDragStart);
			card.removeEventListener("dragend", this.handleDragEnd);
			card.classList.remove("dragging");
			card.style.opacity = "";
		});

		// Remove event listeners from drop zones
		dropZones.forEach((zone) => {
			zone.removeEventListener("dragover", this.handleDragOver);
			zone.removeEventListener("drop", this.handleDrop);
			zone.removeEventListener("dragleave", this.handleDragLeave);
			zone.classList.remove("drag-over");
		});

		// Drag and drop disabled
	}

	/**
	 * Check if drag and drop is supported
	 * @returns {boolean} Whether drag and drop is supported
	 */
	static isSupported() {
		return (
			"draggable" in document.createElement("div") &&
			"ondragstart" in document.createElement("div")
		);
	}

	/**
	 * Get drag and drop status
	 * @returns {Object} Status information
	 */
	static getStatus() {
		return {
			supported: this.isSupported(),
			initialized: !!this.callbacks,
			callbacks: this.callbacks ? Object.keys(this.callbacks) : [],
		};
	}
}

// Legacy function for backward compatibility
export function setupDragAndDrop(boardElement, callbacks) {
	return KanbanDragService.initializeDragAndDrop(boardElement, callbacks);
}
