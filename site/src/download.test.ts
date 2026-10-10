import { describe, expect, it } from "vite-plus/test";
import { DOWNLOADS, targetFrom } from "./download";

const UA = {
  mac: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0 Safari/537.36",
  windows:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0 Safari/537.36",
  linux:
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0 Safari/537.36",
  chromeos:
    "Mozilla/5.0 (X11; CrOS x86_64 16000.0.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0 Safari/537.36",
  iphone:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 19_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/19.0 Mobile/15E148 Safari/604.1",
  android:
    "Mozilla/5.0 (Linux; Android 16; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0 Mobile Safari/537.36",
};

describe("targetFrom", () => {
  it("offers the desktop app for macOS", () => expect(targetFrom(UA.mac)).toBe("macos"));
  it("offers the desktop app for Windows", () => expect(targetFrom(UA.windows)).toBe("windows"));
  it("offers the extension on Linux and ChromeOS, which have no desktop app", () => {
    expect(targetFrom(UA.linux)).toBe("extension");
    expect(targetFrom(UA.chromeos)).toBe("extension");
  });
  it("keeps the macOS default on phones, whose user agents mention Mac OS X or Linux", () => {
    expect(targetFrom(UA.iphone)).toBe("macos");
    expect(targetFrom(UA.android)).toBe("macos");
  });
});

describe("DOWNLOADS", () => {
  it("sends the desktop targets to the desktop releases, not to the extension's latest release", () => {
    expect(DOWNLOADS.macos).toContain("desktop");
    expect(DOWNLOADS.windows).toContain("desktop");
    expect(DOWNLOADS.extension).toMatch(/\/releases\/latest$/);
  });
});
