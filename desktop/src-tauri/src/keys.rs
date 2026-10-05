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

// Replaces the current selection; an empty replacement deletes it.
pub fn type_text(text: &str) -> bool {
    #[cfg(target_os = "macos")]
    {
        input_text(text, try_paste, type_unicode)
    }
    #[cfg(not(target_os = "macos"))]
    {
        type_unicode(text)
    }
}

#[cfg(target_os = "macos")]
fn input_text(text: &str, try_paste: impl FnOnce(&str) -> Option<bool>, type_unicode: impl FnOnce(&str) -> bool) -> bool {
    // Pasting avoids native text substitutions as well as split Unicode keyboard events.
    if !text.is_empty() {
        if let Some(result) = try_paste(text) {
            return result;
        }
    }
    type_unicode(text)
}

fn type_unicode(text: &str) -> bool {
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
    try_paste(text).unwrap_or(false)
}

// None means no keyboard input was sent, so typing is still safe.
fn try_paste(text: &str) -> Option<bool> {
    let mut clipboard = arboard::Clipboard::new().ok()?;
    let previous = Saved::take(&mut clipboard)?;
    let setter = clipboard.set();
    #[cfg(target_os = "macos")]
    let setter = {
        use arboard::SetExtApple;
        setter.exclude_from_history()
    };
    if setter.text(text).is_err() {
        previous.restore(&mut clipboard);
        return None;
    }
    let pasted = command('v');
    // the app reads the clipboard after it gets the keys
    sleep(Duration::from_millis(300));
    previous.restore(&mut clipboard);
    Some(pasted)
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

#[cfg(all(test, target_os = "macos"))]
mod tests {
    use super::input_text;
    use std::cell::Cell;

    #[test]
    fn deletes_without_touching_the_clipboard() {
        assert!(input_text("", |_| panic!("deletion must not access the clipboard"), |actual| actual.is_empty()));
    }

    #[test]
    fn pastes_long_text_once_without_also_typing_it() {
        let text = "Une longue phrase corrigée.\nUne autre ligne.";
        assert!(input_text(text, |actual| Some(actual == text), |_| panic!("a submitted paste must not be followed by typing")));
    }

    #[test]
    fn pastes_short_text_exactly_without_triggering_keyboard_substitutions() {
        for text in ["créneau", "j'ai", "l'agenda", "--", "👍"] {
            assert!(input_text(text, |actual| Some(actual == text), |_| panic!("pasted text must not be typed again")));
        }
    }

    #[test]
    fn types_long_text_when_clipboard_preparation_is_refused() {
        let text = "Une correction avec plus de vingt caractères.";
        let typed = Cell::new(0);
        assert!(input_text(text, |_| None, |actual| { typed.set(typed.get() + 1); actual == text }));
        assert_eq!(typed.get(), 1);
    }

    #[test]
    fn does_not_type_again_after_an_attempted_paste_reports_failure() {
        assert!(!input_text("Une correction avec plus de vingt caractères.", |_| Some(false), |_| panic!("an attempted paste must never be repeated")));
    }
}
