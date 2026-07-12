use std::collections::{HashMap, HashSet};
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::Mutex;

use tauri::{Emitter, Manager, State, WebviewUrl, WebviewWindowBuilder};

use crate::state::AppState;

/// Tracks window focus and files requested by the OS before a webview is ready.
pub(crate) struct WindowState {
    ready: Mutex<HashSet<String>>,
    pending: Mutex<HashMap<String, Vec<String>>>,
    window_counter: AtomicUsize,
    pub(crate) quitting: Mutex<bool>,
    pub(crate) focused_label: Mutex<Option<String>>,
}

impl Default for WindowState {
    fn default() -> Self {
        Self {
            ready: Mutex::default(),
            pending: Mutex::default(),
            window_counter: AtomicUsize::new(0),
            quitting: Mutex::default(),
            focused_label: Mutex::default(),
        }
    }
}

#[tauri::command]
pub(crate) fn frontend_ready(window: tauri::WebviewWindow, state: State<AppState>) -> Vec<String> {
    let label = window.label().to_string();
    state.windows.ready.lock().unwrap().insert(label.clone());
    state
        .windows
        .pending
        .lock()
        .unwrap()
        .remove(&label)
        .unwrap_or_default()
}

#[tauri::command]
pub(crate) fn request_quit(app: tauri::AppHandle, state: State<AppState>) {
    *state.windows.quitting.lock().unwrap() = true;
    for window in app.webview_windows().values() {
        let _ = window.close();
    }
}

#[tauri::command]
pub(crate) fn cancel_quit(state: State<AppState>) {
    *state.windows.quitting.lock().unwrap() = false;
}

#[tauri::command]
pub(crate) fn open_file_window(
    app: tauri::AppHandle,
    state: State<AppState>,
    path: Option<String>,
) -> Result<(), String> {
    create_editor_window(&app, &state, path)
}

/// Emit an OS-requested path when a frontend is ready, or buffer it otherwise.
pub(crate) fn dispatch_open(app: &tauri::AppHandle, path: String) {
    let state = app.state::<AppState>();
    let target = state
        .windows
        .focused_label
        .lock()
        .unwrap()
        .clone()
        .filter(|label| state.windows.ready.lock().unwrap().contains(label))
        .or_else(|| {
            state
                .windows
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
        .windows
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
    let index = state.windows.window_counter.fetch_add(1, Ordering::Relaxed) + 1;
    let label = format!("editor-{index}");

    if let Some(path) = path {
        state
            .windows
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

    let focused_label = state.windows.focused_label.lock().unwrap().clone();
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

pub(crate) fn focused_window_label(state: &State<AppState>) -> Option<String> {
    state.windows.focused_label.lock().unwrap().clone()
}
