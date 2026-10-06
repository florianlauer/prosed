// Reading and editing the focused text field of another app: the Accessibility API on macOS,
// UI Automation on Windows. Offsets are UTF-16 code units, like JavaScript strings.
// Coordinates are screen coordinates with the origin at the top left: points on macOS,
// physical pixels on Windows.

use serde::{Deserialize, Serialize};

#[derive(Clone, Copy, Debug, PartialEq)]
pub enum Replacement {
    Applied,
    // No text-edit request was sent; a verified clipboard fallback is still safe.
    Untouched,
    // An edit was sent and may still arrive, so it must not be retried.
    Unconfirmed,
}

#[cfg(target_os = "macos")]
mod macos;
#[cfg(target_os = "macos")]
pub use macos::*;

#[cfg(windows)]
mod windows;
#[cfg(windows)]
pub use self::windows::*;

#[cfg(not(any(target_os = "macos", windows)))]
mod unsupported;
#[cfg(not(any(target_os = "macos", windows)))]
pub use unsupported::*;

// AppKit autoreleases objects on every call, and a thread without a run loop has no pool to free them.
#[cfg(target_os = "macos")]
pub fn pooled<T>(f: impl FnOnce() -> T) -> T {
    objc2::rc::autoreleasepool(|_| f())
}

#[cfg(not(target_os = "macos"))]
pub fn pooled<T>(f: impl FnOnce() -> T) -> T {
    f()
}

// An app as the settings list it: a bundle identifier on macOS, an executable name on Windows.
#[derive(Clone, Debug, PartialEq, Serialize, Deserialize)]
pub struct App {
    pub id: String,
    pub name: String,
}

#[derive(Clone, Copy, Debug, PartialEq, Serialize, Deserialize)]
pub struct Rect {
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
}

impl Rect {
    pub fn contains(&self, (x, y): (f64, f64)) -> bool {
        x >= self.x && x <= self.x + self.width && y >= self.y && y <= self.y + self.height
    }
}

// Replaces the UTF-16 range [start, end) of `text`, for fields that only take a whole new value.
pub fn splice(text: &str, start: usize, end: usize, replacement: &str) -> Option<String> {
    let units: Vec<u16> = text.encode_utf16().collect();
    if start > end || end > units.len() {
        return None;
    }
    let mut out = units[..start].to_vec();
    out.extend(replacement.encode_utf16());
    out.extend_from_slice(&units[end..]);
    String::from_utf16(&out).ok()
}

pub fn slice(text: &str, start: usize, end: usize) -> Option<String> {
    let units: Vec<u16> = text.encode_utf16().collect();
    (start <= end && end <= units.len()).then(|| String::from_utf16_lossy(&units[start..end]))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn splices_by_utf16_offsets() {
        // "é" is one unit and the emoji two, as in JavaScript
        assert_eq!(splice("é 👍 ok", 5, 7, "OK").as_deref(), Some("é 👍 OK"));
        assert_eq!(slice("é 👍 ok", 2, 4).as_deref(), Some("👍"));
        assert_eq!(splice("abc", 2, 9, "x"), None);
    }
}
