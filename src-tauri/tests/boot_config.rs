// src-tauri/tests/boot_config.rs
// Tests of src/boot.rs, the one call the page makes to learn the vault list at start. It reads a file and looks at folders and judges
// nothing: parsing and every rule about vaults stay in src/lib/vault.ts (and its test). These are integration tests, not unit tests,
// because build.rs gives only test targets of their own the manifest the library's imports need on Windows.

use graphene_lib::boot::*;
use serde_json::json;
use std::fs;
use std::path::PathBuf;

/// A scratch folder, removed at the end of the test that asks for it.
struct Scratch(PathBuf);

impl Scratch {
    fn new(name: &str) -> Scratch {
        let dir = std::env::temp_dir().join(format!("graphene-boot-{}-{name}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();
        Scratch(dir)
    }

    /// The config file of an app data folder that is this scratch folder.
    fn config(&self) -> PathBuf {
        config_file(&self.0)
    }

    fn write_config(&self, bytes: impl AsRef<[u8]>) {
        let file = self.config();
        fs::create_dir_all(file.parent().unwrap()).unwrap();
        fs::write(file, bytes).unwrap();
    }

    fn folder(&self, name: &str) -> String {
        let dir = self.0.join(name);
        fs::create_dir_all(&dir).unwrap();
        dir.to_string_lossy().into_owned()
    }

    fn missing(&self, name: &str) -> String {
        self.0.join(name).to_string_lossy().into_owned()
    }
}

impl Drop for Scratch {
    fn drop(&mut self) {
        let _ = fs::remove_dir_all(&self.0);
    }
}

#[test]
fn the_config_file_is_graphene_config_json_in_the_app_data_folder() {
    let file = config_file(std::path::Path::new("data"));
    assert_eq!(
        file,
        PathBuf::from("data").join("graphene").join("config.json")
    );
}

#[test]
fn no_file_is_the_first_run() {
    let scratch = Scratch::new("first-run");
    let boot = read_boot_config(&scratch.config()).unwrap();
    assert_eq!(boot, BootConfig::default());
    assert_eq!(boot.text, None);
    assert!(boot.exists.is_empty());
}

#[test]
fn it_returns_the_raw_text_and_whether_each_listed_vault_is_there() {
    let scratch = Scratch::new("listed");
    let (here, gone) = (scratch.folder("here"), scratch.missing("gone"));
    // Pretty-printed with CRLF, as a person (or an editor) may have left it: the text must come back byte for byte
    let text = serde_json::to_string_pretty(&json!({
        "active": here,
        "vaultPath": here,
        "vaults": [
            { "path": here, "name": "Here", "shared": true },
            { "path": gone, "name": "Gone", "shared": false },
        ],
        "somethingNewer": 1,
    }))
    .unwrap()
    .replace('\n', "\r\n");
    scratch.write_config(&text);

    let boot = read_boot_config(&scratch.config()).unwrap();
    assert_eq!(boot.text.as_deref(), Some(text.as_str()));
    assert_eq!(boot.exists.len(), 2);
    assert_eq!(boot.exists[&here], true);
    assert_eq!(boot.exists[&gone], false);
}

#[test]
fn the_old_style_vault_path_is_looked_at_too() {
    let scratch = Scratch::new("old-style");
    let here = scratch.folder("notes");
    scratch.write_config(json!({ "vaultPath": here }).to_string());

    let boot = read_boot_config(&scratch.config()).unwrap();
    assert_eq!(boot.exists, [(here, true)].into());
}

#[test]
fn something_that_is_not_a_folder_counts_like_the_fs_plugin_says_exists() {
    let scratch = Scratch::new("a-file");
    let file = scratch.missing("a-file.txt");
    fs::write(&file, "x").unwrap();
    scratch.write_config(json!({ "vaults": [{ "path": file }] }).to_string());

    let boot = read_boot_config(&scratch.config()).unwrap();
    assert_eq!(boot.exists[&file], true);
}

#[test]
fn entries_without_a_path_are_skipped() {
    let scratch = Scratch::new("no-path");
    let here = scratch.folder("here");
    scratch.write_config(
        json!({ "vaults": [{ "name": "No path" }, "text", null, { "path": 4 }, { "path": here }] })
            .to_string(),
    );

    let boot = read_boot_config(&scratch.config()).unwrap();
    assert_eq!(boot.exists, [(here, true)].into());
}

#[test]
fn text_that_is_not_json_still_comes_back_for_the_page_to_judge() {
    let scratch = Scratch::new("not-json");
    for text in ["{ not json", "", "\u{feff}{\"vaults\":[]}", "[1, 2]"] {
        scratch.write_config(text);
        let boot = read_boot_config(&scratch.config()).unwrap();
        assert_eq!(boot.text.as_deref(), Some(text), "text {text:?}");
        assert!(boot.exists.is_empty(), "text {text:?}");
    }
}

#[test]
fn a_file_that_cannot_be_read_as_text_is_an_error_not_a_first_run() {
    let scratch = Scratch::new("bad-bytes");
    // UTF-16 with a byte order mark, as Notepad's "Unicode" saves it
    scratch.write_config(b"\xff\xfe{\x00}\x00");
    let err = read_boot_config(&scratch.config()).unwrap_err();
    assert!(err.contains("config.json"), "{err}");

    // A folder where the file should be cannot be read either
    let scratch = Scratch::new("a-folder");
    fs::create_dir_all(scratch.config()).unwrap();
    assert!(read_boot_config(&scratch.config()).is_err());
}

#[test]
fn vault_paths_lists_every_vault_and_the_old_style_path() {
    let config = json!({
        "vaultPath": "C:/old",
        "vaults": [{ "path": "D:/a" }, { "name": "none" }, { "path": "E:/b" }],
    });
    assert_eq!(
        vault_paths(&config).collect::<Vec<_>>(),
        ["D:/a", "E:/b", "C:/old"]
    );
    assert_eq!(vault_paths(&json!("a string")).count(), 0);
    assert_eq!(vault_paths(&json!({ "vaults": "nope" })).count(), 0);
}
