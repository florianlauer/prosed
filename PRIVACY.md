# prosed privacy policy

prosed collects nothing. It has no account, no analytics and no server.

## Where your text goes

Local mode sends the text of the field you're in to the Ollama server on your own machine (`http://127.0.0.1:11434`), or to Chrome's on-device model.

If you select an API provider in settings, checks and rewrites send the text directly to that provider over HTTPS. An OpenAI-compatible endpoint on localhost can use HTTP. Prosed does not relay requests through a server of its own. "Test connection" sends a short sample to the chosen provider, using the key and model you entered.

## Where your settings live

- Extension: in the browser's extension storage. When browser sync is on, the browser syncs it to your account like bookmarks.
- Desktop app: in `config.json` in the app's config folder (`~/Library/Application Support/com.florianlauer.prosed/` on macOS, `%APPDATA%\com.florianlauer.prosed\` on Windows).

API keys are separate from preferences. The extension stores them in local browser extension storage, restricts access to trusted extension pages and never syncs them. This storage is not a password vault; someone with access to your browser profile can access it. The desktop stores keys in the operating system's keychain, not in `config.json`. Settings show whether a key is saved without reading it back into the key field. "Remove key" deletes the saved credential.

## Third parties

API mode uses the provider you select, such as OpenAI, Anthropic, OpenRouter, Gemini API, Mistral, Groq or DeepSeek. Your provider's privacy and retention policies apply to the text you send, and its API charges apply to your account. A custom endpoint follows the policies of whoever operates it. Prosed does not contact these services in local mode.

Fonts ship inside the extension and the app, so opening the settings doesn't contact a font service.

## Changes

If this policy changes, the new version ships with a release and the CHANGELOG says so.
