import createConfig from "@salesforce/apex/KanbanConfigController.createConfig";
import createTeamStatus from "@salesforce/apex/KanbanConfigController.createTeamStatus";
import deleteConfigs from "@salesforce/apex/KanbanConfigController.deleteConfigs";
import deleteTeamStatuses from "@salesforce/apex/KanbanConfigController.deleteTeamStatuses";
import getConfigs from "@salesforce/apex/KanbanConfigController.getConfigs";
import getTeamStatuses from "@salesforce/apex/KanbanConfigController.getTeamStatuses";
import upsertConfigs from "@salesforce/apex/KanbanConfigController.upsertConfigs";
import upsertTeamStatuses from "@salesforce/apex/KanbanConfigController.upsertTeamStatuses";
import { ShowToastEvent } from "lightning/platformShowToastEvent";
import { LightningElement, track } from "lwc";

export default class KanbanConfigManager extends LightningElement {
	@track configs = [];
	@track isLoading = false;
	@track statuses = [];

	connectedCallback() {
		this.refresh();
		this.refreshStatuses();
	}

	get hasConfigs() {
		return this.configs && this.configs.length > 0;
	}

	async refresh() {
		this.isLoading = true;
		try {
			const data = await getConfigs();
			this.configs = (data || []).map((c, idx) => ({
				...c,
				key: c.Id || `row-${idx}`,
			}));
		} catch (e) {
			this.toast("Error loading configs", this.errorMessage(e), "error");
		} finally {
			this.isLoading = false;
		}
	}

	handleRefresh = () => this.refresh();
	handleRefreshStatuses = () => this.refreshStatuses();

	handleAddRow() {
		const idx = this.configs.length;
		const newRow = {
			TLG_Status_Name__c: "",
			TLG_Color_Code__c: "#10b981",
			TLG_Display_Order__c: 10,
			TLG_Is_Active__c: true,
			TLG_Max_Expanded_Columns__c: 3,
			TLG_Card_Gradient_Light_Top__c: "#ffffff",
			TLG_Card_Gradient_Light_Bottom__c: "#a0826d",
			TLG_Card_Gradient_Dark_Top__c: "#f5f5dc",
			TLG_Card_Gradient_Dark_Bottom__c: "#3e2723",
			TLG_Collapsed_Color_Start__c: "#1e293b",
			TLG_Collapsed_Color_End__c: "#0f172a",
			key: `new-${Date.now()}-${idx}`,
		};
		this.configs = [...this.configs, newRow];
	}

	handleAddStatusRow() {
		const idx = this.statuses.length;
		const newRow = {
			Name: "",
			TLG_Order_Number__c: 10,
			key: `st-${Date.now()}-${idx}`,
		};
		this.statuses = [...this.statuses, newRow];
	}

	handleInput(evt) {
		const idx = Number(evt.target.dataset.index);
		const field = evt.target.dataset.field;
		const value = evt.target.value;
		const scope = evt.target.dataset.scope || "config";
		this.updateRow(idx, field, value, scope);
	}

	handleNumber(evt) {
		const idx = Number(evt.target.dataset.index);
		const field = evt.target.dataset.field;
		const value = evt.target.value ? Number(evt.target.value) : null;
		const scope = evt.target.dataset.scope || "config";
		this.updateRow(idx, field, value, scope);
	}

	handleCheckbox(evt) {
		const idx = Number(evt.target.dataset.index);
		const field = evt.target.dataset.field;
		const value = evt.target.checked;
		const scope = evt.target.dataset.scope || "config";
		this.updateRow(idx, field, value, scope);
	}

	handleNativeColor(evt) {
		const idx = Number(evt.target.dataset.index);
		const field = evt.target.dataset.field;
		const value = evt.target.value;
		this.updateRow(idx, field, value, "config");
	}

	updateRow(idx, field, value, scope = "config") {
		if (scope === "status") {
			const next = [...this.statuses];
			next[idx] = { ...next[idx], [field]: value };
			this.statuses = next;
		} else {
			const next = [...this.configs];
			next[idx] = { ...next[idx], [field]: value };
			this.configs = next;
		}
	}

	async handleSaveAll() {
		this.isLoading = true;
		try {
			const toInsert = this.configs.filter((c) => !c.Id);
			const toUpdate = this.configs.filter((c) => c.Id);

			let savedCount = 0;
			if (toInsert.length) {
				// Insert one by one to surface unique name violations clearly
				for (const row of toInsert) {
					await createConfig({ config: row });
					savedCount++;
				}
			}
			if (toUpdate.length) {
				await upsertConfigs({ configs: toUpdate });
				savedCount += toUpdate.length;
			}
			this.toast("Saved", `Saved ${savedCount} record(s).`, "success");
			await this.refresh();
		} catch (e) {
			this.toast("Save failed", this.errorMessage(e), "error");
		} finally {
			this.isLoading = false;
		}
	}

	async handleDelete(evt) {
		const idx = Number(evt.currentTarget.dataset.index);
		const scope = evt.currentTarget.dataset.scope || "config";
		const isStatus = scope === "status";
		const list = isStatus ? this.statuses : this.configs;
		const row = list[idx];
		if (!row) return;
		if (!row.Id) {
			// Local new row, just remove
			const next = [...list];
			next.splice(idx, 1);
			if (isStatus) this.statuses = next;
			else this.configs = next;
			return;
		}
		this.isLoading = true;
		try {
			if (isStatus) {
				await deleteTeamStatuses({ ids: [row.Id] });
			} else {
				await deleteConfigs({ ids: [row.Id] });
			}
			this.toast("Deleted", "Record deleted.", "success");
			if (isStatus) await this.refreshStatuses();
			else await this.refresh();
		} catch (e) {
			this.toast("Delete failed", this.errorMessage(e), "error");
		} finally {
			this.isLoading = false;
		}
	}

	toast(title, message, variant) {
		this.dispatchEvent(new ShowToastEvent({ title, message, variant }));
	}

	errorMessage(e) {
		if (e && e.body && e.body.message) return e.body.message;
		if (e && e.message) return e.message;
		try {
			return JSON.stringify(e);
		} catch {
			return "Unknown error";
		}
	}

	async refreshStatuses() {
		this.isLoading = true;
		try {
			const data = await getTeamStatuses();
			this.statuses = (data || []).map((s, idx) => ({
				...s,
				key: s.Id || `strow-${idx}`,
			}));
		} catch (e) {
			this.toast("Error loading statuses", this.errorMessage(e), "error");
		} finally {
			this.isLoading = false;
		}
	}

	async handleSaveStatuses() {
		this.isLoading = true;
		try {
			const toInsert = this.statuses.filter((s) => !s.Id);
			const toUpdate = this.statuses.filter((s) => s.Id);

			let saved = 0;
			if (toInsert.length) {
				for (const row of toInsert) {
					await createTeamStatus({ status: row });
					saved++;
				}
			}
			if (toUpdate.length) {
				await upsertTeamStatuses({ statuses: toUpdate });
				saved += toUpdate.length;
			}
			this.toast("Saved", `Saved ${saved} status record(s).`, "success");
			await this.refreshStatuses();
		} catch (e) {
			this.toast("Save failed", this.errorMessage(e), "error");
		} finally {
			this.isLoading = false;
		}
	}
}
