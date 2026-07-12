use std::collections::hash_map::DefaultHasher;
use std::collections::HashMap;
use std::hash::{Hash, Hasher};
use std::path::Path;
use std::sync::{Arc, Mutex};
use std::time::Duration;

use notify_debouncer_full::notify::{RecommendedWatcher, RecursiveMode};
use notify_debouncer_full::{new_debouncer, DebounceEventResult, Debouncer, RecommendedCache};
use serde::Serialize;
use tauri::{Emitter, State};

use crate::state::AppState;

/// Debounced filesystem watcher handle kept alive for the lifetime of a watched
/// document. Dropping it signals the internal thread to stop.
type WatcherHandle = Debouncer<RecommendedWatcher, RecommendedCache>;

/// Per-window watch state: the path being watched and a content hash baseline
/// shared with the watcher callback. The baseline lets us ignore our own writes
/// and detect genuine external changes.
pub(crate) struct WatchState {
    path: String,
    baseline: Arc<Mutex<u64>>,
    _debouncer: WatcherHandle,
}

#[derive(Default)]
pub(crate) struct FileState {
    pub(crate) watchers: Mutex<HashMap<String, WatchState>>,
}

#[derive(Serialize)]
pub(crate) struct FileData {
    path: String,
    content: String,
}

fn content_hash(content: &str) -> u64 {
    let mut hasher = DefaultHasher::new();
    content.hash(&mut hasher);
    hasher.finish()
}

fn write_contents(path: &Path, content: &str) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    std::fs::write(path, content).map_err(|e| e.to_string())
}

#[tauri::command]
pub(crate) fn read_file(path: String) -> Result<FileData, String> {
    let content = std::fs::read_to_string(&path).map_err(|e| e.to_string())?;
    Ok(FileData { path, content })
}

#[tauri::command]
pub(crate) fn write_file(
    window: tauri::WebviewWindow,
    state: State<AppState>,
    path: String,
    content: String,
) -> Result<(), String> {
    // Hash before the move so we can refresh the watcher baseline after writing.
    let new_hash = content_hash(&content);
    write_contents(Path::new(&path), &content)?;

    // Suppress the watcher's own change event by refreshing the baseline before
    // the debounced callback re-reads the file.
    let label = window.label().to_string();
    if let Some(watch) = state.files.watchers.lock().unwrap().get(&label) {
        if watch.path == path {
            *watch.baseline.lock().unwrap() = new_hash;
        }
    }
    Ok(())
}

/// Watch a file for external changes and emit `file-changed-on-disk` to the
/// calling window. Watches the parent directory so atomic saves keep working.
#[tauri::command]
pub(crate) fn watch_file(
    app: tauri::AppHandle,
    window: tauri::WebviewWindow,
    state: State<AppState>,
    path: String,
) -> Result<(), String> {
    let label = window.label().to_string();
    let baseline = std::fs::read_to_string(&path)
        .map(|content| Arc::new(Mutex::new(content_hash(&content))))
        .map_err(|e| e.to_string())?;

    let baseline_cb = baseline.clone();
    let path_cb = path.clone();
    let label_cb = label.clone();
    let app_cb = app.clone();
    let target = Path::new(&path_cb).to_path_buf();

    let mut debouncer = new_debouncer(
        Duration::from_millis(300),
        None,
        move |res: DebounceEventResult| {
            let events = match res {
                Ok(events) => events,
                Err(_) => return,
            };
            if !events
                .iter()
                .any(|ev| ev.event.paths.iter().any(|p| p == &target))
            {
                return;
            }
            let Ok(new_content) = std::fs::read_to_string(&path_cb) else {
                return;
            };
            let new_hash = content_hash(&new_content);
            let mut current = baseline_cb.lock().unwrap();
            if *current == new_hash {
                return;
            }
            *current = new_hash;
            let _ = app_cb.emit_to(label_cb.clone(), "file-changed-on-disk", path_cb.clone());
        },
    )
    .map_err(|e| e.to_string())?;

    let parent = Path::new(&path).parent().unwrap_or(Path::new(&path));
    debouncer
        .watch(parent, RecursiveMode::NonRecursive)
        .map_err(|e| e.to_string())?;

    state.files.watchers.lock().unwrap().insert(
        label,
        WatchState {
            path,
            baseline,
            _debouncer: debouncer,
        },
    );
    Ok(())
}

#[tauri::command]
pub(crate) fn unwatch_file(window: tauri::WebviewWindow, state: State<AppState>) {
    state.files.watchers.lock().unwrap().remove(window.label());
}

#[cfg(test)]
mod tests {
    use std::time::{SystemTime, UNIX_EPOCH};

    use super::{content_hash, read_file, write_contents};

    fn temp_path(name: &str) -> std::path::PathBuf {
        let unique = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        std::env::temp_dir().join(format!("yfm-editor-{name}-{unique}"))
    }

    #[test]
    fn content_hash_is_stable_and_content_sensitive() {
        assert_eq!(content_hash("hello"), content_hash("hello"));
        assert_ne!(content_hash("hello"), content_hash("hello!"));
        assert_ne!(content_hash(""), content_hash(" "));
    }

    #[test]
    fn writes_nested_directories_and_reads_unicode_content() {
        let root = temp_path("nested");
        let path = root.join("missing").join("document.md");
        let content = "# Привет\n\nこんにちは";
        write_contents(&path, content).unwrap();
        let file = read_file(path.to_string_lossy().into_owned()).unwrap();
        assert_eq!(file.path, path.to_string_lossy());
        assert_eq!(file.content, content);
        std::fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn reads_an_empty_file() {
        let root = temp_path("empty");
        let path = root.join("empty.md");
        write_contents(&path, "").unwrap();
        assert_eq!(
            read_file(path.to_string_lossy().into_owned())
                .unwrap()
                .content,
            ""
        );
        std::fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn reports_a_missing_file() {
        let path = temp_path("missing").join("absent.md");
        assert!(read_file(path.to_string_lossy().into_owned()).is_err());
    }
}
