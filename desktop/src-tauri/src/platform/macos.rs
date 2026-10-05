use super::{splice, App, Rect};
use accessibility_sys::*;
use core_foundation::array::{CFArray, CFArrayRef};
use core_foundation::base::{CFType, TCFType};
use core_foundation::boolean::CFBoolean;
use core_foundation::dictionary::CFDictionary;
use core_foundation::number::CFNumber;
use core_foundation::string::CFString;
use core_foundation_sys::base::{CFEqual, CFGetTypeID, CFRange, CFRelease, CFRetain, CFTypeRef};
use core_graphics::event::CGEvent;
use core_graphics::event_source::{CGEventSource, CGEventSourceStateID};
use core_graphics::geometry::{CGPoint, CGRect, CGSize};
use objc2_app_kit::{NSApplicationActivationPolicy, NSRunningApplication, NSWorkspace};
use std::collections::HashSet;
use std::ffi::c_void;
use std::ptr;
use std::time::{Duration, Instant};

// Roles of the elements people type prose in. A contenteditable in Chromium and Electron is an AXTextArea too.
pub type Pid = i32;

const TEXT_ROLES: [&str; 3] = ["AXTextArea", "AXTextField", "AXComboBox"];

pub struct Platform {
    system: AXUIElementRef,
    // apps already asked to build their accessibility tree
    woken: HashSet<i32>,
}

// An owned reference to the focused element of another app.
pub struct Field(AXUIElementRef);

impl Drop for Field {
    fn drop(&mut self) {
        unsafe { CFRelease(self.0 as CFTypeRef) }
    }
}

impl Clone for Field {
    fn clone(&self) -> Self {
        unsafe { CFRetain(self.0 as CFTypeRef) };
        Field(self.0)
    }
}

impl Drop for Platform {
    fn drop(&mut self) {
        unsafe { CFRelease(self.system as CFTypeRef) }
    }
}

fn copy_attribute(element: AXUIElementRef, name: &str) -> Option<CFType> {
    let mut value: CFTypeRef = ptr::null();
    let name = CFString::new(name);
    let error = unsafe { AXUIElementCopyAttributeValue(element, name.as_concrete_TypeRef(), &mut value) };
    (error == kAXErrorSuccess && !value.is_null()).then(|| unsafe { CFType::wrap_under_create_rule(value) })
}

fn set_attribute(element: AXUIElementRef, name: &str, value: &CFType) -> bool {
    let name = CFString::new(name);
    unsafe { AXUIElementSetAttributeValue(element, name.as_concrete_TypeRef(), value.as_CFTypeRef()) == kAXErrorSuccess }
}

fn string(value: &CFType) -> Option<String> {
    value.downcast::<CFString>().map(|s| s.to_string())
}

// Reads a CGPoint, CGSize, CGRect or CFRange out of an AXValue.
fn ax_value<T>(value: &CFType, kind: AXValueType, mut out: T) -> Option<T> {
    unsafe {
        if CFGetTypeID(value.as_CFTypeRef()) != AXValueGetTypeID() {
            return None;
        }
        AXValueGetValue(value.as_CFTypeRef() as AXValueRef, kind, &mut out as *mut T as *mut c_void).then_some(out)
    }
}

fn range_value(start: usize, end: usize) -> CFType {
    let range = CFRange { location: start as isize, length: end.saturating_sub(start) as isize };
    unsafe { CFType::wrap_under_create_rule(AXValueCreate(kAXValueTypeCFRange, &range as *const _ as *const c_void) as CFTypeRef) }
}

fn parameterized(element: AXUIElementRef, name: &str, parameter: &CFType) -> Option<CFType> {
    let name = CFString::new(name);
    let mut value: CFTypeRef = ptr::null();
    let error = unsafe {
        AXUIElementCopyParameterizedAttributeValue(element, name.as_concrete_TypeRef(), parameter.as_CFTypeRef(), &mut value)
    };
    (error == kAXErrorSuccess && !value.is_null()).then(|| unsafe { CFType::wrap_under_create_rule(value) })
}

fn range_bounds(element: AXUIElementRef, start: usize, end: usize) -> Option<Rect> {
    let value = parameterized(element, kAXBoundsForRangeParameterizedAttribute, &range_value(start, end))?;
    let zero = CGRect::new(&CGPoint::new(0.0, 0.0), &CGSize::new(0.0, 0.0));
    let r = ax_value(&value, kAXValueTypeCGRect, zero)?;
    // some apps answer a zero rect for text scrolled out of view, Chromium for a whole contenteditable
    (r.size.width > 0.0 || r.size.height > 0.0).then(|| Rect { x: r.origin.x, y: r.origin.y, width: r.size.width, height: r.size.height })
}

// The AXStaticText descendants of an element, in reading order.
fn static_texts(element: AXUIElementRef, depth: usize, out: &mut Vec<CFType>) {
    if depth > 12 || out.len() >= 500 {
        return;
    }
    let Some(children) = copy_attribute(element, kAXChildrenAttribute) else { return };
    if unsafe { CFGetTypeID(children.as_CFTypeRef()) != CFArray::<CFType>::type_id() } {
        return;
    }
    let children: CFArray<CFType> = unsafe { CFArray::wrap_under_get_rule(children.as_CFTypeRef() as CFArrayRef) };
    for child in children.iter() {
        let raw = child.as_CFTypeRef() as AXUIElementRef;
        if copy_attribute(raw, kAXRoleAttribute).and_then(|r| string(&r)).as_deref() == Some(kAXStaticTextRole) {
            out.push(child.clone());
        } else {
            static_texts(raw, depth + 1, out);
        }
    }
}

fn pid_of(element: AXUIElementRef) -> Option<i32> {
    let mut pid = 0;
    (unsafe { AXUIElementGetPid(element, &mut pid) } == kAXErrorSuccess).then_some(pid)
}

impl Platform {
    pub fn new() -> Self {
        let system = unsafe { AXUIElementCreateSystemWide() };
        // an app that doesn't answer mustn't freeze the checks
        unsafe { AXUIElementSetMessagingTimeout(system, 0.3) };
        Platform { system, woken: HashSet::new() }
    }

    // The app with keyboard focus. Asked through Accessibility first, since NSWorkspace only
    // updates its frontmost app on a thread that runs the main run loop. Electron apps don't
    // answer that query until AXManualAccessibility is set, which needs their pid first.
    pub fn frontmost(&mut self) -> Option<(App, Pid)> {
        let pid = copy_attribute(self.system, kAXFocusedApplicationAttribute)
            .and_then(|app| pid_of(app.as_CFTypeRef() as AXUIElementRef))
            .or_else(|| Some(NSWorkspace::sharedWorkspace().frontmostApplication()?.processIdentifier()))?;
        let running = NSRunningApplication::runningApplicationWithProcessIdentifier(pid)?;
        let name = running.localizedName().map(|n| n.to_string()).unwrap_or_default();
        let id = running.bundleIdentifier().map(|n| n.to_string()).unwrap_or_else(|| name.clone());
        Some((App { id, name }, pid))
    }

    // Whether two references are the same element of the same app.
    pub fn same(&self, a: &Field, b: &Field) -> bool {
        unsafe { CFEqual(a.0 as CFTypeRef, b.0 as CFTypeRef) != 0 }
    }

    pub fn focused(&mut self, pid: Pid) -> Option<Field> {
        let app = unsafe { CFType::wrap_under_create_rule(AXUIElementCreateApplication(pid) as CFTypeRef) };
        let app_ref = app.as_CFTypeRef() as AXUIElementRef;
        unsafe { AXUIElementSetMessagingTimeout(app_ref, 0.3) };
        if self.woken.insert(pid) {
            // Electron and Chromium only expose their text to assistive apps that ask for it
            set_attribute(app_ref, "AXManualAccessibility", &CFBoolean::true_value().as_CFType());
        }
        let element = copy_attribute(app_ref, kAXFocusedUIElementAttribute)?;
        if unsafe { CFGetTypeID(element.as_CFTypeRef()) != AXUIElementGetTypeID() } {
            return None;
        }
        let raw = element.as_CFTypeRef() as AXUIElementRef;
        let role = copy_attribute(raw, kAXRoleAttribute).and_then(|r| string(&r))?;
        let subrole = copy_attribute(raw, kAXSubroleAttribute).and_then(|r| string(&r));
        if !TEXT_ROLES.contains(&role.as_str()) || subrole.as_deref() == Some(kAXSecureTextFieldSubrole) {
            return None;
        }
        std::mem::forget(element); // the Field owns the reference now
        Some(Field(raw))
    }
}

impl Field {
    pub fn text(&self) -> Option<String> {
        copy_attribute(self.0, kAXValueAttribute).and_then(|v| string(&v))
    }

    pub fn frame(&self) -> Option<Rect> {
        let origin = ax_value(&copy_attribute(self.0, kAXPositionAttribute)?, kAXValueTypeCGPoint, CGPoint::new(0.0, 0.0))?;
        let size = ax_value(&copy_attribute(self.0, kAXSizeAttribute)?, kAXValueTypeCGSize, CGSize::new(0.0, 0.0))?;
        Some(Rect { x: origin.x, y: origin.y, width: size.width, height: size.height })
    }

    pub fn bounds(&self, start: usize, end: usize) -> Option<Rect> {
        range_bounds(self.0, start, end).or_else(|| self.leaf_bounds(start, end))
    }

    // One rect per line, as the extension draws a mark per line. Apps that don't answer the
    // line queries get one rect around the whole range.
    pub fn rects(&self, start: usize, end: usize) -> Vec<Rect> {
        match (self.line_of(start), self.line_of(end.saturating_sub(1).max(start))) {
            (Some(first), Some(last)) if last > first && last - first < 50 => (first..=last)
                .filter_map(|line| {
                    let (from, to) = self.line_range(line)?;
                    let (start, end) = (start.max(from), end.min(to));
                    (start < end).then(|| self.bounds(start, end)).flatten()
                })
                .collect(),
            _ => self.bounds(start, end).into_iter().collect(),
        }
    }

    fn line_of(&self, index: usize) -> Option<i64> {
        let line = parameterized(self.0, kAXLineForIndexParameterizedAttribute, &CFNumber::from(index as i64).as_CFType())?;
        line.downcast::<CFNumber>()?.to_i64()
    }

    fn line_range(&self, line: i64) -> Option<(usize, usize)> {
        let value = parameterized(self.0, kAXRangeForLineParameterizedAttribute, &CFNumber::from(line).as_CFType())?;
        let r = ax_value(&value, kAXValueTypeCFRange, CFRange { location: 0, length: 0 })?;
        Some((r.location as usize, (r.location + r.length) as usize))
    }

    // Chromium and Electron answer AXBoundsForRange only on the text leaves of a contenteditable,
    // not on the field, so the range is measured in the leaf that holds its start.
    // ponytail: walks the leaves on every call; cache them per text if long fields get slow.
    fn leaf_bounds(&self, start: usize, end: usize) -> Option<Rect> {
        let text: Vec<u16> = self.text()?.encode_utf16().collect();
        let mut leaves = vec![];
        static_texts(self.0, 0, &mut leaves);
        // the field's value has line breaks between blocks that no leaf holds, so each leaf is found in it
        let mut from = 0;
        for leaf in &leaves {
            let Some(value) = copy_attribute(leaf.as_CFTypeRef() as AXUIElementRef, kAXValueAttribute).and_then(|v| string(&v)) else {
                continue;
            };
            let value: Vec<u16> = value.encode_utf16().collect();
            if value.is_empty() {
                continue;
            }
            let Some(at) = text[from..].windows(value.len()).position(|w| w == value).map(|i| i + from) else {
                continue;
            };
            let leaf_end = at + value.len();
            if start >= at && start < leaf_end {
                return range_bounds(leaf.as_CFTypeRef() as AXUIElementRef, start - at, end.min(leaf_end) - at);
            }
            from = leaf_end;
        }
        None
    }

    pub fn selection(&self) -> Option<(usize, usize)> {
        let value = copy_attribute(self.0, kAXSelectedTextRangeAttribute)?;
        let r = ax_value(&value, kAXValueTypeCFRange, CFRange { location: 0, length: 0 })?;
        Some((r.location as usize, (r.location + r.length) as usize))
    }

    pub fn replace(&self, start: usize, end: usize, replacement: &str) -> bool {
        replace_text(self, start, end, replacement)
    }
}

// Attribute setters can report success before an app applies the selection or edit.
trait EditableField {
    fn text(&self) -> Option<String>;
    fn selection(&self) -> Option<(usize, usize)>;
    fn select(&self, start: usize, end: usize) -> bool;
    fn replace_selected(&self, replacement: &str) -> bool;
    fn set_text(&self, text: &str) -> bool;
    fn type_text(&self, text: &str) -> bool;
}

impl EditableField for Field {
    fn text(&self) -> Option<String> {
        Field::text(self)
    }

    fn selection(&self) -> Option<(usize, usize)> {
        Field::selection(self)
    }

    fn select(&self, start: usize, end: usize) -> bool {
        set_attribute(self.0, kAXSelectedTextRangeAttribute, &range_value(start, end))
    }

    fn replace_selected(&self, replacement: &str) -> bool {
        set_attribute(self.0, kAXSelectedTextAttribute, &CFString::new(replacement).as_CFType())
    }

    fn set_text(&self, text: &str) -> bool {
        set_attribute(self.0, kAXValueAttribute, &CFString::new(text).as_CFType())
    }

    fn type_text(&self, text: &str) -> bool {
        // Long Unicode input is split into keyboard events, which rich editors can interleave.
        if text.encode_utf16().count() > 20 {
            crate::keys::paste(text)
        } else {
            crate::keys::type_text(text)
        }
    }
}

fn wait_until(mut ready: impl FnMut() -> bool) -> bool {
    let deadline = Instant::now() + Duration::from_millis(300);
    loop {
        if ready() {
            return true;
        }
        if Instant::now() >= deadline {
            return false;
        }
        std::thread::sleep(Duration::from_millis(20));
    }
}

fn select_text(field: &impl EditableField, start: usize, end: usize, original: &str) -> bool {
    field.select(start, end)
        && wait_until(|| field.selection() == Some((start, end)))
        && field.text().as_deref() == Some(original)
}

fn replace_text(field: &impl EditableField, start: usize, end: usize, replacement: &str) -> bool {
    let Some(original) = field.text() else { return false };
    let Some(next) = splice(&original, start, end, replacement) else { return false };
    if original == next {
        return true;
    }
    if !select_text(field, start, end, &original) {
        return field.text().as_deref() == Some(original.as_str())
            && field.set_text(&next)
            && wait_until(|| field.text().as_deref() == Some(next.as_str()));
    }

    let _ = field.replace_selected(replacement);
    if wait_until(|| field.text().as_deref() == Some(next.as_str())) {
        return true;
    }
    // A failed or partial edit must never be followed by another insertion.
    if field.text().as_deref() != Some(original.as_str()) || !select_text(field, start, end, &original) {
        return false;
    }
    field.type_text(replacement) && wait_until(|| field.text().as_deref() == Some(next.as_str()))
}

// The apps with a window, for the settings to add one before typing in it.
pub fn running_apps() -> Vec<App> {
    NSWorkspace::sharedWorkspace()
        .runningApplications()
        .iter()
        .filter(|app| app.activationPolicy() == NSApplicationActivationPolicy::Regular)
        .filter_map(|app| {
            let name = app.localizedName()?.to_string();
            let id = app.bundleIdentifier().map(|n| n.to_string()).unwrap_or_else(|| name.clone());
            Some(App { id, name })
        })
        .collect()
}

pub fn cursor() -> (f64, f64) {
    CGEventSource::new(CGEventSourceStateID::CombinedSessionState)
        .and_then(CGEvent::new)
        .map(|e| {
            let p = e.location();
            (p.x, p.y)
        })
        .unwrap_or((0.0, 0.0))
}

// Whether macOS lets this app read other apps. `prompt` shows the system dialog that sends
// the user to the Accessibility settings.
pub fn trusted(prompt: bool) -> bool {
    let key = unsafe { CFString::wrap_under_get_rule(kAXTrustedCheckOptionPrompt) };
    let options = CFDictionary::from_CFType_pairs(&[(key.as_CFType(), CFBoolean::from(prompt).as_CFType())]);
    unsafe { AXIsProcessTrustedWithOptions(options.as_concrete_TypeRef()) }
}

pub fn open_permission_settings() {
    let _ = std::process::Command::new("open")
        .arg("x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility")
        .spawn();
}

#[cfg(test)]
#[path = "macos_tests.rs"]
mod tests;
