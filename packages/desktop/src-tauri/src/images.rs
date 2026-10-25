use std::path::{Path, PathBuf};

use serde::Serialize;
use tauri::{Manager, Url};

#[derive(Serialize)]
pub(crate) struct ImagePath {
    path: String,
    fragment: Option<String>,
}

fn local_image_path(
    document_path: Option<&str>,
    src: &str,
) -> Result<(PathBuf, Option<String>), String> {
    if src.is_empty() || src.starts_with("//") {
        return Err("An image path is required".into());
    }
    let url = if src.starts_with("file:") {
        Url::parse(src).map_err(|e| e.to_string())?
    } else if src.starts_with('/') {
        // Markdown paths are URL encoded; preserve fragments (e.g. SVG views).
        Url::parse(&format!("file://{src}")).map_err(|e| e.to_string())?
    } else if Path::new(src).is_absolute() {
        Url::from_file_path(src).map_err(|_| "Invalid absolute image path")?
    } else {
        let document = document_path.ok_or("Save the document to resolve relative images")?;
        Url::from_file_path(document)
            .map_err(|_| "The document path must be absolute")?
            .join(src)
            .map_err(|e| e.to_string())?
    };
    let path = url
        .to_file_path()
        .map_err(|_| "Expected a local image path")?;
    let path = path.canonicalize().map_err(|e| e.to_string())?;
    if !path.is_file() {
        return Err("The image path is not a file".into());
    }
    let extension = path
        .extension()
        .and_then(|s| s.to_str())
        .unwrap_or("")
        .to_ascii_lowercase();
    if !matches!(
        extension.as_str(),
        "png" | "jpg" | "jpeg" | "gif" | "webp" | "svg" | "avif" | "bmp" | "ico"
    ) {
        return Err("Unsupported image format".into());
    }
    Ok((path, url.fragment().map(String::from)))
}

/// Grant asset access to this image only, rather than exposing a directory tree.
#[tauri::command]
pub(crate) fn resolve_image(
    app: tauri::AppHandle,
    document_path: Option<String>,
    src: String,
) -> Result<ImagePath, String> {
    let (path, fragment) = local_image_path(document_path.as_deref(), &src)?;
    app.asset_protocol_scope()
        .allow_file(&path)
        .map_err(|e| e.to_string())?;
    Ok(ImagePath {
        path: path.to_string_lossy().into_owned(),
        fragment,
    })
}

#[cfg(test)]
mod tests {
    use super::local_image_path;

    #[test]
    fn resolves_relative_encoded_paths_and_svg_fragments_from_the_document() {
        let root = std::env::temp_dir().join(format!("yfm-images-{}", std::process::id()));
        std::fs::create_dir_all(root.join("assets")).unwrap();
        let image = root.join("assets/схема #1.svg");
        std::fs::write(&image, "<svg/>").unwrap();
        let document = root.join("family.md");
        let (resolved, fragment) =
            local_image_path(document.to_str(), "./assets/схема%20%231.svg#view").unwrap();
        assert_eq!(resolved, image.canonicalize().unwrap());
        assert_eq!(fragment.as_deref(), Some("view"));
        let other_document = root.join("sub/family.md");
        assert_eq!(
            local_image_path(other_document.to_str(), "../assets/схема%20%231.svg")
                .unwrap()
                .0,
            resolved
        );
        let file_url = tauri::Url::from_file_path(&image).unwrap();
        assert_eq!(local_image_path(None, file_url.as_str()).unwrap().0, resolved);
        std::fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn rejects_missing_images_unsaved_relative_paths_and_non_file_urls() {
        assert!(local_image_path(None, "./missing.png").is_err());
        assert!(local_image_path(Some("/docs/a.md"), "missing.png").is_err());
        assert!(local_image_path(Some("/docs/a.md"), "https://example.com/a.png").is_err());
        assert!(local_image_path(None, "//example.com/a.png").is_err());
    }
}
