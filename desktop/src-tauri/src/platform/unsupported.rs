// Linux and the rest: no field reading yet, see desktop/LINUX.md.
use super::{App, Rect, Replacement};

pub type Pid = u32;

pub struct Platform;
#[derive(Clone)]
pub struct Field;

impl Platform {
    pub fn new() -> Self {
        Platform
    }
    pub fn frontmost(&mut self) -> Option<(App, Pid)> {
        None
    }
    pub fn same(&self, _a: &Field, _b: &Field) -> bool {
        false
    }
    pub fn focused(&mut self, _pid: Pid) -> Option<Field> {
        None
    }
}

impl Field {
    pub fn text(&self) -> Option<String> {
        None
    }
    pub fn frame(&self) -> Option<Rect> {
        None
    }
    pub fn bounds(&self, _start: usize, _end: usize) -> Option<Rect> {
        None
    }
    pub fn rects(&self, _start: usize, _end: usize) -> Vec<Rect> {
        vec![]
    }
    pub fn selection(&self) -> Option<(usize, usize)> {
        None
    }
    pub fn replace(&self, _start: usize, _end: usize, _replacement: &str) -> bool {
        false
    }
    pub fn replace_outcome(&self, _start: usize, _end: usize, _replacement: &str) -> Replacement {
        Replacement::Untouched
    }
}

pub fn running_apps() -> Vec<App> {
    vec![]
}

pub fn cursor() -> (f64, f64) {
    (0.0, 0.0)
}

pub fn trusted(_prompt: bool) -> bool {
    false
}

pub fn open_permission_settings() {}
