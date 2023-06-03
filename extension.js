const { Gio, Meta } = imports.gi;
const ExtensionUtils = imports.misc.extensionUtils;

const WORKSPACE_COUNT_KEY = 'workspace-count';
const WORKSPACE_INDEX = 'workspace-index';
const WALLPAPERS_KEY = 'workspace-wallpapers';
const BACKGROUND_SCHEMA = 'org.gnome.desktop.background';
const CURRENT_WALLPAPER_KEY = 'picture-uri';

let _settings;

function debugLog(s) {
//log(s);
}

function changeWallpaper() {
debugLog("changeWallpaper");
const backgroundSettings = new Gio.Settings({ schema_id: BACKGROUND_SCHEMA });
const paths = _settings.get_strv(WALLPAPERS_KEY);
const index = _settings.get_int(WORKSPACE_INDEX);

debugLog("Walkpaper change from WS " + index);

// Save wallpaper for the previous WS if changed.
const wallpaper = backgroundSettings.get_string(CURRENT_WALLPAPER_KEY);

paths[index] = wallpaper;

// Fill in empty entries up to the current index, otherwise set_strv fails.
for (let i = 0; i < index; i++) {
if (typeof paths[i] === "undefined") {
paths[i] = wallpaper;
}
}
_settings.set_strv(WALLPAPERS_KEY, paths);

// Now get the wallpaper for the current workspace.
const activeWorkspaceIndex = global.workspace_manager.get_active_workspace_index();
debugLog("Walkpaper change to WS " + activeWorkspaceIndex);

let newWallpaper = paths[activeWorkspaceIndex];
if ((typeof newWallpaper === "undefined") || (newWallpaper === "")) {
newWallpaper = paths[0]; // Default
}

// Change wallpaper
debugLog("Walkpaper set wallpaper to " + newWallpaper);
backgroundSettings.set_string(CURRENT_WALLPAPER_KEY, newWallpaper);

changeIndex();
}

function changeIndex() {
const index = global.workspace_manager.get_active_workspace_index();
_settings.set_int(WORKSPACE_INDEX, index);
}

function workspaceNumChanged() {
const workspaceNum = Meta.prefs_get_num_workspaces();
_settings.set_int(WORKSPACE_COUNT_KEY, workspaceNum);
}

function init(metadata) {
log("Walkpaper init");
}

let wSwitchedSignalId;
let wAddedSignalId;
let wRemovedSignalId;

function enable() {
log("Walkpaper enable");

// Initialize globals
_settings = ExtensionUtils.getSettings();

// Initialize settings values
changeIndex();
workspaceNumChanged();

// Connect signals
wSwitchedSignalId = global.workspace_manager.connect('workspace-switched', changeWallpaper);
wAddedSignalId = global.workspace_manager.connect('workspace-added', workspaceNumChanged);
wRemovedSignalId = global.workspace_manager.connect('workspace-removed', workspaceNumChanged);
}

function disable() {
log("Walkpaper disable");

// Dispose of globals
if (_settings) {
_settings.run_dispose();
_settings = null;
}

// Disconnect signals
global.workspace_manager.disconnect(wSwitchedSignalId);
global.workspace_manager.disconnect(wAddedSignalId);
global.workspace_manager.disconnect(wRemovedSignalId);
}
