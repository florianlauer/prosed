import { useEffect, useState } from "react";
import { DOWNLOADS, type Target, targetFrom } from "../download";
import { Icon, type IconName } from "./Icon";

export const TARGET_ICON: Record<Target, IconName> = {
  macos: "apple",
  windows: "windows",
  extension: "chrome",
};

export function useTarget(): Target {
  const [target, setTarget] = useState<Target>("macos");
  useEffect(() => setTarget(targetFrom(navigator.userAgent)), []);
  return target;
}

export function DownloadButton({ target, label }: { target: Target; label: string }) {
  return (
    <a className="button button-primary" href={DOWNLOADS[target]}>
      <Icon name={TARGET_ICON[target]} size={18} />
      {label}
    </a>
  );
}
