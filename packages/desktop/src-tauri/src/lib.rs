mod files;
mod menu;
mod platform;
mod state;
mod windows;

use tauri::{Emitter, Manager};

use crate::files::{read_file, unwatch_file, watch_file, write_file};
use crate::menu::{
    build_app_menu, set_menu_labels, set_spellcheck_checked, update_recent_files_menu, MenuLabels,
};
use crate::platform::{set_document_edited, set_represented_file};
use crate::state::AppState;
use crate::windows::{
    cancel_quit, dispatch_open, focused_window_label, frontend_ready, open_file_window,
    request_quit,
};

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
                .windows
                .focused_label
                .lock()
                .unwrap()
                .replace("main".into());
            let menu = build_app_menu(app.handle(), &[], &MenuLabels::default(), true)?;
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
            set_spellcheck_checked,
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
                            .windows
                            .focused_label
                            .lock()
                            .unwrap()
                            .replace(label.to_string());
                    }
                    tauri::WindowEvent::Destroyed => {
                        let mut focused_label = state.windows.focused_label.lock().unwrap();
                        if focused_label.as_deref() == Some(label.as_str()) {
                            focused_label.take();
                        }
                        drop(focused_label);
                        // Release the file watcher tied to this window.
                        state.files.watchers.lock().unwrap().remove(label.as_str());
                        if *state.windows.quitting.lock().unwrap()
                            && app.webview_windows().is_empty()
                        {
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
