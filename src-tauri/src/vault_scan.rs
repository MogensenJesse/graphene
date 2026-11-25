// src-tauri/src/vault_scan.rs
// The startup path in Rust (audit plan WP5): `scan_vault` lists a vault's notes, metadata only, in one call, and `read_notes` reads
// note bodies in batches. The TypeScript side is src/lib/vaultScan.ts, which documents the result shapes for the app.
//
// The rules are those of `scanVaultRecursive` + `readItemFile` (src/lib/storage.ts) and of mcp/vault.ts, and the frontmatter is the
// subset `parseNoteFile` reads (src/lib/fileFormat.ts). All three are tested against the same files, fixtures/vault and
// fixtures/vault.expected.json (see the tests at the end): change a rule in one place and change the other two, and the fixture, with it.
//
// Security: custom commands bypass the fs plugin's scope, and the webview renders user Markdown. So every path is checked against the
// fs scope (`allowed`: the vault folders `allow_vault_folders` and the folder picker add) before anything is read, `..` is refused,
// and `read_notes` reads nothing but `.md` files.
//
// Panics: the release profile aborts on one, so nothing here may need one to recover: failures are returned as strings.

use serde::Serialize;
use serde_json::{Number, Value};
use std::collections::HashMap;
use std::fs::{self, File};
use std::io::{self, Read};
use std::path::{Component, Path, PathBuf};
use std::sync::atomic::{AtomicUsize, Ordering};
use std::thread;
use std::time::UNIX_EPOCH;
use tauri_plugin_fs::FsExt;

const ATTACH_DIR: &str = "attachments";
const TRASH_DIR: &str = ".trash";
const FOLDER_ORDER_FILE: &str = ".folder-order.json";
/// How much of a note is read first. The frontmatter is a few hundred bytes; more is read only when it (or the start of the body, for
/// the kind) does not fit.
const HEAD_CHUNK: usize = 4096;

// ---------------------------------------------------------------------------
// What the commands return (camelCase on the wire; src/lib/vaultScan.ts has the same shapes)
// ---------------------------------------------------------------------------

/// What `itemKind` (src/lib/utils.ts) says of the body: "code" starts with a fenced block, else "note".
#[derive(Serialize, Debug, PartialEq, Clone, Copy)]
#[serde(rename_all = "lowercase")]
pub enum Kind {
    Note,
    Code,
}

/// One note, without its body. `created_at` / `updated_at` are `null` when the file has no such line (the TypeScript side then uses
/// the time of the scan, as `parseNoteFile` does); a line with no value is "".
#[derive(Serialize, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ScannedNote {
    pub id: String,
    pub title: String,
    pub folder_id: Option<String>,
    pub created_at: Option<String>,
    pub updated_at: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub order: Option<Number>,
    pub kind: Kind,
    pub path: String,
    pub mtime_ms: u64,
    pub size: u64,
}

/// A folder: `id` is its path relative to the vault, with "/".
#[derive(Serialize, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ScannedFolder {
    pub id: String,
    pub name: String,
    pub parent_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub order: Option<Number>,
}

#[derive(Serialize, Debug, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ScanResult {
    pub notes: Vec<ScannedNote>,
    pub folders: Vec<ScannedFolder>,
    pub trash_count: usize,
}

/// One path of `read_notes`: the body, or why it could not be read.
#[derive(Serialize, Debug, PartialEq)]
#[serde(untagged)]
pub enum NoteRead {
    Text { text: String },
    Error { error: String },
}

// ---------------------------------------------------------------------------
// The commands
// ---------------------------------------------------------------------------

/// Walks the vault once and returns every note's metadata, the folders (with their ranks from `.folder-order.json`) and the number
/// of notes in `.trash`, in one call. Rules (as `scanVaultRecursive` + `readItemFile`): dot entries and the root `attachments`
/// folder (any case) are skipped, only `.md` files count, a file with no id is no note, symlinks are not followed (the app's
/// `readDir` reports them as neither file nor folder), an unreadable subfolder or file is skipped, and two files with one id give one
/// note (the last file, at the place of the first). A vault root that cannot be read is an error, never an empty vault. Order: depth
/// first, the entries of each folder sorted by lower-case name (then by name), folders and notes together; `notes` and `folders` each
/// keep that order. It runs on a pool of threads, off the main thread.
#[tauri::command]
pub async fn scan_vault(app: tauri::AppHandle, path: String) -> Result<ScanResult, String> {
    let scope = app.fs_scope();
    tauri::async_runtime::spawn_blocking(move || {
        let vault = allowed(&path, &|p| scope.is_allowed(p))?;
        scan_vault_dir(&vault).map_err(|err| format!("{path}: {err}"))
    })
    .await
    .map_err(|err| err.to_string())?
}

/// Reads the body of each path (absolute, a `.md` file inside an allowed vault folder), in parallel, and returns one entry per path in
/// the order asked: `{ text }`, the body as `parseNoteFile` would give it (frontmatter and byte order mark removed, LF line endings),
/// or `{ error }` for that path alone. The caller chooses the batch; call it one batch at a time.
#[tauri::command]
pub async fn read_notes(
    app: tauri::AppHandle,
    paths: Vec<String>,
) -> Result<Vec<NoteRead>, String> {
    let scope = app.fs_scope();
    tauri::async_runtime::spawn_blocking(move || read_notes_with(&paths, |p| scope.is_allowed(p)))
        .await
        .map_err(|err| err.to_string())
}

/// Lists the notes directly in `<vault>/.trash`, metadata only, in one call (the Trash view reads their texts with `read_notes`). The
/// rules are `scan_vault`'s, for the trash's one folder: the path must be an allowed vault folder, only `.md` files directly in `.trash`
/// count (a folder that was deleted into it, a loose file of another kind and a link are not notes), a file with no id is skipped, and
/// two files with one id give one note (the last file, at the place of the first). `folder_id` is the folder the note was in when it was
/// trashed, from its frontmatter (its path says `.trash`), and `path` is `.trash/<name>`. A vault with no `.trash` has an empty trash;
/// a vault folder or a trash folder that cannot be read is an error. Order: by lower-case name (then by name).
#[tauri::command]
pub async fn scan_trash(app: tauri::AppHandle, path: String) -> Result<Vec<ScannedNote>, String> {
    let scope = app.fs_scope();
    tauri::async_runtime::spawn_blocking(move || {
        let vault = allowed(&path, &|p| scope.is_allowed(p))?;
        scan_trash_dir(&vault).map_err(|err| format!("{path}: {err}"))
    })
    .await
    .map_err(|err| err.to_string())?
}

/// The path to read, or why it is refused: it must be absolute, free of "..", and (once links are resolved) inside what `is_allowed` says.
pub fn allowed(path: &str, is_allowed: &impl Fn(&Path) -> bool) -> Result<PathBuf, String> {
    let given = Path::new(path);
    if !given.is_absolute() {
        return Err(format!("{path}: the path must be absolute"));
    }
    if given.components().any(|part| part == Component::ParentDir) {
        return Err(format!("{path}: the path must not contain \"..\""));
    }
    let real = fs::canonicalize(given).map_err(|err| format!("{path}: {err}"))?;
    if is_allowed(&real) {
        Ok(real)
    } else {
        Err(format!(
            "{path}: outside the vault folders Graphene may read"
        ))
    }
}

pub fn read_notes_with(
    paths: &[String],
    is_allowed: impl Fn(&Path) -> bool + Sync,
) -> Vec<NoteRead> {
    par_map(paths, |path| {
        let body = allowed(path, &is_allowed).and_then(|real| {
            if !is_md(&real) {
                return Err(format!("{path}: not a .md file"));
            }
            read_body(&real).map_err(|err| format!("{path}: {err}"))
        });
        match body {
            Ok(text) => NoteRead::Text { text },
            Err(error) => NoteRead::Error { error },
        }
    })
}

// ---------------------------------------------------------------------------
// Parallel map: a few threads, an atomic cursor, the results in the order of the items
// ---------------------------------------------------------------------------

fn par_map<T: Sync, R: Send>(items: &[T], f: impl Fn(&T) -> R + Sync) -> Vec<R> {
    // The work is file system calls, so more threads than cores pays off; a cap keeps a big machine polite
    let workers = thread::available_parallelism()
        .map_or(4, |n| n.get() * 2)
        .clamp(2, 16)
        .min(items.len());
    let next = AtomicUsize::new(0);
    let mut done: Vec<(usize, R)> = thread::scope(|scope| {
        let handles: Vec<_> = (0..workers)
            .map(|_| {
                scope.spawn(|| {
                    let mut mine = Vec::new();
                    loop {
                        let at = next.fetch_add(1, Ordering::Relaxed);
                        let Some(item) = items.get(at) else { break };
                        mine.push((at, f(item)));
                    }
                    mine
                })
            })
            .collect();
        handles
            .into_iter()
            .flat_map(|handle| {
                handle
                    .join()
                    .unwrap_or_else(|panic| std::panic::resume_unwind(panic))
            })
            .collect()
    });
    done.sort_unstable_by_key(|(at, _)| *at);
    done.into_iter().map(|(_, result)| result).collect()
}

// ---------------------------------------------------------------------------
// The walk
// ---------------------------------------------------------------------------

enum Entry {
    Dir(String),
    Note(String),
}

impl Entry {
    fn name(&self) -> &str {
        match self {
            Entry::Dir(name) | Entry::Note(name) => name,
        }
    }
}

fn ends_with_md(name: &str) -> bool {
    name.len() >= 3 && name.as_bytes()[name.len() - 3..].eq_ignore_ascii_case(b".md")
}

fn is_md(path: &Path) -> bool {
    path.file_name()
        .and_then(|name| name.to_str())
        .is_some_and(ends_with_md)
}

/// The folders and `.md` notes of one directory, sorted. `root` is the vault itself, where `attachments` is no folder.
fn list_dir(dir: &Path, root: bool) -> io::Result<Vec<Entry>> {
    let mut entries = Vec::new();
    for entry in fs::read_dir(dir)?.flatten() {
        // A name that is not UTF-8 is skipped, as the fs plugin's readDir does
        let Ok(name) = entry.file_name().into_string() else {
            continue;
        };
        if name.is_empty() || name.starts_with('.') {
            continue;
        }
        // file_type() does not follow links: a symlink is neither a folder nor a file here, as in the app
        let Ok(kind) = entry.file_type() else {
            continue;
        };
        if kind.is_dir() {
            if !(root && name.eq_ignore_ascii_case(ATTACH_DIR)) {
                entries.push(Entry::Dir(name));
            }
        } else if kind.is_file() && ends_with_md(&name) {
            entries.push(Entry::Note(name));
        }
    }
    entries.sort_by_cached_key(|entry| (entry.name().to_lowercase(), entry.name().to_string()));
    Ok(entries)
}

struct Listing {
    abs: PathBuf,
    entries: Vec<Entry>,
}

struct FileRef {
    abs: PathBuf,
    /// Relative to the vault, with "/"
    rel: String,
    /// The folder it sits in (its path), none at the root
    folder: Option<String>,
}

fn join_rel(dir: &str, name: &str) -> String {
    if dir.is_empty() {
        name.to_string()
    } else {
        format!("{dir}/{name}")
    }
}

fn subdirs(rel: &str, abs: &Path, entries: &[Entry]) -> Vec<(String, PathBuf)> {
    entries
        .iter()
        .filter_map(|entry| match entry {
            Entry::Dir(name) => Some((join_rel(rel, name), abs.join(name))),
            Entry::Note(_) => None,
        })
        .collect()
}

/// Depth first, in the sorted order: the folder ids and the notes' files.
fn flatten(
    rel: &str,
    listings: &HashMap<String, Listing>,
    folders: &mut Vec<String>,
    files: &mut Vec<FileRef>,
) {
    let Some(listing) = listings.get(rel) else {
        return;
    };
    for entry in &listing.entries {
        let child = join_rel(rel, entry.name());
        match entry {
            Entry::Dir(_) => {
                folders.push(child.clone());
                flatten(&child, listings, folders, files);
            }
            Entry::Note(name) => files.push(FileRef {
                abs: listing.abs.join(name),
                rel: child,
                folder: (!rel.is_empty()).then(|| rel.to_string()),
            }),
        }
    }
}

/// The scan, with the default read size.
pub fn scan_vault_dir(vault: &Path) -> Result<ScanResult, String> {
    scan_with(vault, HEAD_CHUNK)
}

/// The scan, with the size of the first read as a parameter so a test can make the notes outgrow it.
pub fn scan_with(vault: &Path, chunk: usize) -> Result<ScanResult, String> {
    // The folders level by level, each level in parallel. The root is read alone: if it cannot be, that is an error
    let root =
        list_dir(vault, true).map_err(|err| format!("cannot read the vault folder: {err}"))?;
    let mut level = subdirs("", vault, &root);
    let mut listings = HashMap::new();
    listings.insert(
        String::new(),
        Listing {
            abs: vault.to_path_buf(),
            entries: root,
        },
    );
    while !level.is_empty() {
        // A subfolder that cannot be read is only skipped: it stays a folder, with nothing in it
        let lists = par_map(&level, |(_, abs)| list_dir(abs, false).unwrap_or_default());
        let mut next = Vec::new();
        for ((rel, abs), entries) in level.into_iter().zip(lists) {
            next.extend(subdirs(&rel, &abs, &entries));
            listings.insert(rel, Listing { abs, entries });
        }
        level = next;
    }
    let (mut folder_ids, mut files) = (Vec::new(), Vec::new());
    flatten("", &listings, &mut folder_ids, &mut files);

    // The heads of the notes, in parallel; a file that cannot be read, or has no id, is no note
    let heads = par_map(&files, |file| scan_file(&file.abs, chunk).ok().flatten());
    let mut notes: Vec<ScannedNote> = Vec::new();
    let mut at: HashMap<String, usize> = HashMap::new();
    for (file, scanned) in files.into_iter().zip(heads) {
        let Some((head, mtime_ms, size)) = scanned else {
            continue;
        };
        // The folder a note sits in wins over the one its frontmatter remembers
        let folder_id = file.folder.clone().or_else(|| head.folder_id.clone());
        put_note(
            &mut notes,
            &mut at,
            noted(head, folder_id, file.rel, mtime_ms, size),
        );
    }

    let ranks = folder_ranks(vault);
    let folders = folder_ids
        .into_iter()
        .map(|id| {
            let (name, parent_id) = match id.rfind('/') {
                Some(slash) => (id[slash + 1..].to_string(), Some(id[..slash].to_string())),
                None => (id.clone(), None),
            };
            ScannedFolder {
                order: ranks.get(&id).cloned(),
                id,
                name,
                parent_id,
            }
        })
        .collect();
    Ok(ScanResult {
        notes,
        folders,
        trash_count: trash_count(vault),
    })
}

fn noted(
    head: Head,
    folder_id: Option<String>,
    path: String,
    mtime_ms: u64,
    size: u64,
) -> ScannedNote {
    ScannedNote {
        id: head.id,
        title: head.title,
        folder_id,
        created_at: head.created_at,
        updated_at: head.updated_at,
        order: head.order,
        kind: head.kind,
        path,
        mtime_ms,
        size,
    }
}

/// As `new Map(items.map(...))` in loadVault: a repeated id keeps its first place and the last file.
fn put_note(notes: &mut Vec<ScannedNote>, at: &mut HashMap<String, usize>, note: ScannedNote) {
    match at.get(&note.id) {
        Some(&place) => notes[place] = note,
        None => {
            at.insert(note.id.clone(), notes.len());
            notes.push(note);
        }
    }
}

/// The trash's notes, with the default read size.
pub fn scan_trash_dir(vault: &Path) -> Result<Vec<ScannedNote>, String> {
    scan_trash_with(vault, HEAD_CHUNK)
}

/// `scan_trash_dir`, with the size of the first read as a parameter so a test can make the notes outgrow it.
pub fn scan_trash_with(vault: &Path, chunk: usize) -> Result<Vec<ScannedNote>, String> {
    let dir = vault.join(TRASH_DIR);
    let entries = match fs::read_dir(&dir) {
        Ok(entries) => entries,
        Err(err) if err.kind() == io::ErrorKind::NotFound => return Ok(Vec::new()),
        Err(err) => return Err(format!("cannot read the trash folder: {err}")),
    };
    // The same files `trash_count` counts: `.md` directly in the folder, a dot name too (a trashed note keeps its own name)
    let mut names: Vec<String> = entries
        .flatten()
        .filter(|entry| entry.file_type().is_ok_and(|kind| kind.is_file()))
        .filter_map(|entry| entry.file_name().into_string().ok())
        .filter(|name| ends_with_md(name))
        .collect();
    names.sort_by_cached_key(|name| (name.to_lowercase(), name.clone()));
    let heads = par_map(&names, |name| {
        scan_file(&dir.join(name), chunk).ok().flatten()
    });
    let mut notes: Vec<ScannedNote> = Vec::new();
    let mut at: HashMap<String, usize> = HashMap::new();
    for (name, scanned) in names.into_iter().zip(heads) {
        let Some((head, mtime_ms, size)) = scanned else {
            continue;
        };
        // Where it was before it was trashed is the frontmatter's; the file itself sits in `.trash`
        let folder_id = head.folder_id.clone();
        let path = format!("{TRASH_DIR}/{name}");
        put_note(
            &mut notes,
            &mut at,
            noted(head, folder_id, path, mtime_ms, size),
        );
    }
    Ok(notes)
}

/// The `.md` files directly in `.trash`, not parsed: so a trashed note with no id, or one whose id is also live, still counts.
fn trash_count(vault: &Path) -> usize {
    fs::read_dir(vault.join(TRASH_DIR)).map_or(0, |entries| {
        entries
            .flatten()
            .filter(|entry| {
                entry.file_type().is_ok_and(|kind| kind.is_file())
                    && entry.file_name().to_str().is_some_and(ends_with_md)
            })
            .count()
    })
}

/// `loadFolderOrder`: the numbers of the top-level object of `.folder-order.json`; a missing or unreadable file is no order at all.
/// ponytail: a file that is a JSON array counts as no order here, while the app would read its indices as folder ids.
fn folder_ranks(vault: &Path) -> HashMap<String, Number> {
    let Ok(bytes) = fs::read(vault.join(FOLDER_ORDER_FILE)) else {
        return HashMap::new();
    };
    let text = String::from_utf8_lossy(&bytes);
    match serde_json::from_str(text.strip_prefix('\u{feff}').unwrap_or(&text)) {
        Ok(Value::Object(map)) => map
            .into_iter()
            .filter_map(|(id, rank)| match rank {
                Value::Number(rank) => Some((id, rank)),
                _ => None,
            })
            .collect(),
        _ => HashMap::new(),
    }
}

// ---------------------------------------------------------------------------
// One note: the frontmatter subset of `parseNoteFile`
// ---------------------------------------------------------------------------

struct Head {
    id: String,
    title: String,
    folder_id: Option<String>,
    created_at: Option<String>,
    updated_at: Option<String>,
    order: Option<Number>,
    kind: Kind,
}

/// JavaScript's whitespace (`trim`, the regex `\s`), which is not Rust's: Rust trims U+0085 and not U+FEFF.
fn js_space(c: char) -> bool {
    matches!(
        c,
        '\t'..='\r'
            | ' '
            | '\u{a0}'
            | '\u{1680}'
            | '\u{2000}'..='\u{200a}'
            | '\u{2028}'
            | '\u{2029}'
            | '\u{202f}'
            | '\u{205f}'
            | '\u{3000}'
            | '\u{feff}'
    )
}

/// One pair of surrounding quotes goes (a lone quote character counts as a pair with itself, as in `parseYamlFrontmatter`).
fn unquote(value: &str) -> &str {
    let quoted = |quote: char| value.starts_with(quote) && value.ends_with(quote);
    if quoted('"') || quoted('\'') {
        value.get(1..value.len() - 1).unwrap_or("")
    } else {
        value
    }
}

fn number(n: f64) -> Option<Number> {
    if !n.is_finite() {
        None
    } else if n.fract() == 0.0 && n.abs() < 9.0e15 {
        Some(Number::from(n as i64))
    } else {
        Number::from_f64(n)
    }
}

/// `Number(text)` for a rank: decimal with an optional exponent, or 0x, 0o, 0b; none unless it is finite.
/// ponytail: a hex, octal or binary rank above 2^64 is none here and a big number in the app.
fn js_number(text: &str) -> Option<Number> {
    let radix = match text.get(..2) {
        Some("0x" | "0X") => 16,
        Some("0o" | "0O") => 8,
        Some("0b" | "0B") => 2,
        _ => 10,
    };
    if radix == 10 {
        return number(text.parse().ok()?);
    }
    let digits = &text[2..];
    if digits.starts_with('+') {
        return None;
    }
    number(u64::from_str_radix(digits, radix).ok()? as f64)
}

/// `\r\n` becomes `\n`, as `parseNoteFile` does before it looks at anything.
fn lf(bytes: &[u8]) -> Vec<u8> {
    let mut out = Vec::with_capacity(bytes.len());
    for (at, &byte) in bytes.iter().enumerate() {
        if byte != b'\r' || bytes.get(at + 1) != Some(&b'\n') {
            out.push(byte);
        }
    }
    out
}

/// What the first `buf.len()` bytes of a file say: `Some(None)` it is no note, `Some(Some(head))` it is, `None` more bytes are
/// needed (only while `eof` is false). A note is `---\n`, the frontmatter, then the first `\n---` found from byte 4 (so `---\n---\n`
/// does not close an empty block), with an id.
fn parse_head(buf: &[u8], eof: bool) -> Option<Option<Head>> {
    let text = lf(buf.strip_prefix(b"\xEF\xBB\xBF").unwrap_or(buf));
    if text.len() < 4 && !eof {
        return None;
    }
    if !text.starts_with(b"---\n") {
        return Some(None);
    }
    let Some(close) = text[4..].windows(4).position(|window| window == b"\n---") else {
        return if eof { Some(None) } else { None };
    };
    let fence = 4 + close;

    // The kind needs the first characters of the body: after the fence, one newline, then JavaScript's whitespace, then "```"
    let body = &text[fence + 4..];
    let body = String::from_utf8_lossy(body.strip_prefix(b"\n").unwrap_or(body));
    let start = body.trim_start_matches(js_space);
    if !eof && start.len() < 8 {
        return None;
    }
    let kind = if start.starts_with("```") {
        Kind::Code
    } else {
        Kind::Note
    };

    let block = String::from_utf8_lossy(&text[4..fence]);
    let (mut id, mut title, mut folder_id, mut created_at, mut updated_at, mut order) =
        (None, None, None, None, None, None);
    for line in block.split('\n') {
        let Some(colon) = line.find(':').filter(|&colon| colon > 0) else {
            continue;
        };
        let value = Some(unquote(line[colon + 1..].trim_matches(js_space)));
        match line[..colon].trim_matches(js_space) {
            "id" => id = value,
            "title" => title = value,
            "folderId" => folder_id = value,
            "createdAt" => created_at = value,
            "updatedAt" => updated_at = value,
            "order" => order = value,
            _ => {}
        }
    }
    let id = id.unwrap_or("");
    if id.is_empty() {
        return Some(None);
    }
    Some(Some(Head {
        id: id.to_string(),
        title: title.unwrap_or("").to_string(),
        folder_id: folder_id
            .filter(|id| !id.is_empty() && *id != "null")
            .map(str::to_string),
        created_at: created_at.map(str::to_string),
        updated_at: updated_at.map(str::to_string),
        order: order.filter(|rank| !rank.is_empty()).and_then(js_number),
        kind,
    }))
}

/// The head of one file with its modified time (ms) and size: only as many bytes as `parse_head` needs.
fn scan_file(path: &Path, chunk: usize) -> io::Result<Option<(Head, u64, u64)>> {
    let mut file = File::open(path)?;
    let meta = file.metadata()?;
    let mtime_ms = meta
        .modified()
        .ok()
        .and_then(|time| time.duration_since(UNIX_EPOCH).ok())
        .map_or(0, |since| since.as_millis() as u64);
    let mut buf = Vec::new();
    let mut want = chunk.max(16);
    loop {
        let missing = want - buf.len();
        let got = file.by_ref().take(missing as u64).read_to_end(&mut buf)?;
        if let Some(head) = parse_head(&buf, got < missing) {
            return Ok(head.map(|head| (head, mtime_ms, meta.len())));
        }
        want *= 2;
    }
}

/// `parseNoteFile(text).body` of the whole file: undecoded bytes become U+FFFD, the byte order mark and `\r\n` go, and a note's body
/// is what follows its closing fence minus one newline; a file with no frontmatter is all body.
fn read_body(path: &Path) -> io::Result<String> {
    let bytes = fs::read(path)?;
    let text = String::from_utf8_lossy(&bytes);
    let text = text
        .strip_prefix('\u{feff}')
        .unwrap_or(&text)
        .replace("\r\n", "\n");
    if text.starts_with("---\n") {
        if let Some(close) = text[4..].find("\n---") {
            let body = &text[4 + close + 4..];
            return Ok(body.strip_prefix('\n').unwrap_or(body).to_string());
        }
    }
    Ok(text)
}
