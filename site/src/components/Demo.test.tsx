import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vite-plus/test";
import { contentFor } from "../content";
import { Demo } from "./Demo";

describe("Demo", () => {
  it("prerenders the still frame: two underlined words and the open fix card", () => {
    const demo = contentFor("fr").demo;
    const html = renderToString(<Demo demo={demo} />);
    expect(html.match(/class="demo-mistake"/g)).toHaveLength(2);
    expect(html).toContain("ça");
    expect(html).toContain(demo.label);
  });
});
