use crate::files::FileState;
use crate::menu::MenuState;
use crate::windows::WindowState;

#[derive(Default)]
pub(crate) struct AppState {
    pub(crate) files: FileState,
    pub(crate) menu: MenuState,
    pub(crate) windows: WindowState,
}
