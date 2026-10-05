{ pkgs, lib, ... }:

{
  # The desktop app (desktop/) is Tauri: Rust, plus the Windows target to check the UI Automation code from a Mac.
  languages.rust = {
    enable = true;
    channel = "stable";
    targets = [ "x86_64-pc-windows-msvc" ];
  };

  packages = [
    pkgs.cargo-tauri
    pkgs.cargo-xwin
    # cargo xwin builds for Windows with clang-cl, and llvm-rc embeds the icon
    pkgs.llvm
    pkgs.llvmPackages.clang-unwrapped
    pkgs.lld
    # the Windows installer
    pkgs.nsis
  ] ++ lib.optionals pkgs.stdenv.isLinux [
    pkgs.pkg-config
    pkgs.gtk3
    pkgs.webkitgtk_4_1
    pkgs.libsoup_3
    pkgs.librsvg
    pkgs.dbus
    pkgs.openssl
  ];
}
