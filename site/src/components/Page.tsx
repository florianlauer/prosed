import type { Content } from "../content";
import { DOWNLOADS, REPO, TARGETS, type Target } from "../download";
import { LANGUAGE_NAMES, LOCALES, type Locale, localePath } from "../i18n/locales";
import { Demo } from "./Demo";
import { DownloadButton, TARGET_ICON, useTarget } from "./Download";
import { Icon, type IconName } from "./Icon";
import { ThemeToggle } from "./ThemeToggle";
import { FixVignette, MemoryVignette, RewriteVignette } from "./Vignettes";

const UPSTREAM = "https://github.com/nucleartux/ai-grammar";

const DETAIL: Record<Target, string> = {
  macos: "Apple silicon",
  windows: "x64",
  extension: "Chrome, Arc, Brave, Edge",
};

type Mark = { icon: IconName; name: string };
const MACOS: Mark = { icon: "apple", name: "macOS" };
const WINDOWS: Mark = { icon: "windows", name: "Windows" };
const BROWSERS: Mark[] = [
  { icon: "chrome", name: "Chrome" },
  { icon: "arc", name: "Arc" },
  { icon: "brave", name: "Brave" },
  { icon: "edge", name: "Edge" },
  { icon: "vivaldi", name: "Vivaldi" },
  { icon: "opera", name: "Opera" },
];
const UNSUPPORTED: Mark[] = [
  { icon: "firefox", name: "Firefox" },
  { icon: "safari", name: "Safari" },
];
const LOCAL_MODELS: Mark[] = [
  { icon: "ollama", name: "Ollama" },
  { icon: "gemini", name: "Gemini Nano" },
];
const PROVIDERS: Mark[] = [
  { icon: "openai", name: "OpenAI" },
  { icon: "anthropic", name: "Anthropic" },
  { icon: "mistral", name: "Mistral" },
  { icon: "openrouter", name: "OpenRouter" },
  { icon: "groq", name: "Groq" },
  { icon: "deepseek", name: "DeepSeek" },
];

// From README.md, "Benchmark": gemma4:e2b-it-qat on an M2 Pro with Ollama 0.34.4.
// The median is 0.40 s on short sentences and 0.58 s on fast-typed messages.
const RESULTS = [
  ["basic", "14/14"],
  ["handwritten", "10/10"],
  ["rewrites", "30/30"],
] as const;
const LATENCY = [0.4, 0.6];

function Marks({ marks, labelled = false }: { marks: Mark[]; labelled?: boolean }) {
  return (
    <ul className={labelled ? "marks marks-labelled" : "marks"}>
      {marks.map(({ icon, name }) => (
        <li key={name} title={labelled ? undefined : name}>
          <Icon name={icon} />
          <span className={labelled ? undefined : "sr-only"}>{name}</span>
        </li>
      ))}
    </ul>
  );
}

export function Page({ locale, content }: { locale: Locale; content: Content }) {
  const [creditBefore, creditAfter] = content.footer.credit.split("{upstream}");
  const target = useTarget();
  const targetName: Record<Target, string> = {
    macos: "macOS",
    windows: "Windows",
    extension: content.machine.extension.title,
  };
  return (
    <>
      <header className="site-header">
        <a className="wordmark" href={localePath(locale)}>
          <img src="/brand/prosed.svg" alt="" width="28" height="28" />
          prosed
        </a>
        <nav aria-label={content.header.language}>
          <ul className="languages">
            {LOCALES.map((other) => (
              <li key={other}>
                <a
                  href={localePath(other)}
                  hrefLang={other}
                  lang={other}
                  aria-current={other === locale ? "page" : undefined}
                >
                  <span className="lang-name">{LANGUAGE_NAMES[other]}</span>
                  <span className="lang-code" aria-hidden="true">
                    {other.toUpperCase()}
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <div className="header-actions">
          <ThemeToggle label={content.header.theme} />
          <a className="github" href={REPO}>
            <Icon name="github" size={18} />
            <span className="github-label">{content.header.github}</span>
          </a>
        </div>
      </header>

      <main>
        <section className="hero">
          <h1 lang="en">sed for your prose.</h1>
          <p className="tagline">{content.hero.tagline}</p>
          <div className="ctas">
            <DownloadButton target={target} label={content.hero.download[target]} />
            <a className="button button-ghost" href={REPO}>
              <Icon name="github" size={18} />
              {content.hero.repo}
            </a>
          </div>
          {/* Pieces never break inside; the dot separators come from CSS. */}
          <p className="cta-detail pieces">
            <span>{DETAIL[target]}</span>
            <span>{content.footer.license}</span>
          </p>
          <p className="other-downloads pieces">
            <span>{content.hero.other}</span>
            {TARGETS.filter((other) => other !== target).map((other) => (
              <a key={other} href={DOWNLOADS[other]}>
                <Icon name={TARGET_ICON[other]} size={14} />
                {targetName[other]}
              </a>
            ))}
          </p>
        </section>

        <div className="hero-demo">
          <Demo demo={content.demo} />
        </div>

        <section className="runs" aria-labelledby="runs-title">
          <h2 id="runs-title" className="runs-title">
            {content.hero.runs}
          </h2>
          <Marks marks={[MACOS, WINDOWS, ...BROWSERS]} labelled />
        </section>

        <section className="block" aria-labelledby="features-title">
          <h2 id="features-title">{content.features.title}</h2>
          <div className="features">
            <article className="feature">
              <FixVignette fix={content.vignettes.fix} />
              <h3>{content.features.fix.title}</h3>
              <p>{content.features.fix.body}</p>
            </article>
            <article className="feature">
              <RewriteVignette rewrite={content.vignettes.rewrite} />
              <h3>{content.features.rewrite.title}</h3>
              <p>{content.features.rewrite.body}</p>
            </article>
            <article className="feature">
              <MemoryVignette memory={content.vignettes.memory} />
              <h3>{content.features.memory.title}</h3>
              <p>{content.features.memory.body}</p>
            </article>
          </div>
        </section>

        <section className="block" aria-labelledby="machine-title">
          <h2 id="machine-title">{content.machine.title}</h2>
          <div className="machine">
            <div className="panel">
              <h3>{content.machine.where}</h3>
              <ul className="hosts">
                <li>
                  <div>
                    <p className="host-title">{content.machine.extension.title}</p>
                    <p>{content.machine.extension.body}</p>
                  </div>
                  <Marks marks={BROWSERS} />
                </li>
                <li>
                  <div>
                    <p className="host-title">{content.machine.desktop.title}</p>
                    <p>{content.machine.desktop.body}</p>
                  </div>
                  <Marks marks={[MACOS, WINDOWS]} />
                </li>
                <li className="host-unsupported">
                  <p>{content.machine.unsupported}</p>
                  <Marks marks={UNSUPPORTED} />
                </li>
              </ul>
            </div>
            <div className="panel">
              <h3>{content.machine.models}</h3>
              <p>{content.machine.body}</p>
              <Marks marks={LOCAL_MODELS} labelled />
              <p>{content.machine.byok}</p>
              <Marks marks={PROVIDERS} labelled />
              <p>
                <a href={`${REPO}/blob/main/PRIVACY.md`}>{content.machine.privacy}</a>
              </p>
            </div>
          </div>
        </section>

        <section className="block" aria-labelledby="benchmark-title">
          <h2 id="benchmark-title">{content.benchmark.title}</h2>
          <p className="block-intro">
            {content.benchmark.body} <a href={`${REPO}#benchmark`}>{content.benchmark.method}</a>
          </p>
          <dl className="results">
            {RESULTS.map(([row, value]) => (
              <div key={row}>
                <dt>{content.benchmark[row]}</dt>
                <dd>{value}</dd>
              </div>
            ))}
            <div>
              <dt>{content.benchmark.latency}</dt>
              {/* Decimal comma outside English. */}
              <dd>{`${LATENCY.map((n) => n.toLocaleString(locale)).join("–")}\u00a0s`}</dd>
            </div>
          </dl>
        </section>

        <section className="closing" aria-labelledby="closing-title">
          <h2 id="closing-title">{content.close}</h2>
          <DownloadButton target={target} label={content.hero.download[target]} />
        </section>
      </main>

      <footer className="site-footer">
        <p>
          {creditBefore}
          <a href={UPSTREAM}>nucleartux/ai-grammar</a>
          {creditAfter}
        </p>
        <ul className="footer-links">
          <li>
            <a href={`${REPO}/blob/main/LICENSE`}>{content.footer.license}</a>
          </li>
          <li>
            <a href={`${REPO}#readme`}>{content.footer.readme}</a>
          </li>
          <li>
            <a href={`${REPO}/blob/main/CHANGELOG.md`}>{content.footer.changelog}</a>
          </li>
        </ul>
      </footer>
    </>
  );
}
