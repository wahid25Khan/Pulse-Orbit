export class ShowToastEvent extends CustomEvent {
	constructor(config) {
		super("toast", {
			composed: true,
			cancelable: true,
			bubbles: true,
		});
		this.title = config.title;
		this.message = config.message;
		this.variant = config.variant;
		this.mode = config.mode;
	}
}
