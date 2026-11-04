export const MODULE_ID = "mist-age-game-profiles";

const PROFILES = "profiles";
const ACTIVE = "active";
const STORED = "stored";
const SWITCH_PARTY = "switchParty";

/** The profiles a world starts with. Their ids match the two fixed profiles of version 1.0, so saved values carry over. */
const DEFAULT_PROFILES = ["campaign", "oneshot"];

let switching = false;

function dhKeys() {
	return CONFIG.DH.SETTINGS.gameSettings;
}

function dhGet(key) {
	return game.settings.get(CONFIG.DH.id, key);
}

function dhSet(key, value) {
	return game.settings.set(CONFIG.DH.id, key, value);
}

function refreshUi() {
	ui.resources?.render();
	ui.controls?.render();
	Hooks.callAll(`${MODULE_ID}.changed`);
}

export function registerSettings() {
	// The list of profiles in their order: { [id]: { name } }.
	game.settings.register(MODULE_ID, PROFILES, {
		scope: "world",
		config: false,
		type: Object,
		default: {},
		onChange: refreshUi
	});

	game.settings.register(MODULE_ID, ACTIVE, {
		scope: "world",
		config: false,
		type: String,
		default: DEFAULT_PROFILES[0],
		onChange: refreshUi
	});

	// The saved values of every profile except the active one, whose values live in the system's own settings.
	game.settings.register(MODULE_ID, STORED, {
		scope: "world",
		config: false,
		type: Object,
		default: {}
	});

	game.settings.register(MODULE_ID, SWITCH_PARTY, {
		name: "MIST_PROFILES.Settings.SwitchParty.Name",
		hint: "MIST_PROFILES.Settings.SwitchParty.Hint",
		scope: "world",
		config: true,
		type: Boolean,
		default: true
	});
}

function defaultProfiles() {
	return Object.fromEntries(DEFAULT_PROFILES.map(id => [id, { name: game.i18n.localize(`MIST_PROFILES.Profile.${id}`) }]));
}

/** The profiles as [{ id, name, active }], in their order. A world without a saved list shows the default two. */
export function getProfiles() {
	const saved = game.settings.get(MODULE_ID, PROFILES);
	const profiles = foundry.utils.isEmpty(saved ?? {}) ? defaultProfiles() : saved;
	const active = getActiveProfile(profiles);
	return Object.entries(profiles).map(([id, profile]) => ({ id, name: profile.name, active: id === active }));
}

export function getActiveProfile(profiles = null) {
	profiles ??= Object.fromEntries(getProfiles().map(profile => [profile.id, profile]));
	const active = game.settings.get(MODULE_ID, ACTIVE);
	return active in profiles ? active : Object.keys(profiles)[0];
}

export function getProfileName(id) {
	return getProfiles().find(profile => profile.id === id)?.name ?? "";
}

/** Saves the default list once, so the GM's later edits have something to change. */
export async function ensureProfiles() {
	if (game.user.isGM && foundry.utils.isEmpty(game.settings.get(MODULE_ID, PROFILES) ?? {})) {
		await game.settings.set(MODULE_ID, PROFILES, defaultProfiles());
	}
}

function saveProfiles(profiles) {
	return game.settings.set(MODULE_ID, PROFILES, Object.fromEntries(profiles.map(({ id, name }) => [id, { name }])));
}

/** What the system holds now: the values of the active profile. */
function readCurrent() {
	return {
		fear: dhGet(dhKeys().Resources.Fear) ?? 0,
		countdowns: dhGet(dhKeys().Countdowns)?.toObject() ?? { countdowns: {} },
		party: dhGet(dhKeys().ActiveParty) ?? null
	};
}

/** A profile opened for the first time starts with no Fear, no countdowns and no active party. */
function emptyProfile(current) {
	return {
		fear: 0,
		countdowns: { countdowns: {}, hideNewCountdowns: current.countdowns.hideNewCountdowns ?? false },
		party: null
	};
}

async function applyProfile(data) {
	await dhSet(dhKeys().Resources.Fear, data.fear ?? 0);
	await dhSet(dhKeys().Countdowns, data.countdowns ?? { countdowns: {} });
	if (game.settings.get(MODULE_ID, SWITCH_PARTY)) {
		await dhSet(dhKeys().ActiveParty, data.party ?? null);
		ui.actors?.render();
	}
}

export async function switchProfile(target) {
	const active = getActiveProfile();
	if (!game.user.isGM || switching || target === active || !getProfiles().some(profile => profile.id === target)) {
		return;
	}
	switching = true;
	try {
		await ensureProfiles();
		const current = readCurrent();
		const stored = foundry.utils.deepClone(game.settings.get(MODULE_ID, STORED) ?? {});
		// Save the profile being left before touching the system's settings, so a failed switch loses nothing.
		stored[active] = current;
		await game.settings.set(MODULE_ID, STORED, stored);
		await applyProfile(stored[target] ?? emptyProfile(current));
		await game.settings.set(MODULE_ID, ACTIVE, target);
		ui.notifications.info(game.i18n.format("MIST_PROFILES.Switched", { profile: getProfileName(target) }));
	} catch (error) {
		console.error(`${MODULE_ID} | Profile switch failed`, error);
		ui.notifications.error("MIST_PROFILES.SwitchFailed", { localize: true });
	} finally {
		switching = false;
	}
}

/** Adds an empty profile at the end of the list and returns its id. */
export async function createProfile(name) {
	name = name?.trim();
	if (!game.user.isGM || !name) {
		return null;
	}
	await ensureProfiles();
	const id = foundry.utils.randomID();
	await saveProfiles([...getProfiles(), { id, name }]);
	return id;
}

export async function renameProfile(id, name) {
	name = name?.trim();
	if (!game.user.isGM || !name) {
		return;
	}
	await ensureProfiles();
	await saveProfiles(getProfiles().map(profile => (profile.id === id ? { ...profile, name } : profile)));
}

/** Moves a profile one place up (-1) or down (+1) in the list. */
export async function moveProfile(id, step) {
	if (!game.user.isGM) {
		return;
	}
	await ensureProfiles();
	const profiles = getProfiles();
	const from = profiles.findIndex(profile => profile.id === id);
	const to = from + step;
	if (from < 0 || to < 0 || to >= profiles.length) {
		return;
	}
	[profiles[from], profiles[to]] = [profiles[to], profiles[from]];
	await saveProfiles(profiles);
}

/** Removes a profile and its saved values. The active profile cannot be removed: switch to another one first. */
export async function deleteProfile(id) {
	if (!game.user.isGM || id === getActiveProfile()) {
		return;
	}
	await ensureProfiles();
	await saveProfiles(getProfiles().filter(profile => profile.id !== id));
	const stored = foundry.utils.deepClone(game.settings.get(MODULE_ID, STORED) ?? {});
	delete stored[id];
	await game.settings.set(MODULE_ID, STORED, stored);
}
