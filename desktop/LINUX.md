# Linux feasibility for the desktop companion

Research date: 2026-09-30. Scope: X11, GNOME/Mutter Wayland, KDE/KWin Wayland, wlroots-family compositors such as Sway and Hyprland. Claims I could not confirm from a primary source carry the tag **[unverified]**.

## Verdict

**Level 1 can ship.** Hotkey, read the selection, show a popup, replace the selection. It works on X11, KDE Plasma 6 Wayland, GNOME 48+ Wayland and Hyprland. Each desktop needs its own backend for the hotkey and for input injection. Sway and other wlroots compositors have no hotkey portal, so the user binds a key in the compositor config that calls our CLI.

**Level 2 is realistic on X11 only.** On Wayland we can read the text and follow the caret through AT-SPI, since that is plain D-Bus. We cannot turn character ranges into screen positions or draw at them in a portable way. Toolkits on Wayland report "screen" coordinates relative to their own window. GTK4 rejects screen coordinates outright. Placing an overlay at absolute coordinates needs wlr-layer-shell, which KWin and wlroots have and Mutter does not. On GNOME only a Shell extension can draw over other apps. A KDE-only or wlroots-only Level 2 is possible with compositor-specific glue, but I would not ship it before a Wayland-native accessibility protocol exists.

**Per-app enable/disable works everywhere, with effort.** On X11, read `_NET_ACTIVE_WINDOW` and `WM_CLASS`. On Wayland, AT-SPI focus events name the focused application on every compositor, as long as the app has accessibility turned on. On top of that, each compositor has its own source: a GNOME extension, a KWin script, or wlr-foreign-toplevel-management.

**The input-method route is worth a spike, but it is a different product.** An IBus engine or a Fcitx5 addon sees the text around the caret and can delete and commit text on all three Wayland families. It cannot underline anything in the app, it only sees about 4000 bytes around the caret, and it takes over the user's input method slot. That is a problem for anyone who types Chinese, Japanese or Korean.

**X11 is shrinking fast.** GNOME 50, released March 2026, removed the X11 session. KDE Plasma 6.8 ships on 2026-10-14 without one. X11 users are now mostly on Xfce, MATE, Cinnamon and older LTS releases. Any Linux plan has to be Wayland-first.

## Capability tables

"Portal" means xdg-desktop-portal. "wlroots" covers Sway, Hyprland, labwc, niri, river and Wayfire unless a cell says otherwise.

### Read the focused text field and follow the caret

| X11 | GNOME Wayland | KDE Wayland | wlroots |
|---|---|---|---|
| Yes, AT-SPI2 Text interface and `object:text-caret-moved` / `object:text-changed` events | Yes, same AT-SPI2 over D-Bus | Yes, same | Yes, same. The a11y bus runs as long as at-spi2-core is installed |

It works the same on every column because AT-SPI does not go through the display server. The per-toolkit caveats are in the details section. Chromium and Electron publish their tree only when accessibility is forced on, and Firefox may need `GNOME_ACCESSIBILITY=1`.

### Screen bounds of a character range

| X11 | GNOME Wayland | KDE Wayland | wlroots |
|---|---|---|---|
| Yes for GTK3, Qt, Chromium, Firefox. GTK4 returns window coordinates only, and we add the window origin from X11 | No. Toolkits return window-relative values. The window origin is only available from a Shell extension | Partial. Window-relative extents plus the window origin from a KWin script | Partial. Window-relative extents plus the window origin from Sway IPC or `hyprctl` |

### Transparent click-through overlay at absolute coordinates

| X11 | GNOME Wayland | KDE Wayland | wlroots |
|---|---|---|---|
| Yes. Override-redirect window with an empty XShape input region | No for a normal client. Mutter has no layer-shell. Only a Shell extension can draw there | Yes with wlr-layer-shell, overlay layer, empty or shaped input region | Yes with wlr-layer-shell on Sway, Hyprland, niri, labwc, river, Wayfire |

Tauri's own `set_position`, `always_on_top` and `cursor_position` do nothing on native Wayland.

### Non-activating hover card

| X11 | GNOME Wayland | KDE Wayland | wlroots |
|---|---|---|---|
| Yes. Override-redirect window, or `WM_HINTS` input=False | Only inside a Shell extension | Yes. Layer-shell surface with `keyboard_interactivity=none` | Yes, same as KDE |

There is no global cursor position on Wayland. Hover has to come from the overlay's own input region, set to the underline rectangles.

### Identity of the focused app

| X11 | GNOME Wayland | KDE Wayland | wlroots |
|---|---|---|---|
| Yes. `_NET_ACTIVE_WINDOW`, `WM_CLASS`, `_NET_WM_PID` | AT-SPI focus events, or a Shell extension over D-Bus | AT-SPI, or a KWin script as kdotool does | AT-SPI, or wlr-foreign-toplevel-management with the `activated` state. KWin and Mutter do not implement that protocol |

### Global hotkey

| X11 | GNOME Wayland | KDE Wayland | wlroots |
|---|---|---|---|
| Yes. `XGrabKey`, which is what Tauri's plugin does | GlobalShortcuts portal since GNOME 48 | GlobalShortcuts portal | Hyprland: portal yes. Sway and other xdg-desktop-portal-wlr users: no portal, so the user binds a key to our CLI |

`tauri-plugin-global-shortcut` sits on the `global-hotkey` crate, which is X11-only. Two Wayland PRs are still open.

### Read the current selection

| X11 | GNOME Wayland | KDE Wayland | wlroots |
|---|---|---|---|
| Yes. AT-SPI `GetSelection`, or the X11 PRIMARY selection with no copy needed | AT-SPI, or a simulated Ctrl+C and then reading the clipboard | Same as GNOME | Same. `wl-paste --primary` works where data-control exists |

### Replace text in another app

| X11 | GNOME Wayland | KDE Wayland | wlroots |
|---|---|---|---|
| AT-SPI EditableText, or clipboard plus XTest Ctrl+V | AT-SPI EditableText, or clipboard plus Ctrl+V through the RemoteDesktop portal and libei. The user sees a permission prompt | Same as GNOME | EditableText, or clipboard plus `virtual-keyboard-unstable-v1` as wtype does. No RemoteDesktop portal on xdg-desktop-portal-wlr or Hyprland today. uinput works everywhere as a last resort |

Chromium and Electron do not implement EditableText at all.

### Input-method route: surrounding text plus commit

| X11 | GNOME Wayland | KDE Wayland | wlroots |
|---|---|---|---|
| Yes. IBus or Fcitx5 through the XIM or GTK/Qt IM modules | Yes. GNOME Shell forwards text-input-v3 to IBus, and Fcitx5 plugs in as an IBus replacement | Yes. KWin supports input-method-v1 and text-input-v1, v2, v3 | Yes on Sway, Hyprland, niri, labwc, river through input-method-v2. Not on Wayfire |

## Details

### 1. AT-SPI2

**Interfaces we would use.** `org.a11y.atspi.Text` gives `GetText`, `GetCaretOffset`, `GetSelection`, `GetCharacterExtents` and `GetRangeExtents`. `org.a11y.atspi.EditableText` gives `SetTextContents`, `InsertText` and `DeleteText`. The events we need are `object:text-caret-moved`, `object:text-changed:insert/delete` and focus changes. This is the same model as AXUIElement on macOS and UIA TextPattern on Windows, so the core logic should carry over.

**Turning accessibility on.** Toolkits only publish their trees when the `org.a11y.Status.IsEnabled` D-Bus property is true ([xa11y quirks](https://xa11y.dev/explanation/accessibility-quirks/)). Do not set `ScreenReaderEnabled` to get that effect: on GNOME it starts Orca at every login ([trycua/cua#2010](https://github.com/trycua/cua/issues/2010)). Chromium and Electron expose only an application and frame skeleton until one of these is present: `--force-renderer-accessibility`, `ACCESSIBILITY_ENABLED=1`, or an AT detected at startup ([xa11y quirks](https://xa11y.dev/explanation/accessibility-quirks/), [omarchy-everything#5](https://github.com/brianblakely/omarchy-everything/issues/5)). The ibus-typing-booster docs say AT-SPI works by default on GNOME Wayland "except for the two browsers firefox and google-chrome", which need `GNOME_ACCESSIBILITY=1` ([ibus-typing-booster docs](https://mike-fabian.github.io/ibus-typing-booster/docs/user/)). Asking users to relaunch Chrome, VS Code or Slack with a flag is a real adoption cost. A full renderer accessibility tree also costs CPU in large pages **[unverified: I found no current measurement]**.

**Toolkit support, checked against source where I could.**

- **GTK4.** `GtkAccessibleText` arrived in GTK 4.14 ([GTK blog](https://blog.gtk.org/2024/03/08/accessibility-improvements-in-gtk-4-14/), [API docs](https://docs.gtk.org/gtk4/iface.AccessibleText.html)). In `gtk/a11y/gtkatspitext.c` on main, `GetCharacterExtents` and `GetRangeExtents` accept only `ATSPI_COORD_TYPE_PARENT` and `ATSPI_COORD_TYPE_WINDOW`. Anything else returns "Unsupported coordinate space" ([source](https://gitlab.gnome.org/GNOME/gtk/-/blob/main/gtk/a11y/gtkatspitext.c)). This holds on X11 too, so every GTK4 app needs the window origin from the display server. GTK4 advertises `EditableText` only while the widget has keyboard focus ([trycua/cua#1929](https://github.com/trycua/cua/pull/1929)). One report on GNOME Wayland found GNOME Text Editor showing zero text objects in the AT-SPI app tree ([OpenWhispr#2354](https://github.com/OpenWhispr/openwhispr/issues/2354)) **[unverified: single report, may depend on how the tree was walked]**.
- **GTK3.** ATK-based. It has had Text and EditableText for a long time. On Wayland its screen extents are window-relative because GDK does not know the window position ([GNOME wiki, Accessibility/Wayland](https://wiki.gnome.org/Accessibility/Wayland)).
- **Qt 5 and 6.** `qtbase/src/gui/accessible/linux/atspiadaptor.cpp` implements `EditableText` with `SetTextContents`, `InsertText` and `DeleteText`, and also `GetCharacterExtents` and `GetRangeExtents` ([source](https://github.com/qt/qtbase/blob/dev/src/gui/accessible/linux/atspiadaptor.cpp)). On KWin 6.7.4 Wayland, a kdialog mapped at (851,492) reported itself at (0,0) in SCREEN coordinates. Clicks worked only after adding the window origin fetched from KWin ([kwin-mcp#51](https://github.com/isac322/kwin-mcp/issues/51)).
- **Chromium and Electron.** `ui/accessibility/platform/ax_platform_node_auralinux.cc` on main implements the ATK Text interface, with `get_character_extents` and `get_range_extents`, plus Component, Action, Value, Document, Hypertext, Selection and Table. It has no `AtkEditableText` ([source](https://chromium.googlesource.com/chromium/src/+/refs/heads/main/ui/accessibility/platform/ax_platform_node_auralinux.cc)). xa11y makes the same observation. For replacements in Chrome, VS Code, Slack, Discord and Obsidian, we would select the range through the Text interface and then paste or type. On native Wayland Chromium reports window-relative positions ([oh-my-pi#13854](https://github.com/can1357/oh-my-pi/issues/13854)).
- **Firefox.** It exposes text objects in the AT-SPI app tree on GNOME Wayland ([OpenWhispr#2354](https://github.com/OpenWhispr/openwhispr/issues/2354)). It needs `GNOME_ACCESSIBILITY=1` on GNOME ([ibus-typing-booster docs](https://mike-fabian.github.io/ibus-typing-booster/docs/user/)). xa11y claims `MOZ_ACCESSIBILITY_ATK2=1` instead **[unverified: conflicting sources]**. Whether Firefox exposes EditableText on content-editable fields **[unverified]**.
- **LibreOffice.** The gtk3 VCL plugin is the most accessible variant on Linux. The Qt6 VCL plugin is catching up ([Michael Weghorn, FOSDEM 2025 slides](https://archive.fosdem.org/2025/events/attachments/fosdem-2025-6144-libreoffice-accessibility-on-linux-windows-and-macos/slides/237833/2025-02-0_olHMg5Z.pdf)). I did not check how well Writer's document body supports character extents **[unverified]**.
- **WebKitGTK.** Role reporting for `<textarea>` changed in 2.52 ([xa11y quirks](https://xa11y.dev/explanation/accessibility-quirks/)), a reminder that selectors break between versions.

**Coordinates on Wayland.** Wayland clients do not know where the compositor placed them, so SCREEN and WINDOW extents come out the same ([GNOME wiki](https://wiki.gnome.org/Accessibility/Wayland), [kwin-mcp#51](https://github.com/isac322/kwin-mcp/issues/51)). The at-spi2-core design notes for a next-generation protocol state that "all coordinates are relative to the containing surface, in contrast with AT-SPI's absolute screen coordinates" ([at-spi2-core devel docs](https://gnome.pages.gitlab.gnome.org/at-spi2-core/devel-docs/new-protocol.html)). Screen positions have to come from outside the app: window origin from the compositor, plus window-relative extents, plus an offset for client-side decorations and shadows. This gets harder with fractional scaling and several monitors. Computer-use agents such as kwin-mcp already do this on KDE ([kwin-mcp PR #61](https://github.com/isac322/kwin-mcp/pull/61)).

**Newton.** Newton is GNOME's Wayland-native accessibility prototype by Matt Campbell. Apps push their trees to the compositor over a new Wayland protocol ([GNOME a11y blog, June 2024](https://blogs.gnome.org/a11y/2024/06/18/update-on-newton-the-wayland-native-accessibility-project/)). Parts landed in GTK 4.18 and GNOME 48 ([Tobias Bernard, April 2025](https://blogs.gnome.org/tbernard/2025/04/)). The protocol and the consumer D-Bus API are still unmerged branches, so there is nothing we could target in 2026. It is also designed for screen readers talking to Mutter, not for third-party overlays.

**Rust.** The `atspi` crate from the Odilia screen reader project is a pure-Rust, async client built on zbus. The latest release is 0.30.0, and atspi-connection 0.14.0 came out in May 2026 ([crates.io](https://crates.io/crates/atspi), [lib.rs](https://lib.rs/crates/atspi-connection)). It fits a Tauri backend without C dependencies.

### 2. Overlay windows

**X11.** An override-redirect window skips the window manager, so it can sit at any root coordinate and never takes focus. An empty input region through the XShape extension's `ShapeInput` makes it click-through. A shaped region lets it catch hover only over the underlines. A compositing manager is needed for real transparency. This is the direct equivalent of what we do on macOS.

**Wayland, general.** In xdg-shell, a client cannot choose where a toplevel goes. Tauri 2.10.2 with tao 0.34.5 silently ignores `set_position`, the builder's `position` and `always_on_top` on Wayland ([tauri#14913](https://github.com/tauri-apps/tauri/issues/14913), Feb 2026). A September 2026 app PR reports `cursor_position()` returning NotSupported and `set_ignore_cursor_events` doing nothing on native Wayland ([arvinpaundra/float#7](https://github.com/arvinpaundra/float/pull/7)). The `set_ignore_cursor_events` part **[unverified: GTK input shapes should work on Wayland, so calling `gtk_widget_input_shape_combine_region` on the GTK window directly may still work]**.

**wlr-layer-shell.** Supported by KWin 6.7, Sway, Hyprland, niri, COSMIC, labwc, river, Wayfire and Mir. Not supported by Mutter or Weston ([wayland.app](https://wayland.app/protocols/wlr-layer-shell-unstable-v1)). A surface on the `overlay` layer, anchored to all four edges of one output, with `keyboard_interactivity=none`, is a full-screen transparent canvas for that output. We would create one per monitor and map compositor coordinates to output-local coordinates. Tauri on Linux runs GTK3 with WebKitGTK. The `gtk-layer-shell` library, GTK3 version, works on `window.gtk_window()` if called before the window maps ([wmww/gtk-layer-shell](https://github.com/wmww/gtk-layer-shell), [tao#925](https://github.com/tauri-apps/tao/issues/925)). One gotcha: Tauri's AppImage GTK hook forces XWayland, and then `gtk_layer_is_supported()` returns false ([tauri#15781](https://github.com/tauri-apps/tauri/issues/15781)).

**GNOME.** Mutter does not implement layer-shell and does not plan to ([voxtype#807](https://github.com/peteonrails/voxtype/issues/807), [wayland.app](https://wayland.app/protocols/wlr-layer-shell-unstable-v1)). An extension can add actors to `global.stage` or through `Main.layoutManager`. Those draw on top of every window and can be made transparent to input ([GNOME Discourse](https://discourse.gnome.org/t/create-new-window-widget-from-extension/7773)). A GNOME Level 2 would therefore put the underlines and the hover card inside a GJS extension. The extension would talk to our app over D-Bus, the same pattern as Kando's GNOME integration ([kando-menu/gnome-shell-integration](https://github.com/kando-menu/gnome-shell-integration)). The costs are a second codebase in GJS, a review on extensions.gnome.org, and a port for each GNOME Shell major release **[unverified: the per-release breakage is typical, not measured for this case]**.

**XWayland as a workaround.** If the overlay runs with `GDK_BACKEND=x11`, it becomes an XWayland client and can use override-redirect again. Writing Tools uses the same trick for its Wayland caveats ([WritingTools README](https://github.com/theJayTea/WritingTools)). I expect it to break under fractional scaling and to lose pointer tracking over native Wayland windows **[unverified: not tested]**.

**Absolute positioning protocols.** wayland-protocols 1.48, released 2026-04-01, added experimental `xx-zones`, which lets clients place windows at coordinates inside a compositor-provided zone ([Phoronix](https://www.phoronix.com/news/Wayland-Protocols-1.48)). wayland.app lists no mainstream compositor support. KWin has it only through an external kwin-zones plugin. It is not usable for us in 2026.

### 3. Knowing the focused app

- **X11.** Read `_NET_ACTIVE_WINDOW` on the root window, then `WM_CLASS` and `_NET_WM_PID` on that window. Watch `PropertyNotify` for changes ([EWMH spec](https://specifications.freedesktop.org/wm-spec/latest/)).
- **AT-SPI, any compositor.** A focus event carries the accessible object, and the object's application gives the app name. The D-Bus sender gives a PID through `GetConnectionUnixProcessID`. ibus-typing-booster relies on this on GNOME Wayland and Plasma Wayland. Its docs say it "mostly works just fine" but is less reliable than `xprop` ([ibus-typing-booster docs](https://mike-fabian.github.io/ibus-typing-booster/docs/user/)). It misses apps with accessibility off, which includes Chromium-based apps unless forced.
- **GNOME.** No Wayland protocol exists. Extensions such as Focused Window D-Bus, Window Calls Extended and Kando Integration expose the focused window's class, title and PID over D-Bus ([Focused Window D-Bus](https://extensions.gnome.org/extension/5592/focused-window-d-bus/), [window-calls-extended](https://github.com/hseliger/window-calls-extended)).
- **KDE.** KWin scripts can read `workspace.activeWindow`. kdotool wraps this, and espanso's Wayland app detection on KDE depends on kdotool ([espanso Linux docs](https://espanso.org/docs/install/linux/)).
- **wlroots.** `zwlr_foreign_toplevel_manager_v1` reports `app_id`, `title` and an `activated` state. Sway, Hyprland, niri, labwc, river, Wayfire and Mir implement it. KWin, Mutter and COSMIC do not ([wayland.app](https://wayland.app/protocols/wlr-foreign-toplevel-management-unstable-v1)). The newer `ext-foreign-toplevel-list-v1` has no activated state, so it cannot tell which window has focus. espanso 2.4.0, released 2026-07-21, added a `WaylandAppInfoProvider` for wlroots compositors ([espanso releases](https://github.com/espanso/espanso/releases)). Sway IPC and `hyprctl activewindow` are simpler still for those two.

### 4. Global hotkey

- **X11.** `XGrabKey` on the root window. The `global-hotkey` crate behind `tauri-plugin-global-shortcut` says "Linux (X11 Only)" ([global-hotkey](https://github.com/tauri-apps/global-hotkey)). On Wayland, the shortcut fires only while an XWayland window has focus, or never ([tauri#3578](https://github.com/tauri-apps/tauri/issues/3578), [Handy#949](https://github.com/cjpais/Handy/issues/949)). PR #162, "Wayland support", opened 2025-09-14. PR #172, "Unified Wayland support via XDG GlobalShortcuts portal", opened 2026-03-27. Both are still open, and the latest release is 0.8.0 from 2026-05-01 (checked with `gh`).
- **GlobalShortcuts portal support**, per the ArchWiki backend table ([ArchWiki](https://wiki.archlinux.org/title/XDG_Desktop_Portal)): xdg-desktop-portal-gnome yes, since GNOME 48. xdg-desktop-portal-kde yes. xdg-desktop-portal-hyprland yes. xdg-desktop-portal-wlr no, with [issue #240](https://github.com/emersion/xdg-desktop-portal-wlr/issues/240) still open. xdg-desktop-portal-cosmic no, with [issue #4](https://github.com/pop-os/xdg-desktop-portal-cosmic/issues/4) open. On niri, `BindShortcuts` fails with error 5 ([claude-desktop-debian notes](https://github.com/aaddrick/claude-desktop-debian/blob/main/docs/learnings/wayland-global-shortcuts-portal.md)). GNOME keys shortcuts by application ID and not by session, which broke Chrome 134 when it enabled the portal ([Chromium 404298968](https://issues.chromium.org/issues/404298968)).
- **Portal UX.** The user confirms or picks the key combination in a desktop dialog. Our app does not choose it. On Hyprland, the user binds the shortcut in `hyprland.conf` **[unverified]**. For a host app that is not a Flatpak, the portal needs a stable app ID from a `.desktop` file or registration **[unverified: exact mechanism depends on the xdg-desktop-portal version]**.
- **Fallback that works everywhere.** Ship a `prosed --trigger` CLI, or a D-Bus method, and document how to bind it in GNOME Settings custom shortcuts, KDE shortcuts, `sway/config` and `hyprland.conf`. Kando does this on KDE through a KWin shortcut ID ([Kando install docs](https://kando.menu/installation-on-linux/)).
- **Rust.** The `ashpd` crate wraps the portals, GlobalShortcuts and RemoteDesktop included **[unverified: I did not check the current ashpd version]**.

### 5. Input injection and replacing text

- **AT-SPI EditableText.** The clean path wherever it exists, meaning GTK3, GTK4 while focused, and Qt. For Chromium and Electron, set the selection with `Text.SetSelection` and then paste. There is no EditableText there.
- **X11.** XTest sends Ctrl+V or types characters. The PRIMARY selection holds the selected text without any copy, which makes reading the selection trivial.
- **RemoteDesktop portal with libei.** `ConnectToEIS` returns a file descriptor for a libei sender. Keyboard, pointer, buttons and scroll are supported. `persist_mode` plus `restore_token` let later sessions skip the prompt ([portal docs](https://flatpak.github.io/xdg-desktop-portal/docs/doc-org.freedesktop.portal.RemoteDesktop.html)). Implemented by GNOME and KDE ([ArchWiki](https://wiki.archlinux.org/title/XDG_Desktop_Portal)). COSMIC closed its RemoteDesktop request as completed on 2026-08-19, and the repo now has `remote_desktop_ei.rs` ([pop-os/xdg-desktop-portal-cosmic#23](https://github.com/pop-os/xdg-desktop-portal-cosmic/issues/23)). Hyprland's PR is open ([xdg-desktop-portal-hyprland#402](https://github.com/hyprwm/xdg-desktop-portal-hyprland/pull/402)). xdg-desktop-portal-wlr has none. The prompts are confusing. GNOME 48 shows "Allow remote interaction" for a local tool, and KDE says "Remote control requested" ([xdotool author's blog, Nov 2025](https://www.semicomplete.com/blog/xdotool-and-exploring-wayland-fragmentation/)). A libei gotcha on KDE: the keymap fd has to be read from offset 0 ([oh-my-pi#13848](https://github.com/can1357/oh-my-pi/issues/13848)).
- **wlroots.** `zwp_virtual_keyboard_manager_v1`, the protocol wtype uses, exists on Sway, Hyprland, niri, labwc, river, Wayfire and COSMIC. It is missing on KWin and Mutter ([wayland.app](https://wayland.app/protocols/virtual-keyboard-unstable-v1)).
- **uinput.** ydotool, dotool and espanso create a virtual evdev device. That works on every compositor, but it needs write access to `/dev/uinput`. espanso uses `setcap cap_dac_override+p` ([espanso Linux docs](https://espanso.org/docs/install/linux/)). It sends keycodes, not characters, so we have to know the user's layout. espanso asks for it in config. It is fine for Ctrl+V and bad for typing text.
- **Clipboard.** Our own window can always set the clipboard while it has focus, which is the case when the Level 1 popup is open. Reading or writing the clipboard in the background needs `ext-data-control-v1` or `wlr-data-control`. KWin, Sway, Hyprland, niri, labwc and COSMIC have them, and Mutter has neither on purpose ([wayland.app](https://wayland.app/protocols/ext-data-control-v1), [Clipway](https://github.com/Theblackcat98/clipway)). On GNOME, espanso's clipboard backend causes a visible flicker ([espanso Linux docs](https://espanso.org/docs/install/linux/)).
- **Commit through the input method.** fcitx5-text-bridge is a small Fcitx5 addon. It takes text on a Unix socket and calls `InputContext::commitString()`, with no key events and no clipboard ([981213/fcitx5-text-bridge](https://github.com/981213/fcitx5-text-bridge)). It is a neat trick for replacing text on any Wayland compositor where Fcitx5 is the active input method.

### 6. The input-method route

**How it works.** The app tells the compositor its surrounding text, cursor and cursor rectangle through `zwp_text_input_v3`, or through the GTK/Qt IM module on X11. The compositor forwards that to the input method. The input method can then send `delete_surrounding_text`, `commit_string` and `preedit_string` back, and open a popup surface that the compositor places next to the cursor ([text-input-v3](https://wayland.app/protocols/text-input-unstable-v3), [xx-input-method-v2](https://wayland.app/protocols/xx-input-method-v2)). A grammar engine could watch the sentence being typed, send it to Ollama, and offer the fix in the candidate popup. Accepting would delete the old range and commit the new one. The engine gets text, caret and positioned UI without AT-SPI or coordinates. That is the one Wayland-native path that also works on GNOME without an extension.

**Plumbing per desktop.**

- **GNOME.** GNOME Shell forwards text-input-v3 to ibus-daemon over D-Bus. Fcitx5 works by replacing ibus-daemon ([Fcitx wiki](https://fcitx-im.org/wiki/Using_Fcitx_5_on_Wayland)).
- **KDE.** KWin implements `zwp_input_method_v1` and text-input v1, v2 and v3. The input method is picked in System Settings under Virtual Keyboard ([Fcitx wiki](https://fcitx-im.org/wiki/Using_Fcitx_5_on_Wayland), [wayland.app](https://wayland.app/protocols/input-method-unstable-v1)).
- **wlroots.** `zwp_input_method_v2` is on Sway, Hyprland, niri, labwc, river and COSMIC, and missing on Wayfire, KWin and Mutter ([wayland.app](https://wayland.app/protocols/input-method-unstable-v2)). Sway 1.10+ is needed for the popup candidate window. IBus has had input-method-v2 work since about 1.5.32, and the 1.5.35-rc1 notes from 2026-09-22 mention forwarding key events in "Wayland input-method V2" (IBus releases, checked with `gh`).
- **New protocols.** wayland-protocols 1.48 also brought text-input fixes and an experimental keyboard-filter protocol for input methods ([Phoronix](https://www.phoronix.com/news/Wayland-Protocols-1.48)).

**Limits.**

- **Size.** Text-input messages cap surrounding text and commits at 4000 bytes. Apps send the text near the cursor, not the whole document ([text-input-v3](https://wayland.app/protocols/text-input-unstable-v3)). That is enough for a sentence or a paragraph, not for a document-level check.
- **Uneven support.** GTK's surrounding-text support is "poorly implemented" according to the Fcitx maintainer. Qt got text-input-v3 in 6.7 and important fixes in 6.8.2 ([Fcitx wiki](https://fcitx-im.org/wiki/Using_Fcitx_5_on_Wayland)). Chromium and Electron need `--enable-wayland-ime --wayland-text-input-version=3`, and v3 had cross-window bugs in 2025 ([Chromium 403319691](https://issuetracker.google.com/issues/403319691), [brave#45183](https://github.com/brave/brave-browser/issues/45183)). Terminals and Qt4 never send surrounding text. On GNOME Wayland, surrounding text returns wrong results after focus changes until one commit happens, and the cursor position does not update after mouse clicks ([ibus-typing-booster docs](https://mike-fabian.github.io/ibus-typing-booster/docs/user/)).
- **No styling.** "On Wayland it is not possible to indicate a possible spelling error in the preedit". The preedit is always underlined in the normal text colours ([ibus-typing-booster docs](https://mike-fabian.github.io/ibus-typing-booster/docs/user/)). We can never mark committed text in the app. There are no red underlines. The best we can offer is a suggestion popup at the caret.
- **One input method at a time.** An IBus engine replaces the user's engine while active. CJK users would have to switch back and forth. A Fcitx5 module, as opposed to an input-method engine, can hook events next to the active engine ([Fcitx developer handbook](http://fcitx.github.io/developer-handbook/fcitx-dev.html)), which may avoid that conflict **[unverified: needs a prototype]**. Fcitx5 on Wayland also sees one global input context ([Fcitx wiki](https://fcitx-im.org/wiki/Using_Fcitx_5_on_Wayland)).
- **GTK4 key forwarding.** goswitch, an IBus engine on GNOME 46 Wayland, reports that forwarded key events reach GTK4 apps but GTK4 widgets ignore them ([Djarvur/goswitch](https://github.com/Djarvur/goswitch)). Commits work. Forwarded keys do not.
- **Installation.** The user has to install and select the engine in the desktop's input settings. That is more friction than a tray app.

**Conclusion.** The IME route is a Wayland-friendly Level 1.5. It suggests a fix for the sentence at the caret and replaces it in place. It is not Level 2.

### 7. Prior art

- **Writing Tools** by theJayTea. A hotkey grammar and rewrite tool with an Ollama provider. The Linux version is "work-in-progress". It works on X11, and on Wayland only in XWayland apps or Flatpaks forced to X11 ([README](https://github.com/theJayTea/WritingTools)). It is the closest match to our Level 1 and did not solve Wayland.
- **LanguageTool.** Desktop apps for Windows and macOS only. The forum says there are no plans for a Linux desktop app ([LanguageTool forum](https://forum.languagetool.org/t/languagetool-on-linux/7808)). On Linux it lives in the browser and in editors.
- **Grammarly.** No Linux desktop app, only the browser extension **[unverified: from general knowledge and third-party guides such as [linuxvox](https://linuxvox.com/blog/grammarly-linux/)]**.
- **Harper** by Automattic. A local Rust grammar checker. On Linux it ships harper-ls, editor plugins and browser extensions. The system-wide desktop app is macOS-only and in early beta ([writewithharper.com](https://writewithharper.com/)). Worth a look as a fast local pre-filter before calling Ollama.
- **espanso.** Wayland support is labelled experimental. It uses evdev for input, uinput for output, a clipboard fallback and `cap_dac_override`. App detection works on KDE with kdotool and on wlroots since 2.4.0 ([docs](https://espanso.org/docs/install/linux/), [releases](https://github.com/espanso/espanso/releases)). It is the best example of shipping per-compositor backends.
- **Kando.** A pie menu. On Wayland it ships a GNOME Shell extension and a KWin script for hotkeys, focused window and pointer position ([gnome-shell-integration](https://github.com/kando-menu/gnome-shell-integration), [install docs](https://kando.menu/installation-on-linux/)). It is the model for our compositor glue.
- **Talon.** Linux support is X11 only, and "Wayland support is not planned" ([Talon wiki](https://talon.wiki/Resource%20Hub/Hardware/os/)). One third-party review says X11 support is leaving public releases **[unverified]**.
- **Orca.** Uses AT-SPI on both GNOME and KDE Wayland. Mouse review is broken on Wayland because it relied on at-spi-registryd's device event controller ([GNOME wiki](https://wiki.gnome.org/Accessibility/Wayland)). KWin is adding `org.freedesktop.a11y.PointerLocator` so ATs can find what is under the pointer ([KWin MR !9825](https://invent.kde.org/plasma/kwin/-/merge_requests/9825)). Even the reference AT gets no screen coordinates from Wayland.
- **ibus-typing-booster.** An IBus engine with hunspell spellcheck suggestions and AT-SPI app detection on Wayland. The closest thing to a grammar IME, and its docs list the Wayland limits quoted above ([docs](https://mike-fabian.github.io/ibus-typing-booster/docs/user/)).
- **goswitch.** A 2026 IBus engine that fixes wrong-layout text on GNOME Wayland with a hotkey ([repo](https://github.com/Djarvur/goswitch)). Same replace-at-caret mechanics we would use.
- **Dictation tools and computer-use agents**, such as OpenWhispr, Handy, cua and kwin-mcp. They hit the same walls: AT-SPI text gaps on GNOME ([OpenWhispr#2354](https://github.com/OpenWhispr/openwhispr/issues/2354)), no hotkeys on wlroots ([Handy#949](https://github.com/cjpais/Handy/issues/949)), and window-relative coordinates ([kwin-mcp#51](https://github.com/isac322/kwin-mcp/issues/51)). Their issue trackers are a good source of edge cases.

I found no shipping product with Grammarly-style inline underlines in arbitrary apps on Linux, on X11 or Wayland.

## Recommended plan

1. **Level 1 first, Wayland-first.** Build these backends behind one Rust trait each, and pick at runtime from `XDG_SESSION_TYPE` and `XDG_CURRENT_DESKTOP`.
   - **Trigger.** GlobalShortcuts portal through ashpd on GNOME 48+, KDE and Hyprland. XGrabKey on X11. A `--trigger` CLI or D-Bus method everywhere else, with documented bindings for Sway and COSMIC. Do not wait for global-hotkey PR #172. It may land, but it will not cover Sway.
   - **Read the selection.** AT-SPI `GetSelection` on the focused object. Then X11 PRIMARY. Then simulated Ctrl+C and a clipboard read.
   - **Popup.** A normal toplevel on GNOME, where it will open centered or wherever Mutter puts it. A layer-shell surface near the caret on KDE and wlroots when AT-SPI plus compositor geometry give a usable position, otherwise centered. Override-redirect near the selection on X11.
   - **Replace.** AT-SPI EditableText when present. Otherwise clipboard plus Ctrl+V through XTest on X11, RemoteDesktop with libei on GNOME and KDE, virtual-keyboard on wlroots. uinput only as an opt-in fallback, since it needs elevated permissions.
2. **Per-app toggle.** AT-SPI focus events plus X11 properties first. That covers most apps with no desktop-specific code. Add wlr-foreign-toplevel for Sway and Hyprland, then optional KWin script and GNOME extension backends when Chromium-based apps show up as "unknown".
3. **Research spike on the input-method route.** A throwaway IBus engine in Python, or a Fcitx5 module. Measure surrounding-text quality in GNOME Text Editor, gedit, Firefox, Chrome with the Wayland IME flags, VS Code, Slack, LibreOffice, Kate and Thunderbird, on GNOME and KDE. Decide after that whether a "suggest at caret" mode is worth shipping.
4. **Level 2 on Linux: not now.** The Wayland prerequisites would be screen positions from a Wayland-native accessibility protocol, or a standard for window geometry, plus an overlay protocol that Mutter implements. None of these exists in September 2026. X11 alone is possible but serves a shrinking, mostly non-GNOME and non-KDE audience. If demand shows up, the cheapest experiment is KDE-only: AT-SPI extents, window origin from a KWin script, one layer-shell overlay per output with shaped input for hover.
5. **Distribution.** Ship a deb/rpm or a native Wayland AppImage with `GDK_BACKEND=wayland` honored, since the AppImage GTK hook breaks layer-shell ([tauri#15781](https://github.com/tauri-apps/tauri/issues/15781)). Flatpak adds sandbox friction for AT-SPI and uinput. Wait with it until the portal paths are stable.

## Open questions I could not settle

- Whether `set_ignore_cursor_events` truly does nothing on Tauri Wayland, or whether a direct GTK input-shape call works.
- Firefox's exact switch for enabling accessibility, and its EditableText support for web content.
- How well LibreOffice Writer supports character extents for the document body.
- How XWayland override-redirect overlays behave on Mutter and KWin under fractional scaling.
- Whether a Fcitx5 module can offer suggestions without replacing the user's active input method.
- The exact app-ID requirements for non-Flatpak apps using the GlobalShortcuts and RemoteDesktop portals.
