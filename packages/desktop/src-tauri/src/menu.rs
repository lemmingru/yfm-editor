use std::sync::Mutex;

use serde::Deserialize;
use tauri::menu::{
    CheckMenuItemBuilder, MenuBuilder, MenuItemBuilder, SubmenuBuilder, WINDOW_SUBMENU_ID,
};
use tauri::State;

use crate::state::AppState;

#[derive(Clone, Deserialize)]
pub(crate) struct RecentFileMenuItem {
    label: String,
}

#[derive(Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct MenuLabels {
    preferences: String,
    quit: String,
    file: String,
    new: String,
    open: String,
    open_recent: String,
    no_recent_files: String,
    clear_menu: String,
    save: String,
    save_as: String,
    revert: String,
    edit: String,
    undo: String,
    redo: String,
    cut: String,
    copy: String,
    copy_agent_context: String,
    paste: String,
    select_all: String,
    window: String,
    minimize: String,
    zoom: String,
    bring_all_to_front: String,
    view: String,
    toggle_theme: String,
    spell_check: String,
}

impl Default for MenuLabels {
    fn default() -> Self {
        Self {
            preferences: "Preferences…".into(),
            quit: "Quit YFM Editor".into(),
            file: "File".into(),
            new: "New".into(),
            open: "Open…".into(),
            open_recent: "Open Recent".into(),
            no_recent_files: "No Recent Files".into(),
            clear_menu: "Clear Menu".into(),
            save: "Save".into(),
            save_as: "Save As…".into(),
            revert: "Revert to Saved".into(),
            edit: "Edit".into(),
            undo: "Undo".into(),
            redo: "Redo".into(),
            cut: "Cut".into(),
            copy: "Copy".into(),
            copy_agent_context: "Copy Agent Context".into(),
            paste: "Paste".into(),
            select_all: "Select All".into(),
            window: "Window".into(),
            minimize: "Minimize".into(),
            zoom: "Zoom".into(),
            bring_all_to_front: "Bring All to Front".into(),
            view: "View".into(),
            toggle_theme: "Toggle Theme".into(),
            spell_check: "Check Spelling".into(),
        }
    }
}

pub(crate) struct MenuState {
    recent_files: Mutex<Vec<RecentFileMenuItem>>,
    labels: Mutex<MenuLabels>,
    spellcheck_enabled: Mutex<bool>,
}

impl Default for MenuState {
    fn default() -> Self {
        Self {
            recent_files: Mutex::new(Vec::new()),
            labels: Mutex::new(MenuLabels::default()),
            // Mirrors the frontend preference default (spellcheck on).
            spellcheck_enabled: Mutex::new(true),
        }
    }
}

#[tauri::command]
pub(crate) fn update_recent_files_menu(
    app: tauri::AppHandle,
    state: State<AppState>,
    items: Vec<RecentFileMenuItem>,
) -> Result<(), String> {
    *state.menu.recent_files.lock().unwrap() = items;
    rebuild_app_menu(&app, &state)
}

#[tauri::command]
pub(crate) fn set_menu_labels(
    app: tauri::AppHandle,
    state: State<AppState>,
    labels: MenuLabels,
) -> Result<(), String> {
    *state.menu.labels.lock().unwrap() = labels;
    rebuild_app_menu(&app, &state)
}

#[tauri::command]
pub(crate) fn set_spellcheck_checked(
    app: tauri::AppHandle,
    state: State<AppState>,
    enabled: bool,
) -> Result<(), String> {
    *state.menu.spellcheck_enabled.lock().unwrap() = enabled;
    rebuild_app_menu(&app, &state)
}

fn rebuild_app_menu(app: &tauri::AppHandle, state: &State<AppState>) -> Result<(), String> {
    let recent_files = state.menu.recent_files.lock().unwrap().clone();
    let labels = state.menu.labels.lock().unwrap().clone();
    let spellcheck_enabled = *state.menu.spellcheck_enabled.lock().unwrap();
    let menu = build_app_menu(app, &recent_files, &labels, spellcheck_enabled)
        .map_err(|e| e.to_string())?;
    app.set_menu(menu).map(|_| ()).map_err(|e| e.to_string())
}

fn build_recent_files_menu(
    app: &tauri::AppHandle,
    recent_files: &[RecentFileMenuItem],
    labels: &MenuLabels,
) -> tauri::Result<tauri::menu::Submenu<tauri::Wry>> {
    let mut recent = SubmenuBuilder::new(app, &labels.open_recent);
    if recent_files.is_empty() {
        let empty = MenuItemBuilder::with_id("recent-empty", &labels.no_recent_files)
            .enabled(false)
            .build(app)?;
        recent = recent.item(&empty);
    } else {
        for (index, item) in recent_files.iter().enumerate() {
            recent = recent.text(
                format!("recent-file-{index}"),
                escape_menu_text(&item.label),
            );
        }
        recent = recent.separator().text("recent-clear", &labels.clear_menu);
    }
    recent.build()
}

fn escape_menu_text(text: &str) -> String {
    text.replace('&', "&&")
}

pub(crate) fn build_app_menu(
    app: &tauri::AppHandle,
    recent_files: &[RecentFileMenuItem],
    labels: &MenuLabels,
    spellcheck_enabled: bool,
) -> tauri::Result<tauri::menu::Menu<tauri::Wry>> {
    let preferences = MenuItemBuilder::with_id("preferences", &labels.preferences)
        .accelerator("CmdOrCtrl+,")
        .build(app)?;
    // Route quit through the frontend so the unsaved-changes guard can cancel it.
    let quit = MenuItemBuilder::with_id("quit", &labels.quit)
        .accelerator("CmdOrCtrl+Q")
        .build(app)?;
    let app_menu = SubmenuBuilder::new(app, "YFM Editor")
        .about(None)
        .separator()
        .item(&preferences)
        .separator()
        .services()
        .separator()
        .hide()
        .hide_others()
        .show_all()
        .separator()
        .item(&quit)
        .build()?;

    let new = MenuItemBuilder::with_id("new", &labels.new)
        .accelerator("CmdOrCtrl+N")
        .build(app)?;
    let open = MenuItemBuilder::with_id("open", &labels.open)
        .accelerator("CmdOrCtrl+O")
        .build(app)?;
    let recent = build_recent_files_menu(app, recent_files, labels)?;
    let save = MenuItemBuilder::with_id("save", &labels.save)
        .accelerator("CmdOrCtrl+S")
        .build(app)?;
    let save_as = MenuItemBuilder::with_id("save-as", &labels.save_as)
        .accelerator("CmdOrCtrl+Shift+S")
        .build(app)?;
    let revert = MenuItemBuilder::with_id("revert", &labels.revert).build(app)?;
    let file_menu = SubmenuBuilder::new(app, &labels.file)
        .item(&new)
        .item(&open)
        .item(&recent)
        .separator()
        .item(&save)
        .item(&save_as)
        .item(&revert)
        .separator()
        .close_window()
        .build()?;

    let copy_agent_context =
        MenuItemBuilder::with_id("copy-agent-context", &labels.copy_agent_context)
            .accelerator("CmdOrCtrl+Alt+C")
            .build(app)?;
    let edit_menu = SubmenuBuilder::new(app, &labels.edit)
        .undo_with_text(&labels.undo)
        .redo_with_text(&labels.redo)
        .separator()
        .cut_with_text(&labels.cut)
        .copy_with_text(&labels.copy)
        .item(&copy_agent_context)
        .paste_with_text(&labels.paste)
        .select_all_with_text(&labels.select_all)
        .build()?;

    let window_menu = SubmenuBuilder::with_id(app, WINDOW_SUBMENU_ID, &labels.window)
        .minimize_with_text(&labels.minimize)
        .maximize_with_text(&labels.zoom)
        .separator()
        .bring_all_to_front_with_text(&labels.bring_all_to_front)
        .build()?;
    let toggle_theme = MenuItemBuilder::with_id("toggle-theme", &labels.toggle_theme)
        .accelerator("CmdOrCtrl+Shift+L")
        .build(app)?;
    let spell_check = CheckMenuItemBuilder::with_id("toggle-spellcheck", &labels.spell_check)
        .checked(spellcheck_enabled)
        .build(app)?;
    let view_menu = SubmenuBuilder::new(app, &labels.view)
        .item(&toggle_theme)
        .separator()
        .item(&spell_check)
        .build()?;

    MenuBuilder::new(app)
        .items(&[&app_menu, &file_menu, &edit_menu, &window_menu, &view_menu])
        .build()
}

#[cfg(test)]
mod tests {
    use super::escape_menu_text;

    #[test]
    fn escapes_native_menu_mnemonic_markers() {
        assert_eq!(
            escape_menu_text("Research & Development"),
            "Research && Development"
        );
        assert_eq!(
            escape_menu_text("Already && escaped"),
            "Already &&&& escaped"
        );
        assert_eq!(escape_menu_text("Plain"), "Plain");
    }
}
