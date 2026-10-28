import { Fragment, useRef, useState } from "react";
import type { Content } from "../content";
import { REPO } from "../download";
import { Icon } from "./Icon";

const COMMANDS = [
  `brew tap florianlauer/prosed ${REPO}`,
  "brew trust --cask florianlauer/prosed/prosed",
  "brew install --cask florianlauer/prosed/prosed",
];

export function Homebrew({ labels }: { labels: Content["hero"]["homebrew"] }) {
  const code = useRef<HTMLElement>(null);
  const [status, setStatus] = useState<"idle" | "copied" | "selected">("idle");

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(COMMANDS.join("\n"));
      setStatus("copied");
    } catch {
      if (code.current) {
        const range = document.createRange();
        range.selectNodeContents(code.current);
        const selection = window.getSelection();
        selection?.removeAllRanges();
        selection?.addRange(range);
      }
      setStatus("selected");
    }
  };

  return (
    <aside className="homebrew" aria-label={labels.title}>
      <pre>
        <code ref={code}>
          {COMMANDS.map((command, index) => (
            <Fragment key={command}>
              {index > 0 ? "\n" : null}
              {command.split("/").map((part, partIndex) => (
                <Fragment key={partIndex}>
                  {partIndex > 0 ? (
                    <>
                      /<wbr />
                    </>
                  ) : null}
                  {part}
                </Fragment>
              ))}
            </Fragment>
          ))}
        </code>
      </pre>
      <div className="homebrew-footer">
        <p role="status">{status === "selected" ? labels.copyFailed : labels.hint}</p>
        <button type="button" className="homebrew-copy" onClick={copy}>
          <Icon name="copy" size={14} />
          <span aria-live="polite">{status === "copied" ? labels.copied : labels.copy}</span>
        </button>
      </div>
    </aside>
  );
}
