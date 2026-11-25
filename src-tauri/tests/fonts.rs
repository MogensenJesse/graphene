// src-tauri/tests/fonts.rs
// Tests of src/fonts.rs: how the list of installed font families is made from the faces the system reports. An integration test,
// like the others, because build.rs gives only test targets of their own the manifest the library's imports need on Windows.

use graphene_lib::fonts::{installed_families, unique_families};

fn names(list: &[&str]) -> Vec<String> {
    list.iter().map(|s| s.to_string()).collect()
}

#[test]
fn every_family_once_in_alphabetical_order() {
    // A family has a face for each weight and style, so it comes in many times
    let out = unique_families(names(&[
        "Segoe UI", "Consolas", "Segoe UI", "Arial", "Consolas", "arial",
    ]));
    assert_eq!(out, names(&["Arial", "Consolas", "Segoe UI"]));
}

#[test]
fn sorts_without_regard_to_case() {
    let out = unique_families(names(&["zapf", "Bahnschrift", "cascadia Code", "Arial"]));
    assert_eq!(
        out,
        names(&["Arial", "Bahnschrift", "cascadia Code", "zapf"])
    );
}

#[test]
fn leaves_out_empty_and_hidden_names() {
    let out = unique_families(names(&["", "  ", ".SF NS", "@MS Gothic", "  Calibri  "]));
    assert_eq!(out, names(&["Calibri"]));
}

#[test]
fn nothing_in_nothing_out() {
    assert!(unique_families(Vec::new()).is_empty());
}

// Reads the real fonts of the computer it runs on, so it is not part of the normal run. By hand:
// cargo test --test fonts -- --ignored --nocapture   (set FONTS_OUT to a path to also save the list as JSON)
#[test]
#[ignore]
fn lists_the_fonts_of_this_computer() {
    let start = std::time::Instant::now();
    let fonts = installed_families();
    println!(
        "{} families in {:?}, the first ones: {:?}",
        fonts.len(),
        start.elapsed(),
        &fonts[..fonts.len().min(12)]
    );
    if let Ok(path) = std::env::var("FONTS_OUT") {
        std::fs::write(path, serde_json::to_string(&fonts).unwrap()).unwrap();
    }
    assert!(!fonts.is_empty());
}
