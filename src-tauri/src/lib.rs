// src-tauri/src/lib.rs

use tauri::Manager;
use tauri_plugin_fs::FsExt;

/// The fs permissions in capabilities/default.json cover the home folder. A vault anywhere else (another drive) is
/// allowed here instead, at every start: the folder picker only grants it until the app closes.
/// Reads the vault list the app saved (see src/lib/vaultList.ts); a missing or unreadable file allows nothing.
fn allow_vault_folders(app: &tauri::App) {
    let Ok(dir) = app.path().app_data_dir() else {
        return;
    };
    let Ok(text) = std::fs::read_to_string(dir.join("graphene").join("config.json")) else {
        return;
    };
    let Ok(config) = serde_json::from_str::<serde_json::Value>(&text) else {
        return;
    };
    let listed = config["vaults"]
        .as_array()
        .into_iter()
        .flatten()
        .filter_map(|vault| vault["path"].as_str());
    let old_style = config["vaultPath"].as_str();
    let scope = app.fs_scope();
    for path in listed.chain(old_style) {
        if let Err(err) = scope.allow_directory(path, true) {
            eprintln!("could not allow the vault folder {path}: {err}");
        }
    }
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
        .setup(|app| {
            allow_vault_folders(app);
            #[cfg(desktop)]
            app.handle()
                .plugin(tauri_plugin_updater::Builder::new().build())?;
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
