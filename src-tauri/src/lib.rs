// src-tauri/src/lib.rs

use tauri::Manager;
use tauri_plugin_fs::FsExt;

pub mod boot;
pub mod fonts;
pub mod vault_scan;

/// The fs permissions in capabilities/default.json cover the home folder. A vault anywhere else (another drive) is
/// allowed here instead, at every start: the folder picker only grants it until the app closes.
/// Reads the vault list the app saved (see src/lib/vaultList.ts); a missing or unreadable file allows nothing.
fn allow_vault_folders(app: &tauri::App) {
    let Ok(dir) = app.path().app_data_dir() else {
        return;
    };
    let Ok(text) = std::fs::read_to_string(boot::config_file(&dir)) else {
        return;
    };
    let Ok(config) = serde_json::from_str::<serde_json::Value>(&text) else {
        return;
    };
    let scope = app.fs_scope();
    for path in boot::vault_paths(&config) {
        if let Err(err) = scope.allow_directory(path, true) {
            eprintln!("could not allow the vault folder {path}: {err}");
        }
    }
}

/// The window starts hidden (`"visible": false` in tauri.conf.json) and the page shows it once it has something to look at
/// (src/lib/windowShow.ts). If that never happens (the page did not load, it crashed before its first render, it hangs) this shows it
/// anyway, so the app can never stay invisible.
#[cfg(desktop)]
fn show_window_if_still_hidden(app: tauri::AppHandle) {
    std::thread::spawn(move || {
        std::thread::sleep(std::time::Duration::from_secs(3));
        if let Some(window) = app.get_webview_window("main") {
            // `is_visible` is also true for a minimised window, which must stay minimised
            if !window.is_visible().unwrap_or(false) {
                let _ = window.show();
            }
        }
    });
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let mut builder = tauri::Builder::default();

    #[cfg(desktop)]
    {
        use tauri_plugin_window_state::StateFlags;

        // Single-instance has to be the first plugin: a second launch brings the running window forward.
        // Not in debug builds: `tauri dev` has the same app identifier as the installed app, so with that open
        // the dev build would hand over to the installed window and exit instead of starting.
        #[cfg(not(debug_assertions))]
        {
            builder = builder.plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.unminimize();
                    let _ = window.show();
                    let _ = window.set_focus();
                }
            }));
        }

        // Window state is a builder plugin (not added in setup) so it restores the window as it is created.
        builder = builder.plugin(
            tauri_plugin_window_state::Builder::default()
                .with_state_flags(StateFlags::SIZE | StateFlags::POSITION | StateFlags::MAXIMIZED)
                .build(),
        );
    }

    builder
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            boot::boot_config,
            fonts::list_fonts,
            vault_scan::scan_vault,
            vault_scan::read_notes,
            vault_scan::scan_trash
        ])
        .setup(|app| {
            allow_vault_folders(app);
            #[cfg(desktop)]
            {
                show_window_if_still_hidden(app.handle().clone());
                app.handle()
                    .plugin(tauri_plugin_updater::Builder::new().build())?;
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
