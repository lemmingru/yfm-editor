use std::collections::{hash_map::DefaultHasher, HashMap, HashSet};
use std::hash::{Hash, Hasher};
use std::path::Path;
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::{Arc, Mutex};
use std::time::Duration;

use notify_debouncer_full::notify::{RecommendedWatcher, RecursiveMode};
use notify_debouncer_full::{new_debouncer, Debouncer, DebounceEventResult, RecommendedCache};
use serde::{Deserialize, Serialize};
use tauri::menu::{MenuBuilder, MenuItemBuilder, SubmenuBuilder, WINDOW_SUBMENU_ID};
use tauri::{Emitter, Manager, State, WebviewUrl, WebviewWindowBuilder};

/// Debounced filesystem watcher handle kept alive for the lifetime of a watched
/// document. Dropping it signals the internal thread to stop.
type WatcherHandle = Debouncer<RecommendedWatcher, RecommendedCache>;

/// Per-window watch state: the path being watched and a content hash baseline
/// shared with the watcher callback. The baseline lets us ignore our own writes
/// (we refresh it in `write_file`) and detect genuine external changes.
struct WatchState {
    path: String,
    baseline: Arc<Mutex<u64>>,
    _debouncer: WatcherHandle,
}

fn content_hash(content: &str) -> u64 {
    let mut hasher = DefaultHasher::new();
    content.hash(&mut hasher);
    hasher.finish()
}

/// Tracks files requested via the OS (Finder "open with", `open file.md`) so the
/// frontend can pick them up. On a cold start the request arrives before the
/// webview has any listeners, so we buffer it and hand it over once the frontend
/// reports ready via `frontend_ready`. Warm opens are emitted directly.
struct AppState {
    ready: Mutex<HashSet<String>>,
    pending: Mutex<HashMap<String, Vec<String>>>,
    recent_files: Mutex<Vec<RecentFileMenuItem>>,
    menu_labels: Mutex<MenuLabels>,
    window_counter: AtomicUsize,
    quitting: Mutex<bool>,
    focused_label: Mutex<Option<String>>,
    watchers: Mutex<HashMap<String, WatchState>>,
}

impl Default for AppState {
    fn default() -> Self {
        Self {
            ready: Mutex::default(),
            pending: Mutex::default(),
            recent_files: Mutex::default(),
            menu_labels: Mutex::default(),
            window_counter: AtomicUsize::new(0),
            quitting: Mutex::default(),
            focused_label: Mutex::default(),
            watchers: Mutex::default(),
        }
    }
}

#[derive(Serialize)]
struct FileData {
    path: String,
    content: String,
}

#[derive(Clone, Deserialize)]
struct RecentFileMenuItem {
    label: String,
}

#[derive(Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
struct MenuLabels {
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
        }
    }
}

#[tauri::command]
fn read_file(path: String) -> Result<FileData, String> {
    let content = std::fs::read_to_string(&path).map_err(|e| e.to_string())?;
    Ok(FileData { path, content })
}

#[tauri::command]
fn write_file(
    window: tauri::WebviewWindow,
    state: State<AppState>,
    path: String,
    content: String,
) -> Result<(), String> {
    // Hash before the move so we can refresh the watcher baseline after writing.
    let new_hash = content_hash(&content);
    if let Some(parent) = Path::new(&path).parent() {
        std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    std::fs::write(&path, content).map_err(|e| e.to_string())?;

    // Suppress the watcher's own change event: refresh the baseline so the
    // debounced callback sees no difference and stays quiet. The debounce
    // delay guarantees this runs before the callback re-reads the file.
    let label = window.label().to_string();
    if let Some(watch) = state.watchers.lock().unwrap().get(&label) {
        if watch.path == path {
            *watch.baseline.lock().unwrap() = new_hash;
        }
    }
    Ok(())
}

/// Watch a file for external changes and emit `file-changed-on-disk` to the
/// calling window when its content diverges from the baseline. Watches the
/// parent directory (non-recursive) so atomic saves via temp + rename don't
/// break tracking. Replaces any previous watch for this window.
#[tauri::command]
fn watch_file(
    app: tauri::AppHandle,
    window: tauri::WebviewWindow,
    state: State<AppState>,
    path: String,
) -> Result<(), String> {
    let label = window.label().to_string();

    let baseline = match std::fs::read_to_string(&path) {
        Ok(content) => Arc::new(Mutex::new(content_hash(&content))),
        Err(e) => return Err(e.to_string()),
    };

    let baseline_cb = baseline.clone();
    let path_cb = path.clone();
    let label_cb = label.clone();
    let app_cb = app.clone();
    let target = Path::new(&path_cb).to_path_buf();

    let mut debouncer = new_debouncer(Duration::from_millis(300), None, move |res: DebounceEventResult| {
        let events = match res {
            Ok(events) => events,
            Err(_) => return,
        };
        // Only react to events touching our file (we watch the whole parent dir).
        if !events.iter().any(|ev| ev.event.paths.iter().any(|p| p == &target)) {
            return;
        }
        let Ok(new_content) = std::fs::read_to_string(&path_cb) else { return; };
        let new_hash = content_hash(&new_content);
        let mut current = baseline_cb.lock().unwrap();
        if *current == new_hash {
            return;
        }
        *current = new_hash;
        let _ = app_cb.emit_to(label_cb.clone(), "file-changed-on-disk", path_cb.clone());
    })
    .map_err(|e| e.to_string())?;

    let parent = Path::new(&path).parent().unwrap_or(Path::new(&path));
    debouncer.watch(parent, RecursiveMode::NonRecursive).map_err(|e| e.to_string())?;

    // Dropping the previous entry stops its watcher (Debouncer::drop signals stop).
    state
        .watchers
        .lock()
        .unwrap()
        .insert(label, WatchState { path, baseline, _debouncer: debouncer });
    Ok(())
}

/// Stop watching the file associated with the calling window (new unsaved doc,
/// Save As to a different file, window close).
#[tauri::command]
fn unwatch_file(window: tauri::WebviewWindow, state: State<AppState>) {
    state.watchers.lock().unwrap().remove(window.label());
}

#[tauri::command]
fn update_recent_files_menu(
    app: tauri::AppHandle,
    state: State<AppState>,
    items: Vec<RecentFileMenuItem>,
) -> Result<(), String> {
    *state.recent_files.lock().unwrap() = items;
    rebuild_app_menu(&app, &state)
}

#[tauri::command]
fn set_menu_labels(
    app: tauri::AppHandle,
    state: State<AppState>,
    labels: MenuLabels,
) -> Result<(), String> {
    *state.menu_labels.lock().unwrap() = labels;
    rebuild_app_menu(&app, &state)
}

/// Called by the frontend on mount: marks the webview ready and drains any
/// file paths buffered from a cold-start OS open request.
#[tauri::command]
fn frontend_ready(window: tauri::WebviewWindow, state: State<AppState>) -> Vec<String> {
    let label = window.label().to_string();
    state.ready.lock().unwrap().insert(label.clone());
    state.pending.lock().unwrap().remove(&label).unwrap_or_default()
}

#[cfg(target_os = "macos")]
#[tauri::command]
fn set_document_edited(window: tauri::WebviewWindow, edited: bool) -> Result<(), String> {
    use objc2_app_kit::NSWindow;

    let ns_window = window.ns_window().map_err(|e| e.to_string())?;
    let ns_window = unsafe { ns_window.cast::<NSWindow>().as_ref() }
        .ok_or_else(|| "failed to access NSWindow".to_string())?;
    ns_window.setDocumentEdited(edited);
    Ok(())
}

#[cfg(not(target_os = "macos"))]
#[tauri::command]
fn set_document_edited(_edited: bool) -> Result<(), String> {
    Ok(())
}

/// Point the window's macOS proxy icon at the given file. This enables the
/// title-bar document icon and lets the user Cmd/right-click the title to reveal
/// the file's full path, so same-named files in different folders are
/// distinguishable. Passing `None` clears it (unsaved documents).
#[cfg(target_os = "macos")]
#[tauri::command]
fn set_represented_file(
    window: tauri::WebviewWindow,
    path: Option<String>,
) -> Result<(), String> {
    use objc2_app_kit::NSWindow;
    use objc2_foundation::NSString;

    let ns_window = window.ns_window().map_err(|e| e.to_string())?;
    let ns_window = unsafe { ns_window.cast::<NSWindow>().as_ref() }
        .ok_or_else(|| "failed to access NSWindow".to_string())?;
    let value = NSString::from_str(path.as_deref().unwrap_or(""));
    ns_window.setRepresentedFilename(&value);
    Ok(())
}

#[cfg(not(target_os = "macos"))]
#[tauri::command]
fn set_represented_file(_path: Option<String>) -> Result<(), String> {
    Ok(())
}

/// Ask every window to close. Each webview's close guard can still cancel quit.
#[tauri::command]
fn request_quit(app: tauri::AppHandle, state: State<AppState>) {
    *state.quitting.lock().unwrap() = true;
    for window in app.webview_windows().values() {
        let _ = window.close();
    }
}

#[tauri::command]
fn cancel_quit(state: State<AppState>) {
    *state.quitting.lock().unwrap() = false;
}

#[tauri::command]
fn open_file_window(
    app: tauri::AppHandle,
    state: State<AppState>,
    path: Option<String>,
) -> Result<(), String> {
    create_editor_window(&app, &state, path)
}

/// Record an OS-requested file path: emit it if the frontend is ready, else buffer it.
fn dispatch_open(app: &tauri::AppHandle, path: String) {
    let state = app.state::<AppState>();
    let target = state
        .focused_label
        .lock()
        .unwrap()
        .clone()
        .filter(|label| state.ready.lock().unwrap().contains(label))
        .or_else(|| {
            state
                .ready
                .lock()
                .unwrap()
                .contains("main")
                .then(|| "main".to_string())
        });

    if let Some(label) = target {
        let _ = app.emit_to(label, "open-file", path);
        return;
    }

    state
        .pending
        .lock()
        .unwrap()
        .entry("main".into())
        .or_default()
        .push(path);
}

fn create_editor_window(
    app: &tauri::AppHandle,
    state: &State<AppState>,
    path: Option<String>,
) -> Result<(), String> {
    let index = state.window_counter.fetch_add(1, Ordering::Relaxed) + 1;
    let label = format!("editor-{index}");

    if let Some(path) = path {
        state
            .pending
            .lock()
            .unwrap()
            .entry(label.clone())
            .or_default()
            .push(path);
    }

    let mut builder = WebviewWindowBuilder::new(app, &label, WebviewUrl::default())
        .title("YFM Editor")
        .inner_size(1100.0, 760.0)
        .min_inner_size(600.0, 400.0)
        .resizable(true)
        .fullscreen(false)
        .focused(true);

    let focused_label = state.focused_label.lock().unwrap().clone();
    if let Some(active) = focused_label.and_then(|label| app.get_webview_window(&label)) {
        if let Ok(position) = active.outer_position() {
            builder = builder.position((position.x + 22) as f64, (position.y + 22) as f64);
        }
    } else {
        builder = builder.center();
    }

    let window = builder.build().map_err(|e| e.to_string())?;
    window.set_focus().map_err(|e| e.to_string())
}

fn focused_window_label(state: &State<AppState>) -> Option<String> {
    state.focused_label.lock().unwrap().clone()
}

fn rebuild_app_menu(app: &tauri::AppHandle, state: &State<AppState>) -> Result<(), String> {
    let recent_files = state.recent_files.lock().unwrap().clone();
    let labels = state.menu_labels.lock().unwrap().clone();
    let menu = build_app_menu(app, &recent_files, &labels).map_err(|e| e.to_string())?;
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
    // Native menu backends treat `&` as a mnemonic marker.
    text.replace('&', "&&")
}

fn build_app_menu(
    app: &tauri::AppHandle,
    recent_files: &[RecentFileMenuItem],
    labels: &MenuLabels,
) -> tauri::Result<tauri::menu::Menu<tauri::Wry>> {
    let preferences = MenuItemBuilder::with_id("preferences", &labels.preferences)
        .accelerator("CmdOrCtrl+,")
        .build(app)?;
    // Custom quit item routed through the frontend so it honors the unsaved-changes
    // guard. The predefined `.quit()` calls `app.exit()` directly, bypassing the
    // window's close handler and silently discarding unsaved changes on Cmd+Q.
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

    let copy_agent_context = MenuItemBuilder::with_id(
        "copy-agent-context",
        &labels.copy_agent_context,
    )
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
    let view_menu = SubmenuBuilder::new(app, &labels.view).item(&toggle_theme).build()?;

    MenuBuilder::new(app)
        .items(&[&app_menu, &file_menu, &edit_menu, &window_menu, &view_menu])
        .build()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let mut builder = tauri::Builder::default();

    // Single-instance must be the first plugin. Forwards file args from a second
    // launch (Windows/Linux) to the already-running window.
    #[cfg(not(any(target_os = "android", target_os = "ios")))]
    {
        builder = builder.plugin(tauri_plugin_single_instance::init(|app, argv, _cwd| {
            for arg in argv.iter().skip(1) {
                if !arg.starts_with('-') {
                    dispatch_open(app, arg.clone());
                }
            }
        }));
    }

    builder
        .plugin(tauri_plugin_dialog::init())
        .plugin(
            tauri_plugin_window_state::Builder::new()
                .with_state_flags(
                    tauri_plugin_window_state::StateFlags::POSITION
                        | tauri_plugin_window_state::StateFlags::SIZE
                        | tauri_plugin_window_state::StateFlags::MAXIMIZED
                        | tauri_plugin_window_state::StateFlags::FULLSCREEN,
                )
                .map_label(|label| {
                    if label == "main" || label.starts_with("editor-") {
                        "editor"
                    } else {
                        label
                    }
                })
                .build(),
        )
        .manage(AppState::default())
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            app.state::<AppState>()
                .focused_label
                .lock()
                .unwrap()
                .replace("main".into());
            let menu = build_app_menu(app.handle(), &[], &MenuLabels::default())?;
            app.set_menu(menu)?;
            Ok(())
        })
        .on_menu_event(|app, event| {
            let state = app.state::<AppState>();
            if let Some(label) = focused_window_label(&state) {
                let _ = app.emit_to(label, "menu-action", event.id().0.as_str());
            }
        })
        .invoke_handler(tauri::generate_handler![
            read_file,
            write_file,
            update_recent_files_menu,
            set_menu_labels,
            frontend_ready,
            set_document_edited,
            set_represented_file,
            request_quit,
            cancel_quit,
            open_file_window,
            watch_file,
            unwatch_file
        ])
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app, event| {
            // macOS delivers Finder "open with" / `open file.md` here.
            #[cfg(any(target_os = "macos", target_os = "ios"))]
            if let tauri::RunEvent::Opened { urls } = &event {
                for url in urls {
                    if let Ok(path) = url.to_file_path() {
                        dispatch_open(app, path.to_string_lossy().into_owned());
                    }
                }
            }
            if let tauri::RunEvent::WindowEvent { label, event, .. } = &event {
                let state = app.state::<AppState>();
                match event {
                    tauri::WindowEvent::Focused(true) => {
                        state
                            .focused_label
                            .lock()
                            .unwrap()
                            .replace(label.to_string());
                    }
                    tauri::WindowEvent::Destroyed => {
                        let mut focused_label = state.focused_label.lock().unwrap();
                        if focused_label.as_deref() == Some(label.as_str()) {
                            focused_label.take();
                        }
                        drop(focused_label);
                        // Release the file watcher tied to this window.
                        state.watchers.lock().unwrap().remove(label.as_str());
                        if *state.quitting.lock().unwrap() && app.webview_windows().is_empty() {
                            app.exit(0);
                        }
                    }
                    _ => {}
                }
            }
            #[cfg(not(any(target_os = "macos", target_os = "ios")))]
            let _ = (app, event);
        });
}
