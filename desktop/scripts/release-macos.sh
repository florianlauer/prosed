#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/../.."
repo_root="$PWD"
notary_profile="${NOTARYTOOL_PROFILE:-prosed}"
signing_identity="${APPLE_SIGNING_IDENTITY:-}"

# Apple signing tools need Xcode's SDK when invoked from a Nix shell.
unset DEVELOPER_DIR SDKROOT

fail() {
  printf '%s\n' "$*" >&2
  exit 1
}

[[ "$(uname -s)" == Darwin ]] || fail "Build macOS releases on a Mac."
[[ "$signing_identity" == "Developer ID Application: "* ]] ||
  fail 'Set APPLE_SIGNING_IDENTITY to your full Developer ID Application certificate name.'
identities="$(security find-identity -v -p codesigning)"
grep -Fq "\"$signing_identity\"" <<< "$identities" ||
  fail "The Developer ID Application certificate and its private key must be installed in your keychain."
/usr/bin/xcrun notarytool history --keychain-profile "$notary_profile" >/dev/null ||
  fail "Configure the notarization keychain profile '$notary_profile' with /usr/bin/xcrun notarytool store-credentials."

version="$(node --input-type=module -e '
  import { readFileSync } from "node:fs";
  const config = JSON.parse(readFileSync("desktop/src-tauri/tauri.conf.json", "utf8"));
  const cargo = readFileSync("desktop/src-tauri/Cargo.toml", "utf8");
  const cargoVersion = cargo.match(/^version = "([^"]+)"$/m)?.[1];
  if (!/^\d+\.\d+\.\d+$/.test(config.version) || cargoVersion !== config.version) {
    throw new Error("Use the same stable version in tauri.conf.json and Cargo.toml.");
  }
  process.stdout.write(config.version);
')"

# Notarization uses the keychain profile below, rather than Tauri's environment credentials.
unset APPLE_ID APPLE_PASSWORD APPLE_API_ISSUER APPLE_API_KEY APPLE_API_KEY_PATH
export APPLE_SIGNING_IDENTITY="$signing_identity"
export CI=true
cd desktop/src-tauri
devenv shell -- cargo tauri build --target universal-apple-darwin --bundles app,dmg -- --locked

bundle="$repo_root/desktop/src-tauri/target/universal-apple-darwin/release/bundle"
app="$bundle/macos/prosed.app"
dmg="$bundle/dmg/prosed_${version}_universal.dmg"
[[ -d "$app" && -f "$dmg" ]] || fail "The universal app bundle or DMG is missing."
binary="$app/Contents/MacOS/prosed"
architectures="$(lipo -archs "$binary")"
{ grep -qw arm64 <<< "$architectures" && grep -qw x86_64 <<< "$architectures"; } ||
  fail "The app must contain both arm64 and x86_64 binaries."
codesign --verify --deep --strict --verbose=2 "$app"
signature="$(codesign --display --verbose=4 "$app" 2>&1)"
grep -Fqx "Authority=$signing_identity" <<< "$signature" || fail "Unexpected app signing certificate."
grep -q '^Timestamp=' <<< "$signature" || fail "The app signature needs a secure Apple timestamp."
grep -q 'flags=.*(runtime)' <<< "$signature" || fail "The app must enable the hardened runtime."
libraries="$(otool -L "$binary")"
if grep -q '/nix/store/' <<< "$libraries"; then
  fail "The app links to /nix/store libraries that are unavailable on other Macs."
fi

# A rejected submission can exit successfully; check Apple's status before generating the cask.
mkdir -p "$repo_root/desktop/release"
submission="$repo_root/desktop/release/notarization.json"
/usr/bin/xcrun notarytool submit "$dmg" --keychain-profile "$notary_profile" --wait --output-format json > "$submission"
node --input-type=module -e '
  import { readFileSync } from "node:fs";
  const result = JSON.parse(readFileSync(process.argv[1], "utf8"));
  if (result.status !== "Accepted") {
    throw new Error(`Notarization ${result.status}. Retrieve the log with /usr/bin/xcrun notarytool log ${result.id} --keychain-profile "${process.argv[2]}".`);
  }
' "$submission" "$notary_profile"
/usr/bin/xcrun stapler staple "$app"
/usr/bin/xcrun stapler validate "$app"
/usr/bin/xcrun stapler staple "$dmg"
/usr/bin/xcrun stapler validate "$dmg"
spctl --assess --type execute --verbose=2 "$app"
spctl --assess --type open --context context:primary-signature --verbose=2 "$dmg"
hdiutil verify "$dmg"

# Stapling changes the DMG bytes; Homebrew needs the checksum of the final artifact.
checksum="$(shasum -a 256 "$dmg" | awk '{print $1}')"
mkdir -p "$repo_root/Casks"
cat > "$repo_root/Casks/prosed.rb" <<EOF
cask "prosed" do
  version "$version"
  sha256 "$checksum"

  url "https://github.com/florianlauer/prosed/releases/download/desktop-v#{version}/prosed_#{version}_universal.dmg"
  name "prosed"
  desc "Grammar checker for text fields across macOS apps"
  homepage "https://github.com/florianlauer/prosed"

  depends_on macos: :monterey

  app "prosed.app"

  caveats <<~EOS
    Grant prosed Accessibility access in System Settings > Privacy & Security.
    Choose a cloud provider in settings, or install Ollama for local checks.
  EOS
end
EOF
printf '\nVerified DMG: %s\nHomebrew cask: %s\n' "$dmg" "$repo_root/Casks/prosed.rb"
