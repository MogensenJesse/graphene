// src-tauri/src/fonts.rs
// The families of the fonts installed on this computer, for the font lists in Settings. The webview can list them too
// (`queryLocalFonts`), but only after a permission prompt of its own, so the list is read here instead. It is names only, no
// paths and no files, so unlike the vault scan it needs no check against the fs scope.

/// Each name once, in alphabetical order without regard to case. A font's name in two cases ("Arial", "ARIAL") is one entry, and
/// the hidden families some systems list (a leading "." or "@", the vertical variants of east Asian fonts) are left out.
pub fn unique_families<I: IntoIterator<Item = String>>(names: I) -> Vec<String> {
    let mut out: Vec<String> = names
        .into_iter()
        .map(|name| name.trim().to_owned())
        .filter(|name| !name.is_empty() && !name.starts_with(['.', '@']))
        .collect();
    out.sort_by_key(|name| name.to_lowercase());
    out.dedup_by(|a, b| a.to_lowercase() == b.to_lowercase());
    out
}

/// The families of the fonts installed on this computer (the system's font folders and, on Windows, the ones installed for
/// this user only). It reads each font file's name table, so it takes a moment.
pub fn installed_families() -> Vec<String> {
    let mut db = fontdb::Database::new();
    db.load_system_fonts();
    // A face lists its family in every language it has a name for; the first is the one to show
    unique_families(
        db.faces()
            .filter_map(|face| face.families.first().map(|(name, _)| name.clone())),
    )
}

/// The installed font families, for the list of a custom font. It runs off the main thread, and the page asks only when the
/// Custom choice comes on screen.
#[tauri::command]
pub async fn list_fonts() -> Result<Vec<String>, String> {
    tauri::async_runtime::spawn_blocking(installed_families)
        .await
        .map_err(|err| err.to_string())
}
