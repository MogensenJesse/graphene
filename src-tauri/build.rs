// src-tauri/build.rs
fn main() {
    // tauri-build embeds the Windows manifest (common controls v6, which the dialog plugin's imports need) in the app's binary only.
    // The library's test executable would not start without it (STATUS_ENTRYPOINT_NOT_FOUND), so `cargo test` gets the same manifest.
    if std::env::var("CARGO_CFG_TARGET_OS").is_ok_and(|os| os == "windows") {
        let manifest =
            std::path::Path::new(&std::env::var("OUT_DIR").unwrap()).join("test.manifest");
        std::fs::write(
            &manifest,
            r#"<assembly xmlns="urn:schemas-microsoft-com:asm.v1" manifestVersion="1.0"><dependency><dependentAssembly><assemblyIdentity type="win32" name="Microsoft.Windows.Common-Controls" version="6.0.0.0" processorArchitecture="*" publicKeyToken="6595b64144ccf1df" language="*"/></dependentAssembly></dependency></assembly>"#,
        )
        .unwrap();
        println!("cargo:rustc-link-arg-tests=/MANIFEST:EMBED");
        println!(
            "cargo:rustc-link-arg-tests=/MANIFESTINPUT:{}",
            manifest.display()
        );
    }
    tauri_build::build()
}
