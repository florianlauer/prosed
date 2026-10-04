// Checks the accessibility layer against a running app, without the UI:
//   cargo run --example probe -- <pid> <word> [replacement]
use prosed_lib::platform::{self, Platform};

fn main() {
    let mut args = std::env::args().skip(1);
    let pid = args.next().expect("pid").parse().expect("pid is a number");
    let word = args.next().expect("a word of the field's text");
    let replacement = args.next();

    let mut platform = Platform::new();
    println!("trusted: {}", platform::trusted(false));
    println!("frontmost: {:?}", platform.frontmost());
    let field = platform.focused(pid).expect("no focused text field in this app");
    let text = field.text().expect("no text");
    println!("text: {text:?}");
    println!("frame: {:?}", field.frame());
    let byte = text.find(&word).expect("word not in the text");
    let start = text[..byte].encode_utf16().count();
    let end = start + word.encode_utf16().count();
    println!("bounds of {word:?} [{start}, {end}): {:?}", field.bounds(start, end));
    println!("selection: {:?}", field.selection());
    if let Some(replacement) = replacement {
        println!("replace: {}", field.replace(start, end, &replacement));
        println!("text after: {:?}", field.text());
    }
}
