// Typing and the clipboard, for apps whose fields can't be edited through accessibility,
// and for the rewrite shortcut in apps that don't expose their selection.
use enigo::{Direction, Enigo, Key, Keyboard, Settings};
use std::thread::sleep;
use std::time::{Duration, Instant};

#[cfg(target_os = "macos")]
const COMMAND: Key = Key::Meta;
#[cfg(not(target_os = "macos"))]
const COMMAND: Key = Key::Control;

fn enigo() -> Option<Enigo> {
    Enigo::new(&Settings::default()).ok()
}

// Types over the current selection; an empty replacement deletes it. For Windows fields, and
// for Chromium ones that ignore a new AXSelectedText.
pub fn type_text(text: &str) -> bool {
    let Some(mut enigo) = enigo() else { return false };
    if text.is_empty() {
        enigo.key(Key::Backspace, Direction::Click).is_ok()
    } else {
        enigo.text(text).is_ok()
    }
}

// Cmd+letter on macOS, Ctrl+letter elsewhere.
fn command(letter: char) -> bool {
    let Some(mut enigo) = enigo() else { return false };
    let pressed = enigo.key(COMMAND, Direction::Press).is_ok() && enigo.key(Key::Unicode(letter), Direction::Click).is_ok();
    let _ = enigo.key(COMMAND, Direction::Release);
    pressed
}

// Copies the selection of the frontmost app. A marker in the clipboard tells an empty
// selection from a slow app; the user's clipboard comes back afterwards (see `Saved`).
pub fn copy_selection() -> Option<String> {
    const MARKER: &str = "\u{2063}prosed\u{2063}";
    let mut clipboard = arboard::Clipboard::new().ok()?;
    let previous = Saved::take(&mut clipboard)?;
    clipboard.set_text(MARKER).ok()?;
    command('c');
    let start = Instant::now();
    let mut copied = None;
    while start.elapsed() < Duration::from_millis(600) {
        sleep(Duration::from_millis(40));
        match clipboard.get_text() {
            Ok(text) if text != MARKER => {
                copied = Some(text);
                break;
            }
            _ => {}
        }
    }
    previous.restore(&mut clipboard);
    copied.filter(|t| !t.trim().is_empty())
}

// Pastes over the selection of the frontmost app, then puts the user's clipboard back.
pub fn paste(text: &str) -> bool {
    let Ok(mut clipboard) = arboard::Clipboard::new() else { return false };
    let Some(previous) = Saved::take(&mut clipboard) else { return false };
    if clipboard.set_text(text).is_err() {
        return false;
    }
    let pasted = command('v');
    // the app reads the clipboard after it gets the keys
    sleep(Duration::from_millis(300));
    previous.restore(&mut clipboard);
    pasted
}

// What the clipboard held, to put back afterwards: files, HTML with its text, or text.
// ponytail: formats that come with text (RTF, an app's own types) come back as that text;
// arboard can't read them, and per-platform pasteboard code would be needed to keep them.
enum Saved {
    Files(Vec<std::path::PathBuf>),
    Html(String, Option<String>),
    Text(String),
}

impl Saved {
    // None when the clipboard holds an image, or nothing arboard reads, which can't be put
    // back as it was. An empty clipboard is refused too, which costs little.
    fn take(clipboard: &mut arboard::Clipboard) -> Option<Saved> {
        if let Ok(files) = clipboard.get().file_list() {
            if !files.is_empty() {
                return Some(Saved::Files(files));
            }
        }
        if clipboard.get_image().is_ok() {
            return None;
        }
        let text = clipboard.get_text().ok();
        match (clipboard.get().html(), text) {
            (Ok(html), text) => Some(Saved::Html(html, text)),
            (Err(_), text) => text.map(Saved::Text),
        }
    }

    fn restore(self, clipboard: &mut arboard::Clipboard) {
        let _ = match self {
            Saved::Files(files) => clipboard.set().file_list(&files),
            Saved::Html(html, text) => clipboard.set().html(html, text),
            Saved::Text(text) => clipboard.set_text(text),
        };
    }
}
