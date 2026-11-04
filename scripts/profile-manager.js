import { MODULE_ID, createProfile, deleteProfile, getProfiles, moveProfile, renameProfile, switchProfile } from "./profiles.js";

const { ApplicationV2, HandlebarsApplicationMixin, DialogV2 } = foundry.applications.api;

/** The GM's window of all profiles: switch to one, rename, reorder, remove, or add a new empty one. */
export class ProfileManager extends HandlebarsApplicationMixin(ApplicationV2) {
	static DEFAULT_OPTIONS = {
		id: `${MODULE_ID}-manager`,
		classes: ["mist-profiles-manager"],
		window: { title: "MIST_PROFILES.Manager.Title", icon: "fa-solid fa-masks-theater" },
		position: { width: 400, height: "auto" },
		actions: {
			activate: ProfileManager.#onActivate,
			moveUp: ProfileManager.#onMoveUp,
			moveDown: ProfileManager.#onMoveDown,
			remove: ProfileManager.#onRemove,
			create: ProfileManager.#onCreate
		}
	};

	static PARTS = {
		body: { template: `modules/${MODULE_ID}/templates/manager.hbs` }
	};

	static #instance = null;

	static show() {
		ProfileManager.#instance ??= new ProfileManager();
		ProfileManager.#instance.render({ force: true });
		return ProfileManager.#instance;
	}

	static refresh() {
		if (ProfileManager.#instance?.rendered) {
			ProfileManager.#instance.render();
		}
	}

	async _prepareContext(options) {
		const context = await super._prepareContext(options);
		const profiles = getProfiles();
		context.profiles = profiles.map((profile, index) => ({
			...profile,
			first: index === 0,
			last: index === profiles.length - 1
		}));
		return context;
	}

	async _onRender(context, options) {
		await super._onRender(context, options);
		for (const input of this.element.querySelectorAll("input[data-rename]")) {
			input.addEventListener("change", () => renameProfile(input.dataset.rename, input.value));
		}
		const name = this.element.querySelector("input[name=newName]");
		name?.addEventListener("keydown", event => {
			if (event.key === "Enter") {
				event.preventDefault();
				ProfileManager.#create(name);
			}
		});
	}

	static #profileId(target) {
		return target.closest("[data-profile-id]")?.dataset.profileId;
	}

	static #onActivate(event, target) {
		switchProfile(ProfileManager.#profileId(target));
	}

	static #onMoveUp(event, target) {
		moveProfile(ProfileManager.#profileId(target), -1);
	}

	static #onMoveDown(event, target) {
		moveProfile(ProfileManager.#profileId(target), 1);
	}

	static async #onRemove(event, target) {
		const id = ProfileManager.#profileId(target);
		const name = getProfiles().find(profile => profile.id === id)?.name ?? "";
		const confirmed = await DialogV2.confirm({
			window: { title: "MIST_PROFILES.Manager.RemoveTitle" },
			content: `<p>${game.i18n.format("MIST_PROFILES.Manager.RemoveConfirm", { name: foundry.utils.escapeHTML(name) })}</p>`
		});
		if (confirmed) {
			await deleteProfile(id);
		}
	}

	static #onCreate(event, target) {
		ProfileManager.#create(this.element.querySelector("input[name=newName]"));
	}

	static async #create(input) {
		if (await createProfile(input?.value)) {
			input.value = "";
		}
	}
}
