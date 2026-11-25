// src-tauri/src/boot.rs
// The first call the page makes at start: `boot_config` gives in one IPC call what three file-plugin calls in a row gave
// (does config.json exist, what is in it, does each vault's folder exist). It only does I/O: parsing the text, the migration of the old
// `{ "vaultPath" }` file, the `.bak` copy of a file that does not parse and every rule about vaults stay in src/lib/vaultList.ts and
// src/lib/vault.ts, which the MCP server shares. The page's side of the contract is `loadVaultConfig` in src/lib/vault.ts.
//
// It takes no path from the page (it reads one fixed file), so unlike the vault commands it needs no scope check. The folders it
// looks at are the ones `allow_vault_folders` (lib.rs) already grants at start, found by the same function, `vault_paths`.
//
// Panics: the release profile aborts on one, so nothing here may need one to recover: failures are returned as strings.

use serde::Serialize;
use serde_json::Value;
use std::collections::HashMap;
use std::fs;
use std::io::ErrorKind;
use std::path::{Path, PathBuf};
use tauri::Manager;

/// What the page gets (the same names on the wire).
#[derive(Serialize, Debug, Default, PartialEq)]
pub struct BootConfig {
    /// The raw text of config.json, byte order mark and all; `null` when there is no such file (the first run).
    pub text: Option<String>,
    /// For each vault path the file lists (as written there), whether something exists at it. Empty when the text is not JSON: whether it
    /// makes sense is for the page to say.
    pub exists: HashMap<String, bool>,
}

/// `<AppData>/graphene/config.json`, where the app saves its vault list (`BaseDirectory.AppData` in src/lib/vault.ts).
pub fn config_file(app_data: &Path) -> PathBuf {
    app_data.join("graphene").join("config.json")
}

/// The vault folders a config file names: every `vaults[].path`, and the old-style `vaultPath`.
pub fn vault_paths(config: &Value) -> impl Iterator<Item = &str> {
    config["vaults"]
        .as_array()
        .into_iter()
        .flatten()
        .filter_map(|vault| vault["path"].as_str())
        .chain(config["vaultPath"].as_str())
}

/// Reads the config file and looks at each vault folder it names. A missing file is the first run (`text: null`); a file that exists but
/// cannot be read as text (no permission, not UTF-8) is an error, so it is never mistaken for a first run.
pub fn read_boot_config(file: &Path) -> Result<BootConfig, String> {
    let text = match fs::read_to_string(file) {
        Ok(text) => text,
        Err(err) if err.kind() == ErrorKind::NotFound => return Ok(BootConfig::default()),
        Err(err) => return Err(format!("{}: {err}", file.display())),
    };
    // `exists` as the fs plugin's: anything at the path counts, and a path that cannot be looked at does not
    let exists = serde_json::from_str::<Value>(&text)
        .map(|config| {
            vault_paths(&config)
                .map(|path| {
                    (
                        path.to_string(),
                        Path::new(path).try_exists().unwrap_or(false),
                    )
                })
                .collect()
        })
        .unwrap_or_default();
    Ok(BootConfig {
        text: Some(text),
        exists,
    })
}

#[tauri::command]
pub async fn boot_config(app: tauri::AppHandle) -> Result<BootConfig, String> {
    let app_data = app.path().app_data_dir().map_err(|err| err.to_string())?;
    // Off the main thread: a vault on a network drive that does not answer must not freeze the window
    tauri::async_runtime::spawn_blocking(move || read_boot_config(&config_file(&app_data)))
        .await
        .map_err(|err| err.to_string())?
}
