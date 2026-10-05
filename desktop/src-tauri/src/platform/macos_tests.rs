use super::{replace_outcome, splice, EditableField, Replacement};
use std::cell::{Cell, RefCell};

fn replace_text(field: &impl EditableField, start: usize, end: usize, replacement: &str) -> bool {
    replace_outcome(field, start, end, replacement) == Replacement::Applied
}

#[derive(Clone, Copy)]
enum Edit {
    Apply,
    Ignore,
    Collapse,
    Partial,
    Unfocused,
}

struct TestField {
    text: RefCell<String>,
    selection: Cell<Option<(usize, usize)>>,
    pending_selection: Cell<Option<(usize, usize)>>,
    selection_delay: Cell<usize>,
    ignore_selection: bool,
    reject_selection: bool,
    allow_value: bool,
    edit: Edit,
    typed: Cell<usize>,
    value_edits: Cell<usize>,
    pending_text: RefCell<Option<String>>,
    text_delay: Cell<usize>,
}

impl TestField {
    fn new(text: &str, edit: Edit) -> Self {
        Self {
            text: RefCell::new(text.to_owned()),
            selection: Cell::new(Some((0, 0))),
            pending_selection: Cell::new(None),
            selection_delay: Cell::new(0),
            ignore_selection: false,
            reject_selection: false,
            allow_value: false,
            edit,
            typed: Cell::new(0),
            value_edits: Cell::new(0),
            pending_text: RefCell::new(None),
            text_delay: Cell::new(0),
        }
    }

    fn insert(&self, replacement: &str) {
        let (start, end) = self.selection.get().unwrap();
        let next = splice(&self.text.borrow(), start, end, replacement).unwrap();
        if self.text_delay.get() > 0 {
            *self.pending_text.borrow_mut() = Some(next);
        } else {
            *self.text.borrow_mut() = next;
        }
        let caret = start + replacement.encode_utf16().count();
        self.selection.set(Some((caret, caret)));
    }

    fn current_text(&self) -> String {
        self.text.borrow().clone()
    }

    fn finish_pending_edit(&self) {
        if let Some(text) = self.pending_text.borrow_mut().take() {
            *self.text.borrow_mut() = text;
        }
    }
}

impl EditableField for TestField {
    fn text(&self) -> Option<String> {
        if self.pending_text.borrow().is_some() {
            if self.text_delay.get() > 0 {
                self.text_delay.set(self.text_delay.get() - 1);
            } else {
                *self.text.borrow_mut() = self.pending_text.borrow_mut().take().unwrap();
            }
        }
        Some(self.current_text())
    }

    fn selection(&self) -> Option<(usize, usize)> {
        if self.selection_delay.get() > 0 {
            self.selection_delay.set(self.selection_delay.get() - 1);
        } else if let Some(selection) = self.pending_selection.take() {
            self.selection.set(Some(selection));
        }
        self.selection.get()
    }

    fn select(&self, start: usize, end: usize) -> bool {
        if self.reject_selection {
            return false;
        }
        if !self.ignore_selection {
            self.pending_selection.set(Some((start, end)));
        }
        true
    }

    fn can_set_text(&self) -> bool {
        self.allow_value
    }

    fn focused(&self) -> bool {
        !matches!(self.edit, Edit::Unfocused)
    }

    fn set_text(&self, text: &str) -> bool {
        self.value_edits.set(self.value_edits.get() + 1);
        if self.allow_value {
            *self.text.borrow_mut() = text.to_owned();
        }
        self.allow_value
    }

    fn type_text(&self, text: &str) -> bool {
        self.typed.set(self.typed.get() + 1);
        match self.edit {
            Edit::Apply => self.insert(text),
            Edit::Ignore => {},
            Edit::Collapse => {
                let (_, end) = self.selection.get().unwrap();
                self.selection.set(Some((end, end)));
            },
            Edit::Partial => self.text.borrow_mut().push_str(text),
            Edit::Unfocused => panic!("an unfocused field must not receive keyboard input"),
        }
        true
    }
}

#[test]
fn waits_for_selection_before_correcting_a_word_in_a_long_message() {
    let original = "Hello,\nj'ai cherché un petit creneau pour un one on one dans ton agenda avant que je parte à Amsterdam, mercredi après-midi j'ai cru comprendre, mais je n'ai pas trouvé.\nDis-moi si j'ai mal cherché ! Bon salon !";
    let field = TestField::new(original, Edit::Apply);
    field.selection_delay.set(3);
    let start = original[..original.find("creneau").unwrap()].encode_utf16().count();
    assert!(replace_text(&field, start, start + 7, "créneau"));
    assert_eq!(field.current_text(), original.replace("creneau", "créneau"));
    assert_eq!(field.typed.get(), 1);
}

#[test]
fn does_not_type_when_the_selection_setter_silently_ignores_the_range() {
    let mut field = TestField::new("un creneau pour demain", Edit::Apply);
    field.ignore_selection = true;
    assert_eq!(replace_outcome(&field, 3, 10, "créneau"), Replacement::Untouched);
    assert_eq!(field.current_text(), "un creneau pour demain");
    assert_eq!(field.value_edits.get(), 0);
    assert_eq!(field.typed.get(), 0);
}

#[test]
fn does_not_retry_an_edit_that_collapses_the_selection() {
    let field = TestField::new("un creneau pour demain", Edit::Collapse);
    assert_eq!(replace_outcome(&field, 3, 10, "créneau"), Replacement::Unconfirmed);
    assert_eq!(field.current_text(), "un creneau pour demain");
    assert_eq!(field.typed.get(), 1);
}

#[test]
fn does_not_repeat_an_edit_that_already_changed_the_text() {
    let field = TestField::new("un creneau pour demain", Edit::Partial);
    assert_eq!(replace_outcome(&field, 3, 10, "créneau"), Replacement::Unconfirmed);
    assert_eq!(field.current_text(), "un creneau pour demaincréneau");
    assert_eq!(field.typed.get(), 1);
}

#[test]
fn waits_for_a_delayed_edit_without_typing_it_again() {
    let field = TestField::new("un creneau pour demain", Edit::Apply);
    field.text_delay.set(3);
    assert!(replace_text(&field, 3, 10, "créneau"));
    assert_eq!(field.current_text(), "un créneau pour demain");
    assert_eq!(field.typed.get(), 1);
}

#[test]
fn does_not_report_success_when_keyboard_input_is_ignored() {
    let field = TestField::new("un creneau pour demain", Edit::Ignore);
    assert_eq!(replace_outcome(&field, 3, 10, "créneau"), Replacement::Unconfirmed);
    assert_eq!(field.current_text(), "un creneau pour demain");
    assert_eq!(field.typed.get(), 1);
}

#[test]
fn replaces_a_multiline_selection_with_unicode_and_preserves_the_surrounding_text() {
    let original = "Avant 👍\nune longue phrase avec plusieurs erreurs\net une autre ligne\nAprès";
    let start = "Avant 👍\n".encode_utf16().count();
    let end = original.encode_utf16().count() - "\nAprès".encode_utf16().count();
    let replacement = "Une longue phrase corrigée, avec des accents et un emoji 👍.\nUne autre ligne corrigée.";
    let field = TestField::new(original, Edit::Apply);
    assert!(replace_text(&field, start, end, replacement));
    assert_eq!(field.current_text(), format!("Avant 👍\n{replacement}\nAprès"));
    assert_eq!(field.typed.get(), 1);
}

#[test]
fn deletes_a_selected_range() {
    let field = TestField::new("un mot en trop", Edit::Apply);
    assert!(replace_text(&field, 6, 14, ""));
    assert_eq!(field.current_text(), "un mot");
}

#[test]
fn sets_the_whole_value_when_selection_is_unavailable() {
    let mut field = TestField::new("un creneau pour demain", Edit::Apply);
    field.reject_selection = true;
    field.allow_value = true;
    assert!(replace_text(&field, 3, 10, "créneau"));
    assert_eq!(field.current_text(), "un créneau pour demain");
    assert_eq!(field.value_edits.get(), 1);
    assert_eq!(field.typed.get(), 0);
}

#[test]
fn rejects_invalid_ranges_without_editing() {
    let field = TestField::new("👍", Edit::Apply);
    assert!(!replace_text(&field, 1, 2, "x"));
    assert!(!replace_text(&field, 2, 1, "x"));
    assert!(!replace_text(&field, 0, 3, "x"));
    assert_eq!(field.current_text(), "👍");
    assert_eq!(field.typed.get(), 0);
}

#[test]
fn leaves_an_identical_replacement_untouched() {
    let field = TestField::new("un créneau", Edit::Apply);
    assert!(replace_text(&field, 3, 10, "créneau"));
    assert_eq!(field.typed.get(), 0);
}

#[test]
fn does_not_repeat_keyboard_input_when_an_edit_arrives_after_the_deadline() {
    let field = TestField::new("un creneau pour demain", Edit::Apply);
    field.text_delay.set(100);
    assert_eq!(replace_outcome(&field, 3, 10, "créneau"), Replacement::Unconfirmed);
    assert_eq!(field.current_text(), "un creneau pour demain");
    assert_eq!(field.typed.get(), 1);
    field.finish_pending_edit();
    assert_eq!(field.current_text(), "un créneau pour demain");
}

#[test]
fn does_not_submit_an_edit_when_selection_confirmation_exceeds_the_deadline() {
    let field = TestField::new("un creneau pour demain", Edit::Apply);
    field.selection_delay.set(100);
    assert_eq!(replace_outcome(&field, 3, 10, "créneau"), Replacement::Untouched);
    assert_eq!(field.current_text(), "un creneau pour demain");
    assert_eq!(field.typed.get(), 0);
    assert_eq!(field.value_edits.get(), 0);
}

#[test]
fn does_not_send_keyboard_input_after_the_target_loses_focus() {
    let field = TestField::new("un creneau pour demain", Edit::Unfocused);
    assert_eq!(replace_outcome(&field, 3, 10, "créneau"), Replacement::Untouched);
    assert_eq!(field.current_text(), "un creneau pour demain");
    assert_eq!(field.typed.get(), 0);
}

#[test]
fn reports_untouched_when_no_edit_method_can_be_dispatched() {
    let mut field = TestField::new("un creneau pour demain", Edit::Apply);
    field.reject_selection = true;
    assert_eq!(replace_outcome(&field, 3, 10, "créneau"), Replacement::Untouched);
    assert_eq!(field.current_text(), "un creneau pour demain");
    assert_eq!(field.value_edits.get(), 0);
    assert_eq!(field.typed.get(), 0);
}

#[test]
fn checks_the_result_once_when_confirmation_starts_after_the_deadline() {
    let reads = Cell::new(0);
    let expired = std::time::Instant::now() - std::time::Duration::from_millis(1);
    assert!(super::wait_until(expired, || { reads.set(reads.get() + 1); true }));
    assert_eq!(reads.get(), 1);
    assert!(!super::wait_until(expired, || { reads.set(reads.get() + 1); false }));
    assert_eq!(reads.get(), 2);
}
