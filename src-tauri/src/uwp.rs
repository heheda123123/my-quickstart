use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UwpAppInfo {
    pub name: String,
    #[serde(rename = "appId")]
    pub app_id: String,
}

#[cfg(target_os = "windows")]
fn powershell_json(script: &str) -> Result<String, String> {
    use std::os::windows::process::CommandExt;
    let prefix = concat!(
        "$ErrorActionPreference='Stop';",
        "[Console]::OutputEncoding = New-Object System.Text.UTF8Encoding $false;",
        "$OutputEncoding = [Console]::OutputEncoding;",
        ""
    );
    let wrapped = format!("{} {}", prefix, script);

    let candidates = ["pwsh", "powershell"];
    let mut last_err: Option<String> = None;
    for bin in candidates {
        let output = std::process::Command::new(bin)
            .args([
                "-NoLogo",
                "-NoProfile",
                "-NonInteractive",
                "-WindowStyle",
                "Hidden",
                "-Command",
                &wrapped,
            ])
            .creation_flags(0x08000000) // CREATE_NO_WINDOW
            .output();
        match output {
            Ok(out) => {
                if out.status.success() {
                    return Ok(match String::from_utf8(out.stdout) {
                        Ok(s) => s,
                        Err(e) => String::from_utf8_lossy(&e.into_bytes()).to_string(),
                    });
                }
                last_err = Some(String::from_utf8_lossy(&out.stderr).trim().to_string());
            }
            Err(e) => last_err = Some(e.to_string()),
        }
    }
    Err(last_err.unwrap_or_else(|| "failed to run powershell".to_string()))
}

#[cfg(target_os = "windows")]
struct UwpCache {
    fetched_at: std::time::Instant,
    apps: Vec<UwpAppInfo>,
}

#[cfg(target_os = "windows")]
static UWP_CACHE: std::sync::OnceLock<std::sync::Mutex<UwpCache>> = std::sync::OnceLock::new();

#[tauri::command]
pub fn list_uwp_apps() -> Result<Vec<UwpAppInfo>, String> {
    #[cfg(not(target_os = "windows"))]
    {
        Ok(Vec::new())
    }

    #[cfg(target_os = "windows")]
    {
        let cache_ttl = std::time::Duration::from_secs(30);
        if let Some(lock) = UWP_CACHE.get() {
            if let Ok(cache) = lock.lock() {
                if cache.fetched_at.elapsed() <= cache_ttl && !cache.apps.is_empty() {
                    return Ok(cache.apps.clone());
                }
            }
        }

        let script = "Get-StartApps | Sort-Object Name | Select-Object Name, AppID | ConvertTo-Json -Compress";
        let raw = powershell_json(script)?;
        let raw = raw.trim();
        if raw.is_empty() || raw == "null" {
            return Ok(Vec::new());
        }
        let v: serde_json::Value = serde_json::from_str(raw).map_err(|e| e.to_string())?;
        let arr = match v {
            serde_json::Value::Array(a) => a,
            serde_json::Value::Object(_) => vec![v],
            _ => Vec::new(),
        };
        let mut result: Vec<UwpAppInfo> = Vec::new();
        for item in arr {
            let name = item
                .get("Name")
                .and_then(|x| x.as_str())
                .unwrap_or("")
                .trim()
                .to_string();
            let app_id = item
                .get("AppID")
                .or_else(|| item.get("AppId"))
                .and_then(|x| x.as_str())
                .unwrap_or("")
                .trim()
                .to_string();
            if name.is_empty() || app_id.is_empty() {
                continue;
            }
            result.push(UwpAppInfo { name, app_id });
        }

        let lock = UWP_CACHE.get_or_init(|| {
            std::sync::Mutex::new(UwpCache {
                fetched_at: std::time::Instant::now(),
                apps: Vec::new(),
            })
        });
        if let Ok(mut cache) = lock.lock() {
            cache.fetched_at = std::time::Instant::now();
            cache.apps = result.clone();
        }

        Ok(result)
    }
}

#[tauri::command]
pub fn spawn_uwp_app(app_id: String) -> Result<(), String> {
    let aumid = app_id.trim();
    if aumid.is_empty() {
        return Err("empty app id".to_string());
    }

    #[cfg(not(target_os = "windows"))]
    {
        Err("UWP is only supported on Windows".to_string())
    }

    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("explorer.exe")
            .arg(format!("shell:AppsFolder\\{}", aumid))
            .spawn()
            .map(|_| ())
            .map_err(|e| e.to_string())
    }
}
