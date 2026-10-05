use keyring::Entry;
use serde::Deserialize;
use serde_json::Value;
use std::collections::HashMap;
use std::sync::Mutex;
use std::time::Duration;
use tauri::{State, WebviewWindow};

const SERVICE: &str = "com.florianlauer.prosed.byok";

#[derive(Default)]
pub struct Requests(Mutex<HashMap<String, tokio::task::AbortHandle>>);

#[derive(Clone, Deserialize)]
pub struct CloudRequest {
    provider: String,
    url: String,
    body: Value,
}

fn entry(provider: &str) -> Result<Entry, String> {
    if ![
        "openai",
        "anthropic",
        "openrouter",
        "gemini-api",
        "mistral",
        "groq",
        "deepseek",
        "custom",
    ]
    .contains(&provider)
    {
        return Err("Unknown API provider.".into());
    }
    Entry::new(SERVICE, provider).map_err(|_| "Couldn't open the system keychain.".into())
}

fn settings_only(window: &WebviewWindow) -> Result<(), String> {
    if window.label() != "settings" {
        return Err("Open settings to manage API keys.".into());
    }
    Ok(())
}

fn valid_key(key: &str) -> Result<&str, String> {
    let key = key.trim();
    if key.is_empty() || key.contains(['\r', '\n']) {
        return Err("Enter a valid API key.".into());
    }
    Ok(key)
}

fn read_key(provider: &str) -> Result<String, String> {
    entry(provider)?
        .get_password()
        .map_err(|error| match error {
            keyring::Error::NoEntry => "Add an API key for this provider in settings.".into(),
            _ => "Couldn't read the API key from the system keychain.".into(),
        })
}

#[tauri::command(async)]
pub fn cloud_key_status(window: WebviewWindow, provider: String) -> Result<bool, String> {
    settings_only(&window)?;
    match entry(&provider)?.get_password() {
        Ok(key) => Ok(!key.is_empty()),
        Err(keyring::Error::NoEntry) => Ok(false),
        Err(_) => Err("Couldn't read the system keychain.".into()),
    }
}

#[tauri::command(async)]
pub fn cloud_key_save(
    window: WebviewWindow,
    provider: String,
    api_key: String,
) -> Result<(), String> {
    settings_only(&window)?;
    entry(&provider)?
        .set_password(valid_key(&api_key)?)
        .map_err(|_| "Couldn't save the API key in the system keychain.".into())
}

#[tauri::command(async)]
pub fn cloud_key_remove(window: WebviewWindow, provider: String) -> Result<(), String> {
    settings_only(&window)?;
    match entry(&provider)?.delete_credential() {
        Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
        Err(_) => Err("Couldn't remove the API key from the system keychain.".into()),
    }
}

fn validate_url(request: &CloudRequest) -> Result<reqwest::Url, String> {
    let url =
        reqwest::Url::parse(&request.url).map_err(|_| "Enter a valid API URL.".to_string())?;
    let loopback = matches!(url.host_str(), Some("localhost" | "127.0.0.1" | "[::1]"));
    if (url.scheme() != "https" && !(url.scheme() == "http" && loopback))
        || !url.username().is_empty()
        || url.password().is_some()
        || url.query().is_some()
        || url.fragment().is_some()
    {
        return Err(
            "Use HTTPS, or HTTP on localhost, without credentials, a query or a fragment.".into(),
        );
    }
    let expected = match request.provider.as_str() {
        "openai" => "https://api.openai.com/v1/chat/completions",
        "anthropic" => "https://api.anthropic.com/v1/messages",
        "openrouter" => "https://openrouter.ai/api/v1/chat/completions",
        "mistral" => "https://api.mistral.ai/v1/chat/completions",
        "groq" => "https://api.groq.com/openai/v1/chat/completions",
        "deepseek" => "https://api.deepseek.com/v1/chat/completions",
        "gemini-api"
            if request
                .url
                .starts_with("https://generativelanguage.googleapis.com/v1beta/models/")
                && request.url.ends_with(":generateContent") =>
        {
            return Ok(url)
        }
        "custom" => return Ok(url),
        _ => return Err("Unknown API provider or endpoint.".into()),
    };
    if request.url != expected {
        return Err("The API URL doesn't match this provider.".into());
    }
    Ok(url)
}

async fn post(request: CloudRequest, api_key: String) -> Result<Value, String> {
    let url = validate_url(&request)?;
    let key = valid_key(&api_key)?;
    // Redirects must not forward a credential to a different endpoint.
    let client = reqwest::Client::builder()
        .redirect(reqwest::redirect::Policy::none())
        .timeout(Duration::from_secs(60))
        .build()
        .map_err(|_| "Couldn't initialize the API connection.".to_string())?;
    let mut call = client.post(url).json(&request.body);
    call = match request.provider.as_str() {
        "anthropic" => call
            .header("x-api-key", key)
            .header("anthropic-version", "2023-06-01"),
        "gemini-api" => call.header("x-goog-api-key", key),
        _ => call.bearer_auth(key),
    };
    let response = call.send().await.map_err(|error| {
        if error.is_timeout() {
            "The API request timed out. Try again.".to_string()
        } else {
            "Couldn't reach the API. Check your connection and API URL.".to_string()
        }
    })?;
    let status = response.status();
    if !status.is_success() {
        // Provider errors can echo credentials, so return only the status and an action.
        return Err(match status.as_u16() {
            401 | 403 => {
                format!("API authentication failed ({status}). Check the key and its permissions.")
            }
            429 => {
                "API request limit or credit balance reached (429). Check your provider account."
                    .into()
            }
            _ => format!(
                "The API request failed ({status}). Check the model ID and provider availability."
            ),
        });
    }
    response
        .json()
        .await
        .map_err(|_| "The API returned invalid JSON.".into())
}

#[tauri::command]
pub async fn cloud_send(
    window: WebviewWindow,
    requests: State<'_, Requests>,
    channel: String,
    request: CloudRequest,
    api_key: Option<String>,
) -> Result<Value, String> {
    validate_url(&request)?;
    let key = match api_key {
        Some(key) => {
            settings_only(&window)?;
            key
        }
        None => read_key(&request.provider)?,
    };
    let task = tokio::spawn(post(request, key));
    let channel = format!("{}:{channel}", window.label());
    if let Some(previous) = requests
        .0
        .lock()
        .unwrap()
        .insert(channel, task.abort_handle())
    {
        previous.abort();
    }
    task.await
        .map_err(|_| "The check was cancelled.".to_string())?
}

#[cfg(test)]
mod tests {
    use super::*;

    fn request(provider: &str, url: &str) -> CloudRequest {
        CloudRequest {
            provider: provider.into(),
            url: url.into(),
            body: serde_json::json!({}),
        }
    }

    #[test]
    fn rejects_credentials_and_provider_endpoint_mismatches() {
        for url in [
            "http://example.com/v1",
            "https://user:secret@example.com/v1",
            "https://example.com/v1?key=secret",
            "https://example.com/v1#secret",
        ] {
            assert!(validate_url(&request("custom", url)).is_err());
        }
        assert!(validate_url(&request(
            "openai",
            "https://example.com/v1/chat/completions"
        ))
        .is_err());
        assert!(validate_url(&request(
            "custom",
            "http://127.0.0.1:8000/v1/chat/completions"
        ))
        .is_ok());
        assert!(validate_url(&request(
            "openai",
            "https://api.openai.com/v1/chat/completions"
        ))
        .is_ok());
        assert!(validate_url(&request("gemini-api", "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent")).is_ok());
    }

    #[test]
    fn rejects_empty_keys_and_header_injection() {
        assert!(valid_key(" ").is_err());
        assert!(valid_key("key\r\nAuthorization: stolen").is_err());
        assert_eq!(valid_key(" key ").unwrap(), "key");
    }

    #[test]
    fn sends_keys_in_headers_and_sanitizes_http_errors() {
        use std::io::{Read, Write};
        use std::net::TcpListener;

        for status in [200, 401, 429, 302] {
            let listener = TcpListener::bind("127.0.0.1:0").unwrap();
            let address = listener.local_addr().unwrap();
            let server = std::thread::spawn(move || {
                let (mut stream, _) = listener.accept().unwrap();
                stream
                    .set_read_timeout(Some(Duration::from_secs(10)))
                    .unwrap();
                let mut bytes = vec![];
                let mut buffer = [0; 1024];
                loop {
                    let read = stream.read(&mut buffer).unwrap();
                    bytes.extend_from_slice(&buffer[..read]);
                    if bytes.windows(4).any(|part| part == b"\r\n\r\n") {
                        break;
                    }
                }
                let headers = String::from_utf8_lossy(&bytes).to_lowercase();
                assert!(headers.contains("authorization: bearer test-key\r\n"));
                let body = if status == 200 {
                    r#"{"choices":[{"message":{"content":"{}"}}]}"#
                } else {
                    r#"{"error":{"message":"test-key"}}"#
                };
                let response = format!("HTTP/1.1 {status} Response\r\nContent-Type: application/json\r\nContent-Length: {}\r\nLocation: http://127.0.0.1:1/stolen\r\nConnection: close\r\n\r\n{body}", body.len());
                stream.write_all(response.as_bytes()).unwrap();
            });
            let request = request("custom", &format!("http://{address}/v1/chat/completions"));
            let runtime = tokio::runtime::Builder::new_current_thread()
                .enable_all()
                .build()
                .unwrap();
            let result = runtime.block_on(post(request, "test-key".into()));
            server.join().unwrap();
            if status == 200 {
                assert!(result.unwrap()["choices"].is_array());
            } else {
                let error = result.unwrap_err();
                assert!(error.contains(&status.to_string()));
                assert!(!error.contains("test-key"));
            }
        }
    }
}
