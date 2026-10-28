use std::path::PathBuf;
use std::process::Command;

fn main() {
    if std::env::var("CARGO_CFG_TARGET_OS").as_deref() == Ok("macos") {
        system_iconv();
    }
    tauri_build::build()
}

// Nix's libiconv and libcharset belong to the host architecture and cannot ship with the app.
// SDK stubs link the system copies for both Intel and Apple Silicon.
fn system_iconv() {
    // xcrun outside the Nix SDK that devenv points it to
    let sdk = Command::new("/usr/bin/xcrun")
        .env_remove("DEVELOPER_DIR")
        .env_remove("SDKROOT")
        .args(["--sdk", "macosx", "--show-sdk-path"])
        .output()
        .ok()
        .filter(|out| out.status.success())
        .map(|out| PathBuf::from(String::from_utf8_lossy(&out.stdout).trim()));
    let Some(sdk) = sdk else {
        println!("cargo:warning=no macOS SDK found: libiconv and libcharset may be linked from /nix/store");
        return;
    };
    // Only these stubs, so the rest of the link keeps its libraries.
    let dir = PathBuf::from(std::env::var("OUT_DIR").unwrap()).join("iconv");
    std::fs::create_dir_all(&dir).unwrap();
    // libiconv reexports the versioned libcharset.1 name.
    for name in ["libiconv", "libcharset.1"] {
        let stub = sdk.join(format!("usr/lib/{name}.tbd"));
        // The Nix linker rejects SDK targets it doesn't know.
        let text = std::fs::read_to_string(&stub).unwrap();
        let text = ["arm64e.x1-macos", "arm64e.x1-maccatalyst"].iter().fold(text, |text, target| drop_target(&text, target));
        std::fs::write(dir.join(format!("{name}.tbd")), text).unwrap();
    }
    println!("cargo:rustc-link-search=native={}", dir.display());
    println!("cargo:rerun-if-changed=build.rs");
}

// Removes `target` from the YAML lists of a .tbd stub, with the comma that separates it.
fn drop_target(text: &str, target: &str) -> String {
    let mut out = String::new();
    let mut rest = text;
    while let Some(i) = rest.find(target) {
        let head = rest[..i].trim_end();
        rest = &rest[i + target.len()..];
        match head.strip_suffix(',') {
            Some(head) => out.push_str(head),
            // first in its list: the comma comes after it
            None => {
                out.push_str(head);
                out.push(' ');
                rest = rest.trim_start().strip_prefix(',').unwrap_or(rest);
            }
        }
    }
    out + rest
}
