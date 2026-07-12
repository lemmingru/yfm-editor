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

impl WindowState {
    fn mark_ready_and_drain(&self, label: String) -> Vec<String> {
        self.ready.lock().unwrap().insert(label.clone());
        self.pending
            .lock()
            .unwrap()
            .remove(&label)
            .unwrap_or_default()
    }

    fn ready_target(&self) -> Option<String> {
        let ready = self.ready.lock().unwrap();
        self.focused_label
            .lock()
            .unwrap()
            .clone()
            .filter(|label| ready.contains(label))
            .or_else(|| ready.contains("main").then(|| "main".to_string()))
    }

    fn buffer_open(&self, label: &str, path: String) {
        self.pending
            .lock()
            .unwrap()
            .entry(label.to_string())
            .or_default()
            .push(path);
    }
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
    state.windows.mark_ready_and_drain(label)
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
    if let Some(label) = state.windows.ready_target() {
        let _ = app.emit_to(label, "open-file", path);
        return;
    }
    state.windows.buffer_open("main", path);
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

#[cfg(test)]
mod tests {
    use super::WindowState;

    #[test]
    fn cold_start_buffers_paths_in_order_and_drains_once() {
        let state = WindowState::default();
        state.buffer_open("main", "/first.md".into());
        state.buffer_open("main", "/second.md".into());
        assert_eq!(
            state.mark_ready_and_drain("main".into()),
            ["/first.md", "/second.md"]
        );
        assert!(state.mark_ready_and_drain("main".into()).is_empty());
    }

    #[test]
    fn targets_the_focused_window_when_it_is_ready() {
        let state = WindowState::default();
        state.mark_ready_and_drain("main".into());
        state.mark_ready_and_drain("editor-1".into());
        state
            .focused_label
            .lock()
            .unwrap()
            .replace("editor-1".into());
        assert_eq!(state.ready_target().as_deref(), Some("editor-1"));
    }

    #[test]
    fn falls_back_to_main_when_the_focused_window_is_not_ready() {
        let state = WindowState::default();
        state.mark_ready_and_drain("main".into());
        state
            .focused_label
            .lock()
            .unwrap()
            .replace("editor-1".into());
        assert_eq!(state.ready_target().as_deref(), Some("main"));
    }

    #[test]
    fn has_no_target_before_any_frontend_is_ready() {
        let state = WindowState::default();
        assert_eq!(state.ready_target(), None);
    }
}
