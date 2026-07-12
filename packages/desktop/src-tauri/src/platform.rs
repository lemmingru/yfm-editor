/// Mark the native macOS document window as edited.
#[cfg(target_os = "macos")]
#[tauri::command]
pub(crate) fn set_document_edited(
    window: tauri::WebviewWindow,
    edited: bool,
) -> Result<(), String> {
    use objc2_app_kit::NSWindow;

    let ns_window = window.ns_window().map_err(|e| e.to_string())?;
    let ns_window = unsafe { ns_window.cast::<NSWindow>().as_ref() }
        .ok_or_else(|| "failed to access NSWindow".to_string())?;
    ns_window.setDocumentEdited(edited);
    Ok(())
}

#[cfg(not(target_os = "macos"))]
#[tauri::command]
pub(crate) fn set_document_edited(_edited: bool) -> Result<(), String> {
    Ok(())
}

/// Point the macOS proxy icon at the document file, or clear it with `None`.
#[cfg(target_os = "macos")]
#[tauri::command]
pub(crate) fn set_represented_file(
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
pub(crate) fn set_represented_file(_path: Option<String>) -> Result<(), String> {
    Ok(())
}
