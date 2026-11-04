import { MODULE_ID, ensureProfiles, getActiveProfile, getProfileName, getProfiles, registerSettings, switchProfile } from "./profiles.js";
import { ProfileManager } from "./profile-manager.js";

/**
 * The profile switch at the top of the Fear tracker: a list of the profiles and a button to the profile window.
 * Players see only the name of the active profile.
 */
function addFearTrackerSwitch(app, html) {
	const tracker = html.querySelector("#resource-fear");
	if (!tracker) {
		return;
	}
	const bar = document.createElement("div");
	bar.classList.add("mist-profiles-switch");
	if (game.user.isGM) {
		const select = document.createElement("select");
		for (const profile of getProfiles()) {
			select.append(new Option(profile.name, profile.id, profile.active, profile.active));
		}
		select.addEventListener("change", () => switchProfile(select.value));
		const manage = document.createElement("a");
		manage.innerHTML = '<i class="fa-solid fa-gear" inert></i>';
		manage.dataset.tooltip = game.i18n.localize("MIST_PROFILES.Manager.Title");
		manage.addEventListener("click", event => {
			event.preventDefault();
			event.stopPropagation();
			ProfileManager.show();
		});
		bar.append(select, manage);
	} else {
		const label = document.createElement("span");
		label.textContent = getProfileName(getActiveProfile());
		bar.append(label);
	}
	tracker.prepend(bar);
}

/** A button in the token controls to the profile window, for when the Fear tracker is hidden. */
function addControlsButton(controls) {
	const tokens = controls.tokens;
	if (!tokens || !game.user.isGM) {
		return;
	}
	tokens.tools[`${MODULE_ID}-manager`] = {
		name: `${MODULE_ID}-manager`,
		title: game.i18n.format("MIST_PROFILES.Controls.Title", { profile: getProfileName(getActiveProfile()) }),
		icon: "fa-solid fa-masks-theater",
		order: Object.keys(tokens.tools).length,
		button: true,
		onChange: () => ProfileManager.show()
	};
}

Hooks.once("init", () => {
	registerSettings();
});

Hooks.once("ready", () => {
	ensureProfiles();
});

Hooks.on("renderFearTracker", addFearTrackerSwitch);
Hooks.on("getSceneControlButtons", addControlsButton);
Hooks.on(`${MODULE_ID}.changed`, () => ProfileManager.refresh());
