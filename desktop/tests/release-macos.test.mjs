import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

const identity = "Developer ID Application: Test Developer (TESTTEAM01)";

function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), "prosed-release-"));
  const bin = join(root, "bin");
  t.after(() => execFileSync("trash", [root]));
  mkdirSync(join(root, "desktop/scripts"), { recursive: true });
  mkdirSync(join(root, "desktop/src-tauri"));
  const script = readFileSync(new URL("../scripts/release-macos.sh", import.meta.url), "utf8");
  writeFileSync(join(root, "desktop/scripts/release-macos.sh"), script.replaceAll("/usr/bin/xcrun", join(bin, "xcrun")));
  writeFileSync(join(root, "desktop/src-tauri/tauri.conf.json"), JSON.stringify({ version: "0.2.3" }));
  writeFileSync(join(root, "desktop/src-tauri/Cargo.toml"), '[package]\nname = "prosed"\nversion = "0.2.3"\n');
  mkdirSync(bin);
  const mock = join(bin, "mock");
  writeFileSync(mock, `#!${process.execPath}
const fs = require("node:fs");
const path = require("node:path");
const tool = path.basename(process.argv[1]);
const args = process.argv.slice(2);
const operation = [tool, ...args.slice(0, 2)].join(" ");
fs.appendFileSync(process.env.FIXTURE_ROOT + "/commands.log", operation + "\\n");
if (process.env.FAIL_OPERATION && operation.startsWith(process.env.FAIL_OPERATION)) process.exit(1);
if (tool === "uname") console.log("Darwin");
if (tool === "lipo") console.log(process.env.ARCHITECTURES || "x86_64 arm64");
if (tool === "security") console.log('1) TESTHASH "${identity}"');
if (tool === "devenv") {
  const bundle = "target/universal-apple-darwin/release/bundle";
  fs.mkdirSync(bundle + "/macos/prosed.app/Contents/MacOS", { recursive: true });
  fs.mkdirSync(bundle + "/dmg");
  fs.writeFileSync(bundle + "/macos/prosed.app/Contents/MacOS/prosed", "binary");
  fs.writeFileSync(bundle + "/dmg/prosed_0.2.3_universal.dmg", "dmg");
}
if (tool === "codesign" && args[0] === "--display") {
  console.error("Authority=${identity}");
  if (!process.env.NO_TIMESTAMP) console.error("Timestamp=Oct 28, 2026");
  if (!process.env.NO_RUNTIME) console.error("CodeDirectory flags=0x10000(runtime)");
}
if (tool === "otool") console.log(process.env.NIX_LINK ? "/nix/store/test/lib.dylib" : "/usr/lib/libiconv.2.dylib");
if (tool === "xcrun" && args[0] === "notarytool" && args[1] === "submit") {
  console.log(JSON.stringify({ id: "submission-123", status: process.env.NOTARY_STATUS || "Accepted" }));
}
if (tool === "xcrun" && args[0] === "stapler" && args[1] === "staple" && args[2].endsWith(".dmg")) {
  fs.appendFileSync(args[2], "stapled");
}
`, { mode: 0o755 });
  for (const tool of ["uname", "security", "devenv", "lipo", "codesign", "otool", "xcrun", "spctl", "hdiutil"]) {
    symlinkSync(mock, join(bin, tool));
  }
  return {
    root,
    run(env = {}) {
      return spawnSync("bash", [join(root, "desktop/scripts/release-macos.sh")], {
        env: { ...process.env, PATH: `${bin}:${process.env.PATH}`, FIXTURE_ROOT: root, APPLE_SIGNING_IDENTITY: identity, ...env },
        encoding: "utf8",
      });
    },
  };
}

test("generates a universal cask using the checksum after stapling", (t) => {
  const { root, run } = fixture(t);
  const result = run();
  assert.equal(result.status, 0, result.stderr);
  const checksum = createHash("sha256").update("dmgstapled").digest("hex");
  const cask = readFileSync(join(root, "Casks/prosed.rb"), "utf8");
  assert.ok(cask.includes(`sha256 "${checksum}"`));
  assert.ok(cask.includes('desktop-v#{version}/prosed_#{version}_universal.dmg'));
  assert.ok(cask.includes('depends_on macos: :monterey'));
  const commands = readFileSync(join(root, "commands.log"), "utf8");
  assert.match(commands, /lipo -archs/);
  assert.match(commands, /spctl --assess --type/);
});

test("rejects a mismatched package version even if a dependency has the release version", (t) => {
  const { root, run } = fixture(t);
  writeFileSync(join(root, "desktop/src-tauri/Cargo.toml"), '[package]\nversion = "0.2.2"\n[dependencies.example]\nversion = "0.2.3"\n');
  const result = run();
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Use the same stable version/);
  assert.equal(existsSync(join(root, "Casks/prosed.rb")), false);
});

for (const [name, env, message] of [
  ["rejects development certificates", { APPLE_SIGNING_IDENTITY: "Apple Development: Test" }, /Set APPLE_SIGNING_IDENTITY/],
  ["requires a valid private key", { APPLE_SIGNING_IDENTITY: "Developer ID Application: Missing" }, /private key must be installed/],
  ["requires notarization credentials", { FAIL_OPERATION: "xcrun notarytool history" }, /Configure the notarization keychain profile/],
  ["requires both binary architectures", { FAIL_OPERATION: "lipo" }, null],
  ["rejects a binary containing only one architecture", { ARCHITECTURES: "arm64" }, /both arm64 and x86_64/],
  ["requires a secure timestamp", { NO_TIMESTAMP: "1" }, /secure Apple timestamp/],
  ["requires the hardened runtime", { NO_RUNTIME: "1" }, /hardened runtime/],
  ["rejects Nix library dependencies", { NIX_LINK: "1" }, /links to \/nix\/store/],
  ["rejects a failed notarization status even with exit code zero", { NOTARY_STATUS: "Invalid" }, /Notarization Invalid/],
  ["requires Gatekeeper acceptance", { FAIL_OPERATION: "spctl" }, null],
]) {
  test(name, (t) => {
    const { root, run } = fixture(t);
    const result = run(env);
    assert.notEqual(result.status, 0);
    if (message) assert.match(result.stderr, message);
    assert.equal(existsSync(join(root, "Casks/prosed.rb")), false);
  });
}
