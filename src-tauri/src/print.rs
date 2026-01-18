// =====================================================
// Silent Print Module for Dot Matrix Printers
// Optimized for TVS MSP 250 - Minimal Paper Usage
// =====================================================

use std::process::Command;
use tauri::command;

/// Print plain text silently to the default printer.
/// Optimized for dot matrix printers like TVS MSP 250.
#[command]
pub async fn silent_print(html_content: String) -> Result<String, String> {
    #[cfg(windows)]
    {
        // Get default printer name first
        let printer_output = Command::new("powershell")
            .args([
                "-NoProfile",
                "-NonInteractive",
                "-Command",
                "(Get-CimInstance -Class Win32_Printer | Where-Object {$_.Default -eq $true}).Name",
            ])
            .output();

        let printer_name = match printer_output {
            Ok(result) => {
                let name = String::from_utf8_lossy(&result.stdout).trim().to_string();
                log::info!("Default printer: {}", name);
                name
            }
            Err(_) => String::new(),
        };

        if printer_name.is_empty() {
            return Err("No default printer. Set TVS MSP 250 as default.".to_string());
        }

        // Extract just the receipt text from HTML (between <pre> tags if present)
        let receipt_text = extract_receipt_text(&html_content);

        log::info!("Printing {} chars to {}", receipt_text.len(), printer_name);

        // Use Out-Printer cmdlet
        let escaped_text = receipt_text.replace("'", "''").replace("`", "``");

        let ps_script = format!(
            r#"
$content = @'
{}
'@
$content | Out-Printer
"#,
            escaped_text
        );

        let output = Command::new("powershell")
            .args([
                "-NoProfile",
                "-NonInteractive",
                "-WindowStyle",
                "Hidden",
                "-ExecutionPolicy",
                "Bypass",
                "-Command",
                &ps_script,
            ])
            .output();

        match output {
            Ok(result) => {
                let stderr = String::from_utf8_lossy(&result.stderr);
                if stderr.trim().is_empty() || !stderr.to_lowercase().contains("error") {
                    Ok(format!("Printed to {}", printer_name))
                } else {
                    log::warn!("Print stderr: {}", stderr.trim());
                    Err(stderr.trim().to_string())
                }
            }
            Err(e) => Err(format!("Print failed: {}", e)),
        }
    }

    #[cfg(not(windows))]
    {
        let _ = html_content;
        Err("Only supported on Windows".to_string())
    }
}

/// Extract receipt text from HTML - looks for <pre> content or strips to plain text
fn extract_receipt_text(html: &str) -> String {
    // Method 1: Look for content between <pre> tags (dot matrix template uses this)
    if let Some(start) = html.find("<pre") {
        if let Some(tag_end) = html[start..].find('>') {
            let content_start = start + tag_end + 1;
            if let Some(end) = html[content_start..].find("</pre>") {
                let pre_content = &html[content_start..content_start + end];
                return decode_entities(pre_content.trim());
            }
        }
    }

    // Method 2: Look for <body> content
    let body_content = if let Some(start) = html.find("<body") {
        if let Some(tag_end) = html[start..].find('>') {
            let content_start = start + tag_end + 1;
            if let Some(end) = html[content_start..].find("</body>") {
                &html[content_start..content_start + end]
            } else {
                html
            }
        } else {
            html
        }
    } else {
        html
    };

    // Convert HTML to plain text
    html_to_text(body_content)
}

/// Convert HTML to plain text with minimal formatting
fn html_to_text(html: &str) -> String {
    let mut text = html.to_string();

    // Remove script/style blocks using simple string matching
    text = remove_block(&text, "<script", "</script>");
    text = remove_block(&text, "<style", "</style>");
    text = remove_block(&text, "<!--", "-->");

    // Replace block elements with newlines
    text = text.replace("</tr>", "\n");
    text = text.replace("</p>", "\n");
    text = text.replace("</div>", "\n");
    text = text.replace("</h1>", "\n");
    text = text.replace("</h2>", "\n");
    text = text.replace("</h3>", "\n");
    text = text.replace("<br>", "\n");
    text = text.replace("<br/>", "\n");
    text = text.replace("<br />", "\n");
    text = text.replace("<hr>", "\n---\n");
    text = text.replace("<hr/>", "\n---\n");

    // Table cells with spacing
    text = text.replace("</td>", "  ");
    text = text.replace("</th>", "  ");

    // Remove all HTML tags
    let mut result = String::new();
    let mut in_tag = false;
    for c in text.chars() {
        if c == '<' {
            in_tag = true;
        } else if c == '>' {
            in_tag = false;
        } else if !in_tag {
            result.push(c);
        }
    }

    // Decode entities and clean up
    result = decode_entities(&result);

    // Remove excessive whitespace
    let mut lines: Vec<&str> = result
        .lines()
        .map(|l| l.trim())
        .filter(|l| !l.is_empty())
        .filter(|l| !l.starts_with('@')) // Remove CSS
        .filter(|l| !l.contains('{')) // Remove CSS
        .filter(|l| !l.contains('}')) // Remove CSS
        .collect();

    // Limit consecutive empty-ish lines
    lines.dedup();

    lines.join("\n") + "\n\n"
}

/// Remove a block of content between start and end markers
fn remove_block(text: &str, start_marker: &str, end_marker: &str) -> String {
    let mut result = text.to_string();
    while let Some(start) = result.to_lowercase().find(&start_marker.to_lowercase()) {
        if let Some(rel_end) = result[start..]
            .to_lowercase()
            .find(&end_marker.to_lowercase())
        {
            let end = start + rel_end + end_marker.len();
            result = result[..start].to_string() + &result[end..];
        } else {
            break;
        }
    }
    result
}

/// Decode HTML entities
fn decode_entities(text: &str) -> String {
    text.replace("&nbsp;", " ")
        .replace("&amp;", "&")
        .replace("&lt;", "<")
        .replace("&gt;", ">")
        .replace("&quot;", "\"")
        .replace("&#39;", "'")
        .replace("&#8377;", "Rs.")
        .replace("₹", "Rs.")
        .replace("&times;", "x")
        .replace("×", "x")
        .replace("  ", " ")
}

/// Check if a default printer is configured
#[command]
pub fn check_printer_available() -> Result<bool, String> {
    #[cfg(windows)]
    {
        let output = Command::new("powershell")
            .args([
                "-NoProfile",
                "-NonInteractive",
                "-Command",
                "(Get-CimInstance -Class Win32_Printer | Where-Object {$_.Default -eq $true}).Name",
            ])
            .output();

        match output {
            Ok(result) => {
                let stdout = String::from_utf8_lossy(&result.stdout);
                Ok(!stdout.trim().is_empty())
            }
            Err(_) => Ok(false),
        }
    }

    #[cfg(not(windows))]
    {
        Ok(false)
    }
}

/// Get the name of the default printer
#[command]
pub fn get_default_printer() -> Result<String, String> {
    #[cfg(windows)]
    {
        let output = Command::new("powershell")
            .args([
                "-NoProfile",
                "-NonInteractive",
                "-Command",
                "(Get-CimInstance -Class Win32_Printer | Where-Object {$_.Default -eq $true}).Name",
            ])
            .output();

        match output {
            Ok(result) => {
                let name = String::from_utf8_lossy(&result.stdout).trim().to_string();
                if name.is_empty() {
                    Err("No default printer".to_string())
                } else {
                    Ok(name)
                }
            }
            Err(e) => Err(format!("Failed: {}", e)),
        }
    }

    #[cfg(not(windows))]
    {
        Err("Windows only".to_string())
    }
}

/// List all available printers
#[command]
pub fn list_printers() -> Result<Vec<String>, String> {
    #[cfg(windows)]
    {
        let output = Command::new("powershell")
            .args([
                "-NoProfile",
                "-NonInteractive",
                "-Command",
                "Get-CimInstance -Class Win32_Printer | Select-Object -ExpandProperty Name",
            ])
            .output();

        match output {
            Ok(result) => {
                let stdout = String::from_utf8_lossy(&result.stdout);
                let printers: Vec<String> = stdout
                    .lines()
                    .map(|s| s.trim().to_string())
                    .filter(|s| !s.is_empty())
                    .collect();
                Ok(printers)
            }
            Err(e) => Err(format!("Failed: {}", e)),
        }
    }

    #[cfg(not(windows))]
    {
        Err("Windows only".to_string())
    }
}

/// Print raw text directly to printer
#[command]
pub async fn print_raw_text(text: String, _printer_name: Option<String>) -> Result<String, String> {
    #[cfg(windows)]
    {
        let escaped = text.replace("'", "''").replace("`", "``");

        let ps = format!(
            r#"@'
{}
'@ | Out-Printer"#,
            escaped
        );

        let output = Command::new("powershell")
            .args([
                "-NoProfile",
                "-NonInteractive",
                "-WindowStyle",
                "Hidden",
                "-Command",
                &ps,
            ])
            .output();

        match output {
            Ok(r) => {
                let err = String::from_utf8_lossy(&r.stderr);
                if err.trim().is_empty() {
                    Ok("Sent".to_string())
                } else {
                    Err(err.trim().to_string())
                }
            }
            Err(e) => Err(format!("{}", e)),
        }
    }

    #[cfg(not(windows))]
    {
        let _ = text;
        Err("Windows only".to_string())
    }
}
