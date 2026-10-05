use super::{splice, App, Rect, Replacement};
use std::ffi::c_void;
use std::path::Path;
use windows::core::{BOOL, BSTR, PWSTR};
use windows::Win32::Foundation::{CloseHandle, HWND, LPARAM, POINT};
use windows::Win32::System::Com::{CoCreateInstance, CoInitializeEx, CLSCTX_INPROC_SERVER, COINIT_APARTMENTTHREADED, SAFEARRAY};
use windows::Win32::System::Ole::{SafeArrayAccessData, SafeArrayDestroy, SafeArrayGetUBound, SafeArrayUnaccessData};
use windows::Win32::System::Threading::{OpenProcess, QueryFullProcessImageNameW, PROCESS_NAME_WIN32, PROCESS_QUERY_LIMITED_INFORMATION};
use windows::Win32::UI::Accessibility::*;
use windows::Win32::UI::WindowsAndMessaging::{
    EnumWindows, GetCursorPos, GetForegroundWindow, GetWindowTextLengthW, GetWindowThreadProcessId, IsWindowVisible,
};

pub type Pid = u32;

pub struct Platform {
    automation: IUIAutomation,
}

#[derive(Clone)]
pub struct Field {
    element: IUIAutomationElement,
    pattern: IUIAutomationTextPattern,
}

impl Platform {
    // COM objects live on the thread that made them, so this runs on the worker thread.
    pub fn new() -> Self {
        unsafe {
            let _ = CoInitializeEx(None, COINIT_APARTMENTTHREADED);
            let automation = CoCreateInstance(&CUIAutomation, None, CLSCTX_INPROC_SERVER).expect("UI Automation is missing");
            Platform { automation }
        }
    }

    pub fn frontmost(&mut self) -> Option<(App, Pid)> {
        let mut pid = 0u32;
        unsafe { GetWindowThreadProcessId(GetForegroundWindow(), Some(&mut pid)) };
        Some((app_of(pid)?, pid))
    }

    pub fn same(&self, a: &Field, b: &Field) -> bool {
        unsafe { self.automation.CompareElements(&a.element, &b.element) }.is_ok_and(|same| same.as_bool())
    }

    pub fn focused(&mut self, pid: Pid) -> Option<Field> {
        unsafe {
            let element = self.automation.GetFocusedElement().ok()?;
            if element.CurrentProcessId().ok()? as u32 != pid || element.CurrentIsPassword().ok()?.as_bool() {
                return None;
            }
            let pattern: IUIAutomationTextPattern = element.GetCurrentPatternAs(UIA_TextPatternId).ok()?;
            Some(Field { element, pattern })
        }
    }
}

fn wide(text: &BSTR) -> String {
    String::from_utf16_lossy(text)
}

// The app a process runs: its executable, without the folder.
fn app_of(pid: u32) -> Option<App> {
    unsafe {
        let process = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, false, pid).ok()?;
        let mut buffer = [0u16; 1024];
        let mut size = buffer.len() as u32;
        let named = QueryFullProcessImageNameW(process, PROCESS_NAME_WIN32, PWSTR(buffer.as_mut_ptr()), &mut size);
        let _ = CloseHandle(process);
        named.ok()?;
        let path = String::from_utf16_lossy(&buffer[..size as usize]);
        let path = Path::new(&path);
        let id = path.file_name()?.to_string_lossy().to_lowercase();
        let name = path.file_stem()?.to_string_lossy().into_owned();
        Some(App { id, name })
    }
}

// Reads a SAFEARRAY of doubles: left, top, width, height for each line.
unsafe fn rects_of(array: *mut SAFEARRAY) -> Vec<Rect> {
    if array.is_null() {
        return vec![];
    }
    let mut rects = vec![];
    let mut data: *mut c_void = std::ptr::null_mut();
    if let Ok(upper) = SafeArrayGetUBound(array, 1) {
        if upper >= 3 && SafeArrayAccessData(array, &mut data).is_ok() {
            let v = std::slice::from_raw_parts(data as *const f64, upper as usize + 1);
            rects = v.chunks_exact(4).map(|r| Rect { x: r[0], y: r[1], width: r[2], height: r[3] }).collect();
            let _ = SafeArrayUnaccessData(array);
        }
    }
    let _ = SafeArrayDestroy(array);
    rects
}

impl Field {
    // UI Automation has no offsets: the range is built by moving its ends from the start of the text.
    // Some providers count a UI Automation character as a code point or a grapheme, not a UTF-16
    // unit, so after an emoji the range is shifted, and may still read the right text ("👍aa").
    // None unless both the range and the text before it read what `text` has there.
    unsafe fn range(&self, text: &str, start: usize, end: usize) -> Option<IUIAutomationTextRange> {
        let document = self.pattern.DocumentRange().ok()?;
        let range = document.Clone().ok()?;
        range.MoveEndpointByRange(TextPatternRangeEndpoint_End, &document, TextPatternRangeEndpoint_Start).ok()?;
        range.MoveEndpointByUnit(TextPatternRangeEndpoint_End, TextUnit_Character, end as i32).ok()?;
        range.MoveEndpointByUnit(TextPatternRangeEndpoint_Start, TextUnit_Character, start as i32).ok()?;
        let head = document.Clone().ok()?;
        head.MoveEndpointByRange(TextPatternRangeEndpoint_End, &range, TextPatternRangeEndpoint_Start).ok()?;
        let reads = |r: &IUIAutomationTextRange| r.GetText(-1).ok().map(|t| wide(&t));
        (reads(&head) == super::slice(text, 0, start) && reads(&range) == super::slice(text, start, end)).then_some(range)
    }

    pub fn text(&self) -> Option<String> {
        unsafe { Some(wide(&self.pattern.DocumentRange().ok()?.GetText(-1).ok()?)) }
    }

    pub fn frame(&self) -> Option<Rect> {
        let r = unsafe { self.element.CurrentBoundingRectangle().ok()? };
        Some(Rect { x: r.left as f64, y: r.top as f64, width: (r.right - r.left) as f64, height: (r.bottom - r.top) as f64 })
    }

    pub fn bounds(&self, start: usize, end: usize) -> Option<Rect> {
        self.rects(start, end).into_iter().next()
    }

    // No rect rather than one under the wrong text, after an emoji (see `range`).
    pub fn rects(&self, start: usize, end: usize) -> Vec<Rect> {
        let Some(text) = self.text() else { return vec![] };
        unsafe {
            let Some(range) = self.range(&text, start, end) else { return vec![] };
            match range.GetBoundingRectangles() {
                Ok(array) => rects_of(array),
                Err(_) => vec![],
            }
        }
    }

    pub fn selection(&self) -> Option<(usize, usize)> {
        unsafe {
            let ranges = self.pattern.GetSelection().ok()?;
            if ranges.Length().ok()? == 0 {
                return None;
            }
            let selected = ranges.GetElement(0).ok()?;
            let before = self.pattern.DocumentRange().ok()?;
            before.MoveEndpointByRange(TextPatternRangeEndpoint_End, &selected, TextPatternRangeEndpoint_Start).ok()?;
            let start = before.GetText(-1).ok()?.len();
            Some((start, start + selected.GetText(-1).ok()?.len()))
        }
    }

    // Selects the range and types the replacement, which keeps the app's undo. Fields
    // without a text selection get their whole value set instead.
    pub fn replace(&self, start: usize, end: usize, replacement: &str) -> bool {
        self.replace_outcome(start, end, replacement) == Replacement::Applied
    }

    pub fn replace_outcome(&self, start: usize, end: usize, replacement: &str) -> Replacement {
        let Some(text) = self.text() else { return Replacement::Untouched };
        unsafe {
            // only types over the right text, see `range`
            if let Some(range) = self.range(&text, start, end) {
                if range.Select().is_ok() {
                    return if crate::keys::type_text(replacement) { Replacement::Applied } else { Replacement::Unconfirmed };
                }
            }
            let Some(next) = splice(&text, start, end, replacement) else {
                return Replacement::Untouched;
            };
            let Ok(value) = self.element.GetCurrentPatternAs::<IUIAutomationValuePattern>(UIA_ValuePatternId) else {
                return Replacement::Untouched;
            };
            if value.SetValue(&BSTR::from(next)).is_ok() { Replacement::Applied } else { Replacement::Unconfirmed }
        }
    }
}

// The apps with a visible window, for the settings to add one before typing in it.
pub fn running_apps() -> Vec<App> {
    unsafe extern "system" fn collect(window: HWND, pids: LPARAM) -> BOOL {
        let pids = &mut *(pids.0 as *mut Vec<u32>);
        if IsWindowVisible(window).as_bool() && GetWindowTextLengthW(window) > 0 {
            let mut pid = 0u32;
            GetWindowThreadProcessId(window, Some(&mut pid));
            pids.push(pid);
        }
        true.into()
    }
    let mut pids: Vec<u32> = vec![];
    let _ = unsafe { EnumWindows(Some(collect), LPARAM(&mut pids as *mut Vec<u32> as isize)) };
    pids.sort();
    pids.dedup();
    let mut apps: Vec<App> = pids.into_iter().filter(|&pid| pid != std::process::id()).filter_map(app_of).collect();
    apps.sort_by(|a, b| a.id.cmp(&b.id));
    apps.dedup_by(|a, b| a.id == b.id);
    apps
}

pub fn cursor() -> (f64, f64) {
    let mut p = POINT::default();
    let _ = unsafe { GetCursorPos(&mut p) };
    (p.x as f64, p.y as f64)
}

// Windows lets any desktop app use UI Automation.
pub fn trusted(_prompt: bool) -> bool {
    true
}

pub fn open_permission_settings() {}
