use tauri::menu::{MenuBuilder, MenuEvent, MenuItem};
use tauri::tray::TrayIconBuilder;
use tauri::{AppHandle, Manager, Wry};

const TRAY_ID: &str = "main";
const MENU_SHOW: &str = "tray_show";
const MENU_EXIT: &str = "tray_exit";

pub fn setup_tray(app: &tauri::AppHandle) -> tauri::Result<()> {
    let show = MenuItem::with_id(app, MENU_SHOW, "Show", true, None::<String>)?;
    let exit = MenuItem::with_id(app, MENU_EXIT, "Exit", true, None::<String>)?;
    let menu = MenuBuilder::new(app).items(&[&show, &exit]).build()?;

    let mut builder = TrayIconBuilder::with_id(TRAY_ID).menu(&menu).tooltip("Quick Launcher");
    if let Some(icon) = app.default_window_icon() {
        builder = builder.icon(icon.clone());
    }

    let tray = builder
        .on_menu_event(|app: &AppHandle<Wry>, event: MenuEvent| {
            if event.id() == MENU_SHOW {
                if let Some(w) = app.get_webview_window("main") {
                    let _ = w.show();
                    let _ = w.set_focus();
                }
            } else if event.id() == MENU_EXIT {
                app.exit(0);
            }
        })
        .build(app)?;

    let _ = tray;
    Ok(())
}
