// One thread owns every accessibility call: COM objects on Windows can't leave the thread
// that made them, and one slow app then only delays this thread.
// ponytail: it polls the focused field every 200 ms instead of subscribing to AX and UIA
// events, which differ per app; subscribe if polling ever costs noticeable CPU.
use crate::config::Config;
use crate::platform::{self, slice, App, Field, Pid, Platform, Rect, Replacement};
use serde::Serialize;
use std::sync::mpsc::{channel, RecvTimeoutError, Sender};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

const TICK: Duration = Duration::from_millis(200);
// longer fields are skipped: a check would take the model too long
const MAX_LENGTH: usize = 20_000;

pub enum Command {
    // the ranges to underline in `text`, from the last check
    Marks { text: String, ranges: Vec<(usize, usize)> },
    // replaces [start, end) if the field is still `field` (a FieldState id) and reads
    // `expected`, the text the fix was made for
    Apply { field: u64, start: usize, end: usize, replacement: String, expected: String, reply: Sender<bool> },
    // the selection of the focused field, where it is on screen and the field's text. The
    // field becomes the target of the rewrite.
    Selection { reply: Sender<Option<(Selection, Option<Rect>, String)>> },
    // makes the field being checked the target of a rewrite opened from the card, if it is
    // still `field`; otherwise the rewrite has no target and replaces nothing
    Target { field: u64 },
    // None when the target or source text changed; otherwise reports whether an edit was sent.
    ReplaceSelection { selection: Selection, text: String, reply: Sender<Option<Replacement>> },
    // whether the target app, and its field if it exposes one, still has the focus, before
    // pasting into it
    OnTarget { reply: Sender<bool> },
}

// Where a rewrite was opened: its variant goes there or nowhere, even after the user
// clicked into another field or app while the card was open.
struct Target {
    pid: Pid,
    field: Option<Field>,
}

#[derive(Clone, Serialize, serde::Deserialize)]
pub struct Selection {
    pub text: String,
    pub start: usize,
    pub end: usize,
}

pub struct FieldState {
    // changes when another field gets the focus, so a result is only applied to its own field
    pub id: u64,
    pub text: String,
    pub frame: Rect,
    // the rects of each range, one per line
    pub marks: Vec<Vec<Rect>>,
}

pub struct Tick {
    pub app: Option<App>,
    pub field: Option<FieldState>,
    pub cursor: (f64, f64),
}

struct Worker {
    platform: Platform,
    config: Arc<Mutex<Config>>,
    field: Option<Field>,
    field_id: u64,
    // the frontmost app at the last tick
    pid: Option<Pid>,
    marks: (String, Vec<(usize, usize)>),
    target: Option<Target>,
}

impl Worker {
    // The focused field of the frontmost app, unless it is this app or a disabled one.
    fn focused(&mut self) -> Option<(App, Pid, Option<Field>)> {
        let (app, pid) = self.platform.frontmost()?;
        if pid as u64 == std::process::id() as u64 {
            return None;
        }
        let allowed = self.config.lock().unwrap().allows(&app);
        let field = if allowed { self.platform.focused(pid) } else { None };
        Some((app, pid, field))
    }

    // The focused field, if it is the one the rewrite was opened on.
    fn target_field(&mut self) -> Option<Field> {
        let (_, pid, field) = self.focused()?;
        let target = self.target.as_ref()?;
        let field = field?;
        (target.pid == pid && target.field.as_ref().is_some_and(|t| self.platform.same(t, &field))).then_some(field)
    }

    fn tick(&mut self) -> Tick {
        let enabled = self.config.lock().unwrap().check_as_you_type;
        let focused = self.focused();
        let app = focused.as_ref().map(|(app, _, _)| app.clone());
        self.pid = focused.as_ref().map(|&(_, pid, _)| pid);
        let next = focused.and_then(|(_, _, field)| field).filter(|_| enabled);
        let changed = match (&self.field, &next) {
            (Some(a), Some(b)) => !self.platform.same(a, b),
            (None, None) => false,
            _ => true,
        };
        self.field_id += changed as u64;
        self.field = next;
        let field = self.field.as_ref().and_then(|f| {
            let text = f.text()?;
            if text.encode_utf16().count() > MAX_LENGTH {
                return None;
            }
            let frame = f.frame()?;
            let marks = if self.marks.0 == text {
                self.marks.1.iter().map(|&(start, end)| f.rects(start, end)).collect()
            } else {
                vec![]
            };
            Some(FieldState { id: self.field_id, text, frame, marks })
        });
        Tick { app, field, cursor: platform::cursor() }
    }

    fn handle(&mut self, command: Command) {
        match command {
            Command::Marks { text, ranges } => self.marks = (text, ranges),
            Command::Apply { field, start, end, replacement, expected, reply } => {
                // the field of the last tick, if it still has the focus: the user may have
                // clicked into another one since
                let focused = self.focused().and_then(|(_, _, f)| f);
                let current = self.field.as_ref().zip(focused).filter(|(a, b)| self.platform.same(a, b)).map(|(_, b)| b);
                let done = field == self.field_id
                    && current.is_some_and(|f| f.text().as_deref() == Some(expected.as_str()) && f.replace(start, end, &replacement));
                let _ = reply.send(done);
            }
            Command::Selection { reply } => {
                let focused = self.focused();
                let selection = focused.as_ref().and_then(|(_, _, field)| {
                    let field = field.as_ref()?;
                    let (start, end) = field.selection()?;
                    let all = field.text()?;
                    let text = slice(&all, start, end)?;
                    let rect = field.bounds(start, end);
                    (!text.trim().is_empty()).then_some((Selection { text, start, end }, rect, all))
                });
                // without a selection the rewrite pastes, and the app alone is the target
                self.target = focused.map(|(_, pid, field)| Target { pid, field });
                let _ = reply.send(selection);
            }
            Command::Target { field } => {
                self.target = self.pid.filter(|_| field == self.field_id).map(|pid| Target { pid, field: self.field.clone() });
            }
            Command::ReplaceSelection { selection, text, reply } => {
                let outcome = self.target_field().and_then(|f| {
                    let current = f.text().and_then(|t| slice(&t, selection.start, selection.end));
                    (current.as_deref() == Some(selection.text.as_str())).then(|| f.replace_outcome(selection.start, selection.end, &text))
                });
                let _ = reply.send(outcome);
            }
            Command::OnTarget { reply } => {
                // ponytail: an app that exposes no field at all is only checked by its pid
                let on_target = match (self.focused(), &self.target) {
                    (Some((_, pid, field)), Some(t)) => {
                        t.pid == pid && t.field.as_ref().is_none_or(|a| field.is_some_and(|b| self.platform.same(a, &b)))
                    }
                    _ => false,
                };
                let _ = reply.send(on_target);
            }
        }
    }
}

pub fn spawn(config: Arc<Mutex<Config>>, on_tick: impl Fn(Tick) + Send + 'static) -> Sender<Command> {
    let (sender, receiver) = channel();
    std::thread::spawn(move || {
        let mut worker = Worker { platform: Platform::new(), config, field: None, field_id: 0, pid: None, marks: (String::new(), vec![]), target: None };
        let mut next = Instant::now();
        loop {
            let command = match receiver.recv_timeout(next.saturating_duration_since(Instant::now())) {
                Ok(command) => Some(command),
                Err(RecvTimeoutError::Timeout) => None,
                Err(RecvTimeoutError::Disconnected) => return,
            };
            platform::pooled(|| {
                if let Some(command) = command {
                    worker.handle(command);
                }
                if Instant::now() >= next {
                    on_tick(worker.tick());
                    next = Instant::now() + TICK;
                }
            });
        }
    });
    sender
}
