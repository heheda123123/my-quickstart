use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UwpAppInfo {
    pub name: String,
    #[serde(rename = "appId")]
    pub app_id: String,
}

#[cfg(target_os = "windows")]
fn powershell_json(script: &str) -> Result<String, String> {
    let candidates = ["powershell", "pwsh"];
    let mut last_err: Option<String> = None;
    for bin in candidates {
        let output = std::process::Command::new(bin)
            .args(["-NoProfile", "-NonInteractive", "-Command", script])
            .output();
        match output {
            Ok(out) => {
                if out.status.success() {
                    return String::from_utf8(out.stdout).map_err(|e| e.to_string());
                }
                last_err = Some(String::from_utf8_lossy(&out.stderr).trim().to_string());
            }
            Err(e) => last_err = Some(e.to_string()),
        }
    }
    Err(last_err.unwrap_or_else(|| "failed to run powershell".to_string()))
}

#[tauri::command]
pub fn list_uwp_apps() -> Result<Vec<UwpAppInfo>, String> {
    #[cfg(not(target_os = "windows"))]
    {
        Ok(Vec::new())
    }

    #[cfg(target_os = "windows")]
    {
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

