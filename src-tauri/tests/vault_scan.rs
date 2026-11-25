// src-tauri/tests/vault_scan.rs
// Tests of src/vault_scan.rs. The fixtures in fixtures/ are the contract shared with src/lib/fileFormat.test.ts and mcp/vault.test.ts: the three
// scans (this one, storage.ts and mcp/vault.ts) must give what fixtures/vault.expected.json says. These are integration tests, not unit tests,
// because build.rs gives only test targets of their own the manifest the library's imports need on Windows.

use graphene_lib::vault_scan::*;
use serde_json::Value;
use std::fs;
use std::path::{Path, PathBuf};
use std::time::UNIX_EPOCH;
use tauri::test::{mock_builder, mock_context, noop_assets};
use tauri_plugin_fs::FsExt;

const FIXTURES: &str = concat!(env!("CARGO_MANIFEST_DIR"), "/../fixtures");

fn fixture_vault() -> PathBuf {
    PathBuf::from(FIXTURES).join("vault")
}

fn expected() -> Value {
    let text = fs::read_to_string(PathBuf::from(FIXTURES).join("vault.expected.json")).unwrap();
    serde_json::from_str(&text).unwrap()
}

fn without(note: &Value, keys: &[&str]) -> Value {
    let mut note = note.clone();
    for key in keys {
        note.as_object_mut().unwrap().remove(*key);
    }
    note
}

/// A scratch folder, removed at the end of the test that asks for it.
struct Scratch(PathBuf);

impl Scratch {
    fn new(name: &str) -> Scratch {
        let dir = std::env::temp_dir().join(format!("graphene-scan-{}-{name}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();
        Scratch(dir)
    }

    fn write(&self, rel: &str, text: &str) {
        let path = self.0.join(rel);
        fs::create_dir_all(path.parent().unwrap()).unwrap();
        fs::write(path, text).unwrap();
    }

    fn path(&self, rel: &str) -> String {
        self.0.join(rel).to_string_lossy().into_owned()
    }
}

impl Drop for Scratch {
    fn drop(&mut self) {
        let _ = fs::remove_dir_all(&self.0);
    }
}

fn note(id: &str, title: &str) -> String {
    format!("---\nid: {id}\ntitle: {title}\n---\nbody of {id}\n")
}

fn ids(scan: &ScanResult) -> Vec<&str> {
    scan.notes.iter().map(|note| note.id.as_str()).collect()
}

#[test]
fn the_fixture_vault_scans_to_the_expected_result() {
    let want = expected();
    let want_notes: Vec<Value> = want["notes"]
        .as_array()
        .unwrap()
        .iter()
        .map(|n| without(n, &["body"]))
        .collect();
    let baseline = scan_vault_dir(&fixture_vault()).unwrap();
    // Reading a few bytes at a time must give the same answer: the head grows until it holds the frontmatter and the body's start
    for chunk in [16, 100, 1000] {
        assert_eq!(
            baseline,
            scan_with(&fixture_vault(), chunk).unwrap(),
            "chunk {chunk}"
        );
    }

    let got = serde_json::to_value(&baseline).unwrap();
    let got_notes = got["notes"].as_array().unwrap();
    assert_eq!(
        got_notes.len(),
        want_notes.len(),
        "the notes found: {:?}",
        ids(&baseline)
    );
    for (got, want) in got_notes.iter().zip(&want_notes) {
        let file = fixture_vault().join(want["path"].as_str().unwrap());
        let meta = fs::metadata(&file).unwrap();
        assert_eq!(got["size"].as_u64(), Some(meta.len()), "size of {file:?}");
        let modified = meta
            .modified()
            .unwrap()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_millis() as u64;
        assert_eq!(got["mtimeMs"].as_u64(), Some(modified), "mtime of {file:?}");
        assert_eq!(&without(got, &["size", "mtimeMs"]), want, "{file:?}");
    }
    assert_eq!(got["folders"], want["folders"]);
    assert_eq!(got["trashCount"], want["trashCount"]);
}

#[test]
fn the_fixture_bodies_read_as_expected() {
    // Canonical, since a path with ".." in it is refused (the fixtures sit beside the crate, "src-tauri/../fixtures")
    let vault = fs::canonicalize(fixture_vault()).unwrap();
    let want = expected();
    let abs = |path: &Value| {
        vault
            .join(path.as_str().unwrap())
            .to_string_lossy()
            .into_owned()
    };
    let notes = want["notes"].as_array().unwrap();
    let paths: Vec<String> = notes.iter().map(|n| abs(&n["path"])).collect();
    let got = read_notes_with(&paths, |_| true);
    assert_eq!(got.len(), notes.len());
    for (note, read) in notes.iter().zip(&got) {
        let text = note["body"].as_str().unwrap().to_string();
        assert_eq!(read, &NoteRead::Text { text }, "{}", note["path"]);
    }
    // Files with no id still read: the command reads what it is asked for, the scan decides what is a note
    let no_id: Vec<String> = want["noId"].as_array().unwrap().iter().map(abs).collect();
    assert!(read_notes_with(&no_id, |_| true)
        .iter()
        .all(|read| matches!(read, NoteRead::Text { .. })));
}

#[test]
fn a_missing_vault_is_an_error_not_an_empty_vault() {
    let scratch = Scratch::new("missing");
    let err = scan_vault_dir(&scratch.0.join("nope")).unwrap_err();
    assert!(err.starts_with("cannot read the vault folder"), "{err}");
    scratch.write("file.md", &note("a1", "A"));
    assert!(scan_vault_dir(&scratch.0.join("file.md")).is_err());
    // A vault with nothing in it is fine
    let empty = Scratch::new("empty");
    assert_eq!(scan_vault_dir(&empty.0).map(|scan| scan.notes.len()), Ok(0));
}

#[test]
fn attachments_is_no_folder_at_the_root_in_any_case_and_a_folder_below() {
    let scratch = Scratch::new("attach");
    scratch.write("ATTACHMENTS/hidden.md", &note("h1", "Hidden"));
    scratch.write("sub/Attachments/shown.md", &note("s1", "Shown"));
    let scan = scan_vault_dir(&scratch.0).unwrap();
    assert_eq!(ids(&scan), ["s1"]);
    let folders: Vec<&str> = scan
        .folders
        .iter()
        .map(|folder| folder.id.as_str())
        .collect();
    assert_eq!(folders, ["sub", "sub/Attachments"]);
}

#[test]
fn two_files_with_one_id_keep_the_first_place_and_the_last_file() {
    let scratch = Scratch::new("dup");
    scratch.write("a-x1.md", &note("x1", "First"));
    scratch.write("b-x2.md", &note("x2", "Other"));
    scratch.write("c-x1.md", &note("x1", "Second"));
    let scan = scan_vault_dir(&scratch.0).unwrap();
    assert_eq!(ids(&scan), ["x1", "x2"]);
    assert_eq!(
        (scan.notes[0].title.as_str(), scan.notes[0].path.as_str()),
        ("Second", "c-x1.md")
    );
}

#[test]
fn a_head_longer_than_the_first_read_is_read_whole() {
    let scratch = Scratch::new("long");
    let title = "t".repeat(10_000);
    scratch.write(
        "long-l1.md",
        &format!("---\nid: l1\ntitle: {title}\n---\nx\n"),
    );
    scratch.write(
        "late-l2.md",
        &format!("---\nid: l2\n---\n{}```js\n", " ".repeat(9_000)),
    );
    let scan = scan_vault_dir(&scratch.0).unwrap();
    let by_id = |id: &str| scan.notes.iter().find(|note| note.id == id).unwrap();
    assert_eq!(
        (by_id("l1").title.len(), by_id("l1").kind),
        (10_000, Kind::Note)
    );
    assert_eq!(by_id("l2").kind, Kind::Code);
}

#[test]
fn paths_that_are_not_absolute_or_climb_out_are_refused() {
    let scratch = Scratch::new("paths");
    scratch.write("v/a.md", &note("a1", "A"));
    scratch.write("other.md", &note("o1", "Other"));
    let root = fs::canonicalize(scratch.0.join("v")).unwrap();
    let inside = |p: &Path| p.starts_with(&root);

    assert!(allowed(&scratch.path("v/a.md"), &inside).is_ok());
    assert!(allowed("v/a.md", &inside).unwrap_err().contains("absolute"));
    let up = format!("{}/../other.md", scratch.path("v"));
    assert!(allowed(&up, &inside).unwrap_err().contains(".."));
    assert!(allowed(&scratch.path("other.md"), &inside)
        .unwrap_err()
        .contains("outside"));
    assert!(allowed(&scratch.path("v/missing.md"), &inside).is_err());
}

#[test]
fn read_notes_answers_each_path_on_its_own_and_reads_only_md_files() {
    let scratch = Scratch::new("read");
    scratch.write("v/a.md", "---\r\nid: a1\r\n---\r\nhello\r\n");
    scratch.write("v/b.txt", "text");
    scratch.write("other.md", &note("o1", "Other"));
    let root = fs::canonicalize(scratch.0.join("v")).unwrap();
    let paths = ["v/a.md", "v/b.txt", "other.md", "v/gone.md"].map(|rel| scratch.path(rel));
    let got = read_notes_with(&paths, |p| p.starts_with(&root));
    assert_eq!(
        got[0],
        NoteRead::Text {
            text: "hello\n".into()
        }
    );
    for (read, why) in got[1..]
        .iter()
        .zip(["not a .md file", "outside", "cannot find"])
    {
        let NoteRead::Error { error } = read else {
            panic!("{read:?} should be an error")
        };
        assert!(error.to_lowercase().contains(why), "{error}");
    }
    assert_eq!(read_notes_with(&[], |_| true), []);
}

#[test]
fn the_real_fs_scope_lets_a_vault_through_and_nothing_else() {
    let scratch = Scratch::new("scope");
    scratch.write("vault/sub/a.md", &note("a1", "A"));
    scratch.write("outside/b.md", &note("b1", "B"));
    let app = mock_builder()
        .plugin(tauri_plugin_fs::init())
        .build(mock_context(noop_assets()))
        .unwrap();
    let scope = app.handle().fs_scope();
    // As allow_vault_folders does, with the path as the config holds it ("/" and all)
    let vault = scratch.path("vault").replace('\\', "/");
    scope.allow_directory(&vault, true).unwrap();
    let is_allowed = |p: &Path| scope.is_allowed(p);

    assert!(allowed(&vault, &is_allowed).is_ok());
    assert!(allowed(&format!("{vault}/sub/a.md"), &is_allowed).is_ok());
    assert!(allowed(&scratch.path("outside/b.md"), &is_allowed)
        .unwrap_err()
        .contains("outside"));
    assert!(allowed(&format!("{vault}/../outside/b.md"), &is_allowed).is_err());
    assert!(scan_vault_dir(&allowed(&vault, &is_allowed).unwrap()).is_ok());
}

fn trash_ids(trash: &[ScannedNote]) -> Vec<&str> {
    trash.iter().map(|note| note.id.as_str()).collect()
}

#[test]
fn the_fixture_trash_lists_the_md_files_directly_in_it() {
    let trash = scan_trash_dir(&fixture_vault()).unwrap();
    // By lower-case name; the folder that was deleted into the trash and the loose text file are no notes
    assert_eq!(trash_ids(&trash), ["t3", "t1", "t2"]);
    let paths: Vec<&str> = trash.iter().map(|note| note.path.as_str()).collect();
    assert_eq!(
        paths,
        [
            ".trash/SHOUT-t3.MD",
            ".trash/trashed-t1.md",
            ".trash/trashed-t2.md"
        ]
    );
    // It is the same set the scan counts, and what the shared expectation says
    assert_eq!(
        trash.len() as u64,
        expected()["trashCount"].as_u64().unwrap()
    );
    assert_eq!(
        scan_vault_dir(&fixture_vault()).unwrap().trash_count,
        trash.len()
    );
    let t1 = &trash[1];
    assert_eq!(t1.title, "Trashed one");
    assert_eq!(t1.folder_id, None);
    assert_eq!(t1.created_at.as_deref(), Some("2026-01-01T00:00:00.000Z"));
    assert_eq!(t1.updated_at.as_deref(), Some("2026-01-02T00:00:00.000Z"));
    assert_eq!(t1.kind, Kind::Note);
    let meta = fs::metadata(fixture_vault().join(".trash/trashed-t1.md")).unwrap();
    assert_eq!(t1.size, meta.len());
    let modified = meta
        .modified()
        .unwrap()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_millis() as u64;
    assert_eq!(t1.mtime_ms, modified);
    // Reading a few bytes at a time gives the same answer
    for chunk in [16, 100] {
        assert_eq!(scan_trash_with(&fixture_vault(), chunk).unwrap(), trash);
    }
}

#[test]
fn a_trashed_note_keeps_the_folder_it_came_from_and_what_is_no_note_is_skipped() {
    let scratch = Scratch::new("trash");
    scratch.write(
        ".trash/plan-p1.md",
        "---
id: p1
title: Plan
folderId: Work/Specs
order: 5
---
```js
",
    );
    scratch.write(".trash/no-id.md", "just text");
    scratch.write(".trash/.dot-d1.md", &note("d1", "Dot"));
    scratch.write(".trash/readme.txt", &note("r1", "Text"));
    scratch.write(".trash/folder/inner-i1.md", &note("i1", "Inner"));
    scratch.write("live-l1.md", &note("l1", "Live"));
    let trash = scan_trash_dir(&scratch.0).unwrap();
    // A dot name counts, as it does in the scan's count of the trash
    assert_eq!(trash_ids(&trash), ["d1", "p1"]);
    assert_eq!(scan_vault_dir(&scratch.0).unwrap().trash_count, 3);
    let plan = &trash[1];
    assert_eq!(plan.folder_id.as_deref(), Some("Work/Specs"));
    assert_eq!(plan.kind, Kind::Code);
    assert_eq!(plan.path, ".trash/plan-p1.md");
    assert_eq!(serde_json::to_value(plan).unwrap()["order"], 5);
    // Two files with one id: the first place, the last file
    scratch.write(".trash/a-x1.md", &note("x1", "First"));
    scratch.write(".trash/c-x1.md", &note("x1", "Second"));
    let trash = scan_trash_dir(&scratch.0).unwrap();
    assert_eq!(trash_ids(&trash), ["d1", "x1", "p1"]);
    assert_eq!(
        (trash[1].title.as_str(), trash[1].path.as_str()),
        ("Second", ".trash/c-x1.md")
    );
}

#[test]
fn no_trash_folder_is_an_empty_trash_and_one_that_cannot_be_read_is_an_error() {
    let scratch = Scratch::new("notrash");
    scratch.write("a-a1.md", &note("a1", "A"));
    assert_eq!(scan_trash_dir(&scratch.0), Ok(Vec::new()));
    // `.trash` that is a file, not a folder, cannot be listed
    scratch.write(".trash", "not a folder");
    let err = scan_trash_dir(&scratch.0).unwrap_err();
    assert!(err.starts_with("cannot read the trash folder"), "{err}");
}

#[test]
fn the_trash_of_a_path_outside_the_vault_folders_is_refused() {
    let scratch = Scratch::new("trashscope");
    scratch.write("vault/.trash/a-a1.md", &note("a1", "A"));
    scratch.write("outside/.trash/b-b1.md", &note("b1", "B"));
    let root = fs::canonicalize(scratch.0.join("vault")).unwrap();
    let inside = |p: &Path| p.starts_with(&root);
    let vault = allowed(&scratch.path("vault"), &inside).unwrap();
    assert_eq!(trash_ids(&scan_trash_dir(&vault).unwrap()), ["a1"]);
    assert!(allowed(&scratch.path("outside"), &inside)
        .unwrap_err()
        .contains("outside"));
}
