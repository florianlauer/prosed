mod config;
mod keys;
mod ollama;
pub mod platform;
mod worker;

use config::Config;
use platform::Rect;
use serde::Serialize;
use serde_json::{json, Value};
use std::path::PathBuf;
use std::sync::mpsc::{channel, Sender};
use std::sync::{Arc, Mutex};
use std::time::Duration;
use tauri::menu::{Menu, MenuItem};
use tauri::tray::TrayIconBuilder;
use tauri::{AppHandle, Emitter, Manager, WebviewUrl, WebviewWindow};
use tauri_plugin_global_shortcut::{GlobalShortcutExt, ShortcutState};
use worker::{Command, Selection};

#[cfg(target_os = "macos")]
tauri_nspanel::tauri_panel! {
    panel!(FloatingPanel {
        config: {
            can_become_key_window: false,
            can_become_main_window: false,
            is_floating_panel: true
        }
    })
}

// What the rewrite card replaces: the selection read through accessibility, or copied
// with the clipboard when the app doesn't expose it.
struct Rewrite {
    selection: Selection,
    via_clipboard: bool,
}

#[derive(Default)]
struct Ui {
    overlay: Option<Rect>,
    card_anchor: Option<Rect>,
    // the card lines up with the end of its anchor, like the extension's panel under its badge
    card_end: bool,
    // where place_card put the card, since reading it back from the window has the same scale issue
    card_frame: Option<Rect>,
    card_visible: bool,
    rewrite: Option<Rewrite>,
    // the last show_card or hide_card the overlay sent: async commands can arrive out of order,
    // and an older show_card must not bring back a card hidden since
    card_seq: u64,
    // the last place_card: the card's page sends one per change of size, and an older one
    // landing last would size the card for content it no longer has
    place_seq: u64,
    // bumped when the card is closed or turned into a rewrite by something other than the
    // overlay, which learns it through "card-hidden": what it sent before is stale
    card_epoch: u64,
}

impl Ui {
    // Whether a show_card or hide_card from the overlay is still the latest word on the card.
    fn current(&mut self, seq: u64, epoch: u64) -> bool {
        if seq < self.card_seq || epoch < self.card_epoch {
            return false;
        }
        self.card_seq = seq;
        true
    }

    // The card was taken over by its own buttons or the shortcut.
    fn taken(&mut self, app: &AppHandle) {
        self.card_epoch += 1;
        let _ = app.emit_to("overlay", "card-hidden", self.card_epoch);
    }
}

struct Shared {
    config: Arc<Mutex<Config>>,
    config_path: PathBuf,
    worker: Mutex<Sender<Command>>,
    ui: Mutex<Ui>,
}

// Screen units per CSS pixel: AX gives points on macOS, UI Automation physical pixels on Windows.
fn scale(window: &WebviewWindow) -> f64 {
    if cfg!(target_os = "macos") {
        1.0
    } else {
        window.scale_factor().unwrap_or(1.0)
    }
}

// Tao converts logical positions with one scale factor, which misplaces windows when the
// screens have different ones, so on macOS the frame is set in Cocoa coordinates directly.
#[cfg(target_os = "macos")]
fn place(window: &WebviewWindow, r: Rect) {
    let target = window.clone();
    let _ = window.run_on_main_thread(move || {
        use objc2_app_kit::NSWindow;
        use objc2_foundation::{NSPoint, NSRect, NSSize};
        let Ok(ns) = target.ns_window() else { return };
        // Cocoa's origin is the bottom left of the menu bar screen
        let top = core_graphics::display::CGDisplay::main().bounds().size.height;
        let frame = NSRect::new(NSPoint::new(r.x, top - r.y - r.height), NSSize::new(r.width, r.height));
        unsafe { (*(ns as *const NSWindow)).setFrame_display(frame, true) };
    });
}

#[cfg(not(target_os = "macos"))]
fn place(window: &WebviewWindow, r: Rect) {
    let _ = window.set_position(tauri::PhysicalPosition::new(r.x as i32, r.y as i32));
    let _ = window.set_size(tauri::PhysicalSize::new(r.width as u32, r.height as u32));
}

// The screen around a point, in screen units.
#[cfg(target_os = "macos")]
fn screen_at(_app: &AppHandle, (x, y): (f64, f64)) -> Option<Rect> {
    use core_graphics::display::CGDisplay;
    CGDisplay::active_displays().ok()?.into_iter().map(|id| CGDisplay::new(id).bounds()).find_map(|b| {
        let r = Rect { x: b.origin.x, y: b.origin.y, width: b.size.width, height: b.size.height };
        r.contains((x, y)).then_some(r)
    })
}

#[cfg(not(target_os = "macos"))]
fn screen_at(app: &AppHandle, (x, y): (f64, f64)) -> Option<Rect> {
    let monitor = app.monitor_from_point(x, y).ok()??;
    let (position, size) = (monitor.position(), monitor.size());
    Some(Rect { x: position.x as f64, y: position.y as f64, width: size.width as f64, height: size.height as f64 })
}

// Shows the overlay and the card without taking the keyboard from the app being typed in.
fn set_visible(app: &AppHandle, label: &str, visible: bool) {
    #[cfg(target_os = "macos")]
    {
        use tauri_nspanel::ManagerExt;
        // AppKit ignores panel calls from other threads, and ticks come from the worker thread
        let (handle, label) = (app.clone(), label.to_string());
        let _ = app.run_on_main_thread(move || {
            if let Ok(panel) = handle.get_webview_panel(&label) {
                if visible {
                    panel.show()
                } else {
                    panel.hide()
                }
            }
        });
    }
    #[cfg(not(target_os = "macos"))]
    if let Some(window) = app.get_webview_window(label) {
        let _ = if visible { window.show() } else { window.hide() };
    }
}

fn floating_window(app: &AppHandle, label: &str, page: &str, click_through: bool) -> tauri::Result<WebviewWindow> {
    #[cfg(target_os = "macos")]
    let window = {
        use tauri_nspanel::{CollectionBehavior, PanelBuilder, PanelLevel, StyleMask};
        let panel = PanelBuilder::<_, FloatingPanel>::new(app, label)
            .url(WebviewUrl::App(page.into()))
            .level(PanelLevel::Floating)
            .transparent(true)
            .has_shadow(false)
            .no_activate(true)
            .add_style_mask(StyleMask::empty().nonactivating_panel())
            .collection_behavior(CollectionBehavior::new().can_join_all_spaces().full_screen_auxiliary().ignores_cycle())
            .with_window(|w| w.transparent(true).decorations(false).resizable(false).skip_taskbar(true).visible(false).accept_first_mouse(true))
            .build()?;
        panel.set_ignores_mouse_events(click_through);
        // not panel.to_window(): that turns the panel back into a plain window
        let window = app.get_webview_window(label).expect("the panel has a window");
        // AppKit only reads the nonactivating style when a window is created, and the builder
        // adds it later, so a click would still activate this app. This private call applies it.
        if let Ok(ns) = window.ns_window() {
            use objc2::runtime::{AnyObject, Bool, Sel};
            let ns = ns as *mut AnyObject;
            let sel = Sel::register(c"_setPreventsActivation:");
            unsafe {
                let responds: Bool = objc2::msg_send![ns, respondsToSelector: sel];
                if responds.as_bool() {
                    let _: () = objc2::msg_send![ns, _setPreventsActivation: Bool::YES];
                }
            }
        }
        window
    };
    #[cfg(not(target_os = "macos"))]
    let window = {
        let window = tauri::WebviewWindowBuilder::new(app, label, WebviewUrl::App(page.into()))
            .transparent(true)
            .decorations(false)
            .shadow(false)
            .always_on_top(true)
            .skip_taskbar(true)
            .resizable(false)
            .focusable(false)
            .focused(false)
            .visible(false)
            .build()?;
        window.set_ignore_cursor_events(click_through)?;
        window
    };
    Ok(window)
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct TickPayload {
    app: Option<platform::App>,
    // which field `text` is from, see FieldState
    id: u64,
    text: Option<String>,
    // the field, in the overlay's CSS pixels
    field: Rect,
    marks: Vec<Vec<Rect>>,
    cursor: (f64, f64),
    over_card: bool,
}

// Runs on the worker thread after each look at the focused field. Window calls wait for
// the main thread, so no lock is held during them.
fn on_tick(app: &AppHandle, shared: &Shared, tick: worker::Tick) {
    if let Some(seen) = &tick.app {
        let mut config = shared.config.lock().unwrap();
        if !config.seen_apps.contains(seen) {
            config.seen_apps.push(seen.clone());
            if let Err(e) = config.save(&shared.config_path) {
                eprintln!("couldn't save the settings: {e}");
            }
            let config = config.clone();
            let _ = app.emit("config", config);
        }
    }
    let Some(overlay) = app.get_webview_window("overlay") else { return };
    let Some(field) = tick.field else {
        let (was_shown, hide_card) = {
            let mut ui = shared.ui.lock().unwrap();
            let was_shown = ui.overlay.take().is_some();
            // a fix card belongs to the field; a rewrite card stays until it is used or closed
            // also one show_card set up but place_card hasn't shown yet
            let hide_card = was_shown && ui.rewrite.is_none() && (ui.card_visible || ui.card_anchor.is_some());
            if hide_card {
                ui.card_visible = false;
                ui.card_anchor = None;
            }
            (was_shown, hide_card)
        };
        if was_shown {
            set_visible(app, "overlay", false);
            if hide_card {
                set_visible(app, "card", false);
            }
            let _ = overlay.emit_to("overlay", "tick", json!({ "app": tick.app, "text": null }));
        }
        return;
    };
    // room around the field for underlines on its first and last lines
    let margin = 8.0;
    let frame = Rect {
        x: field.frame.x - margin,
        y: field.frame.y - margin,
        width: field.frame.width + 2.0 * margin,
        height: field.frame.height + 2.0 * margin,
    };
    let (previous, card_visible, card_frame) = {
        let mut ui = shared.ui.lock().unwrap();
        (ui.overlay.replace(frame), ui.card_visible, ui.card_frame)
    };
    if previous != Some(frame) {
        place(&overlay, frame);
    }
    if previous.is_none() {
        set_visible(app, "overlay", true);
    }
    let s = scale(&overlay);
    let local = |r: &Rect| Rect { x: (r.x - frame.x) / s, y: (r.y - frame.y) / s, width: r.width / s, height: r.height / s };
    let over_card = card_visible && card_frame.is_some_and(|r| r.contains(tick.cursor));
    let payload = TickPayload {
        app: tick.app,
        id: field.id,
        text: Some(field.text),
        field: local(&field.frame),
        marks: field.marks.iter().map(|rects| rects.iter().map(local).collect()).collect(),
        cursor: ((tick.cursor.0 - frame.x) / s, (tick.cursor.1 - frame.y) / s),
        over_card,
    };
    let _ = overlay.emit_to("overlay", "tick", payload);
}

#[tauri::command]
fn get_config(shared: tauri::State<'_, Arc<Shared>>) -> Config {
    shared.config.lock().unwrap().clone()
}

// Commands marked async run off the main thread: they wait on the worker thread, which
// waits on the main thread for window calls.
// Takes only the keys that change, as chrome.storage.sync.set does, so windows saving at the
// same time don't undo each other. The keys of `core` are merged the same way.
#[tauri::command(async)]
fn save_config(app: AppHandle, shared: tauri::State<'_, Arc<Shared>>, changes: Value) -> Result<(), String> {
    update_config(&app, &shared, |config| {
        let mut value = serde_json::to_value(&*config).map_err(|e| e.to_string())?;
        if let Value::Object(changes) = changes {
            for (key, change) in changes {
                match (key.as_str(), change) {
                    ("core", Value::Object(core)) => {
                        if !value["core"].is_object() {
                            value["core"] = json!({});
                        }
                        for (key, change) in core {
                            value["core"][key] = change;
                        }
                    }
                    (_, change) => value[key] = change,
                }
            }
        }
        *config = serde_json::from_value(value).map_err(|e| e.to_string())?;
        Ok(())
    })
}

// Lists `app` or forgets it, and turns it on or off, from the current config rather than a
// window's copy of the lists, so the settings and the card can't undo each other's changes.
#[tauri::command(async)]
fn set_app(app: AppHandle, shared: tauri::State<'_, Arc<Shared>>, target: platform::App, listed: bool, enabled: bool) -> Result<(), String> {
    update_config(&app, &shared, |config| {
        config.seen_apps.retain(|a| a.id != target.id);
        config.disabled_apps.retain(|id| *id != target.id);
        if listed {
            if !enabled {
                config.disabled_apps.push(target.id.clone());
            }
            config.seen_apps.push(target);
        }
        Ok(())
    })
}

fn update_config(app: &AppHandle, shared: &Shared, change: impl FnOnce(&mut Config) -> Result<(), String>) -> Result<(), String> {
    let config = {
        let mut config = shared.config.lock().unwrap();
        let mut next = config.clone();
        change(&mut next)?;
        // written under the lock, so an older save can't land after a newer one; kept only
        // once on disk, so the settings don't show a change a restart would lose
        next.save(&shared.config_path).map_err(|e| format!("couldn't save the settings: {e}"))?;
        *config = next;
        config.clone()
    };
    register_shortcut(app, &config);
    let _ = app.emit("config", config);
    Ok(())
}

#[tauri::command(async)]
fn set_marks(shared: tauri::State<'_, Arc<Shared>>, text: String, ranges: Vec<(usize, usize)>) {
    let _ = shared.worker.lock().unwrap().send(Command::Marks { text, ranges });
}

#[tauri::command(async)]
fn apply_fix(shared: tauri::State<'_, Arc<Shared>>, field: u64, start: usize, end: usize, replacement: String, expected: String) -> bool {
    let (reply, done) = channel();
    let _ = shared.worker.lock().unwrap().send(Command::Apply { field, start, end, replacement, expected, reply });
    done.recv_timeout(Duration::from_secs(2)).unwrap_or(false)
}

// A rect of the overlay, in its CSS pixels, on the screen.
fn on_screen(app: &AppHandle, ui: &Ui, r: Rect) -> Option<Rect> {
    let s = scale(&app.get_webview_window("overlay")?);
    let frame = ui.overlay?;
    Some(Rect { x: frame.x + r.x * s, y: frame.y + r.y * s, width: r.width * s, height: r.height * s })
}

// Shows the card next to `anchor`, a rect of the overlay: a mark, or the badge for its panel.
// The card sizes itself with place_card.
#[tauri::command(async)]
fn show_card(
    app: AppHandle,
    shared: tauri::State<'_, Arc<Shared>>,
    anchor: Rect,
    end: bool,
    payload: Value,
    seq: u64,
    epoch: u64,
) {
    let mut ui = shared.ui.lock().unwrap();
    if !ui.current(seq, epoch) {
        return;
    }
    let Some(anchor) = on_screen(&app, &ui, anchor) else { return };
    ui.card_anchor = Some(anchor);
    ui.card_end = end;
    ui.rewrite = None;
    // sent under the lock, so the card shows what the last command set, rewrite or not
    let _ = app.emit_to("card", "card", payload);
}

// Turns the open card into rewrites of `selection`, as the shortcut does, starting with `tone`.
// `anchor` is in the overlay, and without one the card stays where it is. `field` is the id of
// the field the selection is from.
#[tauri::command(async)]
fn open_rewrite_text(
    app: AppHandle,
    shared: tauri::State<'_, Arc<Shared>>,
    selection: Selection,
    tone: String,
    anchor: Option<Rect>,
    field: u64,
) {
    let text = selection.text.clone();
    let mut ui = shared.ui.lock().unwrap();
    if let Some(anchor) = anchor.and_then(|a| on_screen(&app, &ui, a)) {
        ui.card_anchor = Some(anchor);
        ui.card_end = false;
    }
    ui.rewrite = Some(Rewrite { selection, via_clipboard: false });
    ui.taken(&app);
    let _ = shared.worker.lock().unwrap().send(Command::Target { field });
    let _ = app.emit_to("card", "card", json!({ "kind": "rewrite", "text": text, "tone": tone }));
}

// Room around the card for its shadow, in CSS pixels: the same numbers as in card.css.
const PAD_X: f64 = 12.0;
const PAD_TOP: f64 = 4.0;
const PAD_BOTTOM: f64 = 16.0;

// Places the card window for a popover of `width` by `height`, and says on which side of
// its anchor it went, for the popover's open transition.
#[tauri::command(async)]
// None when a newer call came first. One call at a time, so an older one can't move the
// window after a newer one did.
fn place_card(app: AppHandle, shared: tauri::State<'_, Arc<Shared>>, width: f64, height: f64, seq: u64) -> Option<&'static str> {
    static PLACING: Mutex<()> = Mutex::new(());
    let _placing = PLACING.lock().unwrap();
    let card = app.get_webview_window("card")?;
    let (Some(anchor), end) = ({
        let mut ui = shared.ui.lock().unwrap();
        if seq < ui.place_seq {
            return None;
        }
        ui.place_seq = seq;
        (ui.card_anchor, ui.card_end)
    }) else {
        return Some("bottom");
    };
    let s = scale(&card);
    let (w, h) = (width * s, height * s);
    let gap = 6.0 * s;
    let mut x = if end { anchor.x + anchor.width - w } else { anchor.x };
    let mut y = anchor.y + anchor.height + gap;
    let mut side = "bottom";
    // above the text when there's no room below, as in the extension
    if let Some(screen) = screen_at(&app, (anchor.x, anchor.y)) {
        if y + h > screen.y + screen.height {
            y = anchor.y - h - gap;
            side = "top";
        }
        x = x.min(screen.x + screen.width - w - 8.0 * s).max(screen.x + 8.0 * s);
    }
    let r = Rect { x: x - PAD_X * s, y: y - PAD_TOP * s, width: w + 2.0 * PAD_X * s, height: h + (PAD_TOP + PAD_BOTTOM) * s };
    place(&card, r);
    {
        let mut ui = shared.ui.lock().unwrap();
        // closed while it was being placed
        if ui.card_anchor.is_none() {
            return Some(side);
        }
        ui.card_frame = Some(r);
        ui.card_visible = true;
    }
    set_visible(&app, "card", true);
    // a hide_card between the check and the show cleared the anchor: hidden again
    if shared.ui.lock().unwrap().card_anchor.is_none() {
        set_visible(&app, "card", false);
    }
    Some(side)
}

// For the overlay when its page loads, which may be a reload after the epoch moved on.
// Async like the rest: it takes the ui lock, which must not block the main thread.
#[tauri::command(async)]
fn card_epoch(shared: tauri::State<'_, Arc<Shared>>) -> u64 {
    shared.ui.lock().unwrap().card_epoch
}

#[tauri::command(async)]
// `seq` and `epoch` when the overlay sends it, see Ui::card_seq; the card itself sends neither.
fn hide_card(app: AppHandle, shared: tauri::State<'_, Arc<Shared>>, seq: Option<u64>, epoch: Option<u64>) {
    let mut ui = shared.ui.lock().unwrap();
    match seq {
        Some(seq) if !ui.current(seq, epoch.unwrap_or(0)) => return,
        // the overlay knows it closed the card: telling it late would wipe a card opened since
        Some(_) => {}
        None => ui.taken(&app),
    }
    ui.card_visible = false;
    // place_card runs off the main thread and may come late: without an anchor it does nothing
    ui.card_anchor = None;
    ui.rewrite = None;
    drop(ui);
    set_visible(&app, "card", false);
}

// Level 1: puts the rewrite in place of the selection the card was opened on.
#[tauri::command(async)]
fn replace_selection(app: AppHandle, shared: tauri::State<'_, Arc<Shared>>, text: String) -> bool {
    let rewrite = shared.ui.lock().unwrap().rewrite.take();
    hide_card(app, shared.clone(), None, None);
    let Some(rewrite) = rewrite else { return false };
    let selected = rewrite.selection.text.clone();
    if !rewrite.via_clipboard {
        let (reply, done) = channel();
        let _ = shared.worker.lock().unwrap().send(Command::ReplaceSelection { selection: rewrite.selection, text: text.clone(), reply });
        match done.recv_timeout(Duration::from_secs(2)).ok().flatten() {
            Some(true) => return true,
            // another field has the focus, or the selection changed: pasting would land somewhere else
            None => return false,
            Some(false) => {}
        }
    }
    let (reply, on_target) = channel();
    let _ = shared.worker.lock().unwrap().send(Command::OnTarget { reply });
    // pasting goes to the current selection: copying it again tells whether it moved
    on_target.recv_timeout(Duration::from_secs(2)).unwrap_or(false)
        && keys::copy_selection().as_deref() == Some(selected.as_str())
        && keys::paste(&text)
}

// The overlay lets clicks through, except on the badge while the pointer is on it.
#[tauri::command]
fn set_overlay_clickable(app: AppHandle, clickable: bool) {
    if let Some(overlay) = app.get_webview_window("overlay") {
        let _ = overlay.set_ignore_cursor_events(!clickable);
    }
}

#[tauri::command(async)]
fn running_apps() -> Vec<platform::App> {
    platform::pooled(platform::running_apps)
}

#[tauri::command]
fn show_settings(app: AppHandle) {
    open_settings(&app);
}

#[tauri::command]
fn permission(prompt: bool) -> bool {
    platform::trusted(prompt)
}

#[tauri::command]
fn open_permission_settings() {
    platform::open_permission_settings()
}

// Level 1: the shortcut reads the selection, through accessibility or the clipboard.
fn open_rewrite(app: AppHandle) {
    let shared = app.state::<Arc<Shared>>().inner().clone();
    let (reply, selection) = channel();
    let _ = shared.worker.lock().unwrap().send(Command::Selection { reply });
    let found = selection.recv_timeout(Duration::from_secs(2)).ok().flatten();
    let cursor = platform::cursor();
    // the field's text gives the model the rest of the sentence, as in the extension
    let mut field = None;
    let (rewrite, rect) = match found {
        Some((selection, rect, text)) => {
            field = Some(json!({ "text": text, "start": selection.start }));
            (Some(Rewrite { selection, via_clipboard: false }), rect)
        }
        None => {
            // let go of the shortcut's modifiers first, or the app gets Cmd+Alt+C
            std::thread::sleep(Duration::from_millis(250));
            let copied = keys::copy_selection();
            (copied.map(|text| Rewrite { selection: Selection { text, start: 0, end: 0 }, via_clipboard: true }), None)
        }
    };
    let text = rewrite.as_ref().map(|r| r.selection.text.clone());
    let mut ui = shared.ui.lock().unwrap();
    ui.card_anchor = Some(rect.unwrap_or(Rect { x: cursor.0, y: cursor.1, width: 0.0, height: 18.0 }));
    ui.card_end = false;
    ui.rewrite = rewrite;
    ui.taken(&app);
    // the shortcut also offers the fixed text, for apps where underlining is off
    let _ = app.emit_to("card", "card", json!({ "kind": "rewrite", "text": text, "fix": true, "field": field }));
}

fn register_shortcut(app: &AppHandle, config: &Config) {
    let shortcuts = app.global_shortcut();
    let _ = shortcuts.unregister_all();
    if !config.shortcut_enabled {
        return;
    }
    let registered = shortcuts.on_shortcut(config.shortcut.as_str(), |app, _, event| {
        if event.state() == ShortcutState::Pressed {
            let app = app.clone();
            std::thread::spawn(move || open_rewrite(app));
        }
    });
    if let Err(e) = registered {
        eprintln!("shortcut {}: {e}", config.shortcut);
    }
}

fn open_settings(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("settings") {
        let _ = window.show();
        let _ = window.set_focus();
    }
}

pub fn run() {
    let builder = tauri::Builder::default().plugin(tauri_plugin_global_shortcut::Builder::new().build());
    #[cfg(target_os = "macos")]
    let builder = builder.plugin(tauri_nspanel::init());
    builder
        .manage(ollama::Requests::default())
        .invoke_handler(tauri::generate_handler![
            get_config,
            save_config,
            set_app,
            card_epoch,
            set_marks,
            apply_fix,
            show_card,
            open_rewrite_text,
            place_card,
            hide_card,
            replace_selection,
            permission,
            open_permission_settings,
            set_overlay_clickable,
            running_apps,
            show_settings,
            ollama::ollama_generate,
            ollama::ollama_models,
        ])
        .setup(|app| {
            // a menu bar app: no Dock icon, no app switcher entry
            #[cfg(target_os = "macos")]
            app.set_activation_policy(tauri::ActivationPolicy::Accessory);

            let config_path = app.path().app_config_dir()?.join("config.json");
            let config = Arc::new(Mutex::new(Config::load(&config_path)));
            let handle = app.handle().clone();

            floating_window(&handle, "overlay", "overlay.html", true)?;
            floating_window(&handle, "card", "card.html", false)?;
            let settings = tauri::WebviewWindowBuilder::new(app, "settings", WebviewUrl::App("index.html".into()))
                .title("prosed")
                .inner_size(600.0, 760.0)
                .visible(false)
                .build()?;
            // closing the settings keeps the app running in the menu bar
            let window = settings.clone();
            settings.on_window_event(move |event| {
                if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                    api.prevent_close();
                    let _ = window.hide();
                }
            });

            let shared = Arc::new(Shared {
                config: config.clone(),
                config_path,
                worker: Mutex::new(channel().0),
                ui: Mutex::new(Ui::default()),
            });
            let ticks = (handle.clone(), shared.clone());
            *shared.worker.lock().unwrap() = worker::spawn(config.clone(), move |tick| on_tick(&ticks.0, &ticks.1, tick));
            app.manage(shared);
            register_shortcut(&handle, &config.lock().unwrap());

            let menu = Menu::with_items(
                app,
                &[
                    &MenuItem::with_id(app, "settings", "Settings…", true, None::<&str>)?,
                    &MenuItem::with_id(app, "quit", "Quit prosed", true, None::<&str>)?,
                ],
            )?;
            let tray = TrayIconBuilder::new();
            // a template image: macOS draws it black or white to match the menu bar
            #[cfg(target_os = "macos")]
            let tray = tray
                .icon(tauri::image::Image::from_bytes(include_bytes!("../icons/tray.png"))?)
                .icon_as_template(true);
            #[cfg(not(target_os = "macos"))]
            let tray = tray.icon(app.default_window_icon().expect("the bundle has an icon").clone());
            tray.tooltip("prosed")
                .menu(&menu)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "settings" => open_settings(app),
                    "quit" => app.exit(0),
                    _ => {}
                })
                .build(app)?;

            // the app lives in the menu bar, where the notch can hide its icon: launching it shows its settings
            open_settings(&handle);
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while building the app")
        .run(|app, event| {
            // opening the app again, from the Finder or Spotlight, shows its settings too
            #[cfg(target_os = "macos")]
            if let tauri::RunEvent::Reopen { .. } = event {
                open_settings(app);
            }
            #[cfg(not(target_os = "macos"))]
            let _ = (app, event);
        });
}
