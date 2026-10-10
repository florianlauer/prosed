import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { Content } from "../content";
import { type Frame, type Popup, buildFrames, segments, stillFrameIndex } from "../demo/frames";

type Ui = Content["demo"]["ui"];

export function Demo({ demo }: { demo: Content["demo"] }) {
  const frames = useMemo(() => buildFrames(demo), [demo]);
  const still = stillFrameIndex(frames);
  // The field is sized by the longest text it will show, so typing never moves the page.
  const longest = useMemo(
    () => frames.reduce((a, { text }) => (text.length > a.length ? text : a), ""),
    [frames],
  );
  // The server, no-JS visitors and reduced motion all get the still frame.
  const [index, setIndex] = useState(still);
  const root = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!root.current) return;
    // Reduced motion sets data-motion="paused" on <html> (see THEME_SCRIPT).
    const paused = () => document.documentElement.dataset.motion === "paused";
    // Start from the still frame the server rendered, so hydration doesn't blank the field.
    let next = still;
    let visible = false;
    // Hovering holds the current step, so a visitor can read a card.
    let hovered = false;
    let timer: number | undefined;
    const stop = () => {
      clearTimeout(timer);
      timer = undefined;
    };
    const run = () => {
      if (timer !== undefined || !visible || hovered || document.hidden || paused()) return;
      setIndex(next);
      timer = window.setTimeout(() => {
        timer = undefined;
        next = (next + 1) % frames.length;
        run();
      }, frames[next]?.hold ?? 0);
    };
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry?.isIntersecting ?? false;
      if (visible) run();
      else stop();
    });
    const onVisibility = () => (document.hidden ? stop() : run());
    const onEnter = () => {
      hovered = true;
      stop();
    };
    const onLeave = () => {
      hovered = false;
      run();
    };
    const figure = root.current;
    observer.observe(figure);
    document.addEventListener("visibilitychange", onVisibility);
    figure.addEventListener("pointerenter", onEnter);
    figure.addEventListener("pointerleave", onLeave);
    return () => {
      stop();
      observer.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
      figure.removeEventListener("pointerenter", onEnter);
      figure.removeEventListener("pointerleave", onLeave);
    };
  }, [frames, still]);

  // Popups open from their anchor; nudge one back inside the field when it would cross the right edge.
  useLayoutEffect(() => {
    const field = root.current?.querySelector<HTMLElement>(".demo-field");
    const pop = field?.querySelector<HTMLElement>(".demo-text .demo-pop");
    if (!field || !pop) return;
    pop.style.removeProperty("--shift");
    const box = pop.getBoundingClientRect();
    const edge = field.getBoundingClientRect();
    // Keep the popup inside the field's padding, so it lines up with the text column.
    const inset = parseFloat(getComputedStyle(field).paddingInlineEnd);
    const right = box.right - edge.right + inset;
    if (right > 0) pop.style.setProperty("--shift", `${-right}px`);
  }, [index]);

  const frame = frames[index];
  if (!frame) return null;
  return (
    <figure className="demo" ref={root} data-frame={index}>
      <figcaption className="sr-only">{demo.label}</figcaption>
      <div className="demo-field" aria-hidden="true">
        <p className="demo-ghost">{longest}</p>
        <p className="demo-text">
          {segments(frame).map((part) => {
            const popup =
              frame.popup && "on" in frame.popup && frame.popup.on.start === part.start ? (
                <span className="demo-anchor">
                  <PopupView popup={frame.popup} frame={frame} ui={demo.ui} />
                </span>
              ) : null;
            // A fix opens under the word; a rewrite under the end of the selection.
            const atEnd = frame.popup?.kind !== "fix";
            return (
              <span key={part.start} className={part.mark ? `demo-${part.mark}` : undefined}>
                {atEnd ? null : popup}
                {part.text}
                {atEnd ? popup : null}
              </span>
            );
          })}
          <span className="demo-caret" />
        </p>
        {frame.badge > 0 ? (
          <span className="demo-badge">
            <span className="demo-count">{frame.badge}</span>
            {frame.popup?.kind === "panel" ? (
              <PopupView popup={frame.popup} frame={frame} ui={demo.ui} />
            ) : null}
          </span>
        ) : null}
      </div>
    </figure>
  );
}

// A mouse arrow, so the visitor sees what the demo clicks.
function Pointer({ press }: { press: boolean }) {
  return (
    <svg className="demo-pointer" data-press={press} viewBox="0 0 16 20" width="16" height="20">
      <path d="M1 1v15.5l4.2-3.9 2.7 6.1 2.6-1.1-2.7-6h5.9z" />
    </svg>
  );
}

// Spans only: the popups sit inside a <p>.
function PopupView({ popup, frame, ui }: { popup: Popup; frame: Frame; ui: Ui }) {
  const pointer = <Pointer press={frame.press} />;
  switch (popup.kind) {
    case "fix":
      return (
        <span className="demo-pop demo-card">
          <span className="demo-was">{frame.text.slice(popup.on.start, popup.on.end)}</span>
          <span className="demo-apply" data-press={frame.press}>
            {popup.to}
            {pointer}
          </span>
        </span>
      );
    case "panel":
      return (
        <span className="demo-pop demo-panel">
          <span className="demo-panel-head">
            <span className="demo-heading">{ui.fixes}</span>
            <span className="demo-accept" data-press={frame.press}>
              {ui.acceptAll}
              {pointer}
            </span>
          </span>
          {popup.items.map((item) => (
            <span key={item.from} className="demo-row">
              <span className="demo-del">{item.from}</span>
              <span className="demo-ins">{item.to}</span>
            </span>
          ))}
        </span>
      );
    case "rewrite-button":
      return (
        <span className="demo-pop demo-rewrite-button" data-press={frame.press}>
          <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
            <path d="M11.017 2.814a1 1 0 0 1 1.966 0l1.051 5.558a2 2 0 0 0 1.594 1.594l5.558 1.051a1 1 0 0 1 0 1.966l-5.558 1.051a2 2 0 0 0-1.594 1.594l-1.051 5.558a1 1 0 0 1-1.966 0l-1.051-5.558a2 2 0 0 0-1.594-1.594l-5.558-1.051a1 1 0 0 1 0-1.966l5.558-1.051a2 2 0 0 0 1.594-1.594z" />
          </svg>
          {ui.rewrite}
          {pointer}
        </span>
      );
    case "rewrite":
      return (
        <span className="demo-pop demo-card demo-rewrites">
          <span className="demo-heading">{ui.rewrites}</span>
          {popup.variants.map((variant, i) => (
            <span
              key={variant}
              className="demo-variant"
              data-picked={popup.picked === i}
              data-press={popup.picked === i && frame.press}
            >
              {variant}
              {popup.picked === i ? pointer : null}
            </span>
          ))}
        </span>
      );
  }
}
