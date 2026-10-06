// The DOM pieces of the popovers that the desktop app draws too.
import { diffSegments, type Hunk } from "./text";
import { localize } from "../i18n/dom.ts";

// Lucide paths, stroked with currentColor so the trigger's state sets the colour.
export const checkIcon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21.801 10A10 10 0 1 1 17 3.335"/><path d="m9 11 3 3L22 4"/></svg>`;

export const powerIcon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 7v4"/><path d="M7.998 9.003a5 5 0 1 0 8-.005"/><circle cx="12" cy="12" r="10"/></svg>`;

export const rewriteIcon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11.017 2.814a1 1 0 0 1 1.966 0l1.051 5.558a2 2 0 0 0 1.594 1.594l5.558 1.051a1 1 0 0 1 0 1.966l-5.558 1.051a2 2 0 0 0-1.594 1.594l-1.051 5.558a1 1 0 0 1-1.966 0l-1.051-5.558a2 2 0 0 0-1.594-1.594l-5.558-1.051a1 1 0 0 1 0-1.966l5.558-1.051a2 2 0 0 0 1.594-1.594z"/></svg>`;

export const spinnerIcon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="8" opacity="0.2"/><path d="M20 12a8 8 0 0 0-8-8"/></svg>`;

// A clickable "removed → added" chunk, used in the tooltip and the suggestion card.
export function renderChange(removed: string, added: string, onClick: () => void) {
  // a span, not a <button>, so the change keeps wrapping with the surrounding text
  const chunk = document.createElement("span");
  chunk.className = "aig-change";
  chunk.role = "button";
  chunk.tabIndex = 0;
  localize(chunk, "applyChange", {}, "title");
  chunk.addEventListener("click", onClick);
  chunk.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onClick();
    }
  });

  const del = document.createElement("del");
  del.className = "aig-del";
  del.textContent = removed;

  const ins = document.createElement("ins");
  ins.className = "aig-ins";
  ins.textContent = added;

  chunk.append(del, ins);
  return chunk;
}

export function createDiff(
  str1: string,
  str2: string,
  onApply: (hunk: Hunk) => void,
) {
  const fragment = document.createDocumentFragment();

  for (const segment of diffSegments(str1, str2)) {
    if (!("hunk" in segment)) {
      fragment.appendChild(document.createTextNode(segment.text));
      continue;
    }

    fragment.appendChild(
      renderChange(segment.removed, segment.hunk.replacement, () =>
        onApply(segment.hunk),
      ),
    );
  }

  return fragment;
}
