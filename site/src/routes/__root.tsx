/// <reference types="vite/client" />
import { HeadContent, Outlet, Scripts, createRootRoute, useParams } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { localeFromParam, sitePath } from "../i18n/locales";
import { THEME_SCRIPT } from "../components/ThemeToggle";
import css from "../styles.css?url";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { name: "color-scheme", content: "dark light" },
    ],
    links: [
      { rel: "stylesheet", href: css },
      { rel: "icon", href: sitePath("/brand/prosed.svg"), type: "image/svg+xml" },
      {
        rel: "preload",
        href: sitePath("/fonts/ibm-plex-mono-latin-400-normal.woff2"),
        as: "font",
        type: "font/woff2",
        crossOrigin: "anonymous",
      },
      // The h1 is the largest paint, in mono 700.
      {
        rel: "preload",
        href: sitePath("/fonts/ibm-plex-mono-latin-700-normal.woff2"),
        as: "font",
        type: "font/woff2",
        crossOrigin: "anonymous",
      },
      {
        rel: "preload",
        href: sitePath("/fonts/ibm-plex-sans-latin-400-normal.woff2"),
        as: "font",
        type: "font/woff2",
        crossOrigin: "anonymous",
      },
    ],
  }),
  shellComponent: RootDocument,
  component: Outlet,
  // Static hosting serves public/404.html in production.
  notFoundComponent: () => (
    <p>
      Page not found. <a href={sitePath("/")}>prosed</a>
    </p>
  ),
});

function RootDocument({ children }: { children: ReactNode }) {
  const { locale } = useParams({ strict: false });
  return (
    // The theme script sets data-theme before React hydrates.
    <html lang={localeFromParam(locale) ?? "en"} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
        {/* Pages has no proxy rewrites; Vercel keeps the first-party analytics URL. */}
        <script
          defer
          src={import.meta.env.BASE_URL === "/" ? "/u/p.js" : "https://stats.flauercase.dev/p.js"}
          data-website-id="330f6892-6b67-4f3b-8d53-f91290913756"
          data-domains="prosed.flauercase.dev,florianlauer.github.io"
        />
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}
