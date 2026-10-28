import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vite-plus/test";
import { contentFor } from "../content";
import { Homebrew } from "./Homebrew";

it("renders all three unchanged commands without a disclosure control", () => {
  const html = renderToStaticMarkup(<Homebrew labels={contentFor("fr").hero.homebrew} />);
  const commands = html.match(/<code[^>]*>([\s\S]*?)<\/code>/)?.[1].replace(/<[^>]*>/g, "");
  expect(commands).toBe(
    "brew tap florianlauer/prosed https://github.com/florianlauer/prosed\n" +
      "brew trust --cask florianlauer/prosed/prosed\n" +
      "brew install --cask florianlauer/prosed/prosed",
  );
  expect(html).not.toMatch(/<details\b|\shidden(?:=|>|\s)|aria-expanded=/);
});
