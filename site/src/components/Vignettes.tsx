import type { CSSProperties } from "react";
import type { Content } from "../content";

type V = Content["vignettes"];

// Each vignette loops one behaviour in CSS (vignettes.css). They illustrate the text beside them,
// so assistive tech skips them.

export function FixVignette({ fix }: { fix: V["fix"] }) {
  return (
    <div className="vignette" aria-hidden="true">
      <p>
        {fix.before}
        <span className="vf-word">
          <span className="vf-from demo-mistake">{fix.from}</span>
          <span className="vf-to">{fix.to}</span>
          <span className="demo-pop vf-card">
            <span className="demo-was">{fix.from}</span>
            <span className="demo-apply vf-apply">{fix.to}</span>
          </span>
          {/* After the fix: the undo is one shortcut away. */}
          <span className="vf-undo">
            <kbd>Cmd</kbd>
            <kbd>Z</kbd>
          </span>
        </span>
        {fix.after}
      </p>
    </div>
  );
}

export function RewriteVignette({ rewrite }: { rewrite: V["rewrite"] }) {
  return (
    <div className="vignette" aria-hidden="true">
      <p>
        <span className="vr-sel">{rewrite.sentence}</span>
      </p>
      <ul className="vr-variants">
        {rewrite.variants.map((variant, i) => (
          <li key={variant} style={{ "--i": i } as CSSProperties}>
            {variant}
          </li>
        ))}
      </ul>
    </div>
  );
}

// Names a dictionary would hold in any language.
const WORDS = ["Lyon", "gemma4", "Vercel"];

export function MemoryVignette({ memory }: { memory: V["memory"] }) {
  return (
    <div className="vignette" aria-hidden="true">
      <p className="vm-label">{memory.dictionary}</p>
      <ul className="vm-chips">
        {WORDS.map((word) => (
          <li key={word}>{word}</li>
        ))}
        <li className="vm-new">prosed</li>
      </ul>
      <p className="vm-label">{memory.ignored}</p>
      <p className="vm-ignored">
        <span className="demo-del">{memory.from}</span>
        <span className="demo-ins">{memory.to}</span>
      </p>
    </div>
  );
}
