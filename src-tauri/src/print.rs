// =====================================================
// Silent Print Module for Dot Matrix Printers
// Optimized for TVS MSP 250 and similar dot matrix printers
// =====================================================

use std::process::Command;
use tauri::command;

/// Print plain text silently to the default printer.
/// This is the most reliable method for dot matrix printers like TVS MSP 250.
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
            return Err(
                "No default printer configured. Please set TVS MSP 250 as default printer."
                    .to_string(),
            );
        }

        // Convert HTML to plain text for dot matrix printing
        let plain_text = html_to_plain_text(&html_content);

        log::info!(
            "Printing {} characters to {}",
            plain_text.len(),
            printer_name
        );

        // Use Out-Printer cmdlet - most reliable for dot matrix
        let escaped_text = plain_text.replace("'", "''").replace("`", "``");

        let ps_script = format!(
            r#"
$ErrorActionPreference = 'Stop'
$content = @'
{}
'@

try {{
    $content | Out-Printer
    Write-Output "SUCCESS"
}} catch {{
    Write-Output "ERROR:$($_.Exception.Message)"
}}
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
                let stdout = String::from_utf8_lossy(&result.stdout);
                let stderr = String::from_utf8_lossy(&result.stderr);
                let output_str = stdout.trim();

                log::info!("Print stdout: {}", output_str);
                if !stderr.is_empty() {
                    log::warn!("Print stderr: {}", stderr.trim());
                }

                if output_str.contains("SUCCESS") {
                    Ok(format!("Print job sent to {}", printer_name))
                } else if output_str.contains("ERROR:") {
                    let error_msg = output_str.replace("ERROR:", "");
                    Err(error_msg.trim().to_string())
                } else {
                    Ok(format!("Print initiated to {}", printer_name))
                }
            }
            Err(e) => Err(format!("Failed to execute print command: {}", e)),
        }
    }

    #[cfg(not(windows))]
    {
        let _ = html_content;
        Err("Silent printing is only supported on Windows".to_string())
    }
}

/// Convert HTML to plain text suitable for dot matrix printing
fn html_to_plain_text(html: &str) -> String {
    let mut text = html.to_string();

    // Remove script and style tags with content
    let script_re = regex_lite::Regex::new(r"(?is)<script[^>]*>.*?</script>").unwrap();
    text = script_re.replace_all(&text, "").to_string();

    let style_re = regex_lite::Regex::new(r"(?is)<style[^>]*>.*?</style>").unwrap();
    text = style_re.replace_all(&text, "").to_string();

    // Replace common HTML elements
    text = text.replace("<br>", "\n");
    text = text.replace("<br/>", "\n");
    text = text.replace("<br />", "\n");
    text = text.replace("</p>", "\n");
    text = text.replace("</div>", "\n");
    text = text.replace("</tr>", "\n");
    text = text.replace("</h1>", "\n\n");
    text = text.replace("</h2>", "\n\n");
    text = text.replace("</h3>", "\n");
    text = text.replace("<hr>", "\n----------------------------------------\n");
    text = text.replace("<hr/>", "\n----------------------------------------\n");
    text = text.replace("</td>", "  ");
    text = text.replace("</th>", "  ");

    // Remove all remaining HTML tags
    let tag_re = regex_lite::Regex::new(r"<[^>]+>").unwrap();
    text = tag_re.replace_all(&text, "").to_string();

    // Decode common HTML entities
    text = text.replace("&nbsp;", " ");
    text = text.replace("&amp;", "&");
    text = text.replace("&lt;", "<");
    text = text.replace("&gt;", ">");
    text = text.replace("&quot;", "\"");
    text = text.replace("&#39;", "'");
    text = text.replace("&#8377;", "Rs."); // Rupee symbol
    text = text.replace("₹", "Rs.");

    // Clean up whitespace
    let multi_newline = regex_lite::Regex::new(r"\n{3,}").unwrap();
    text = multi_newline.replace_all(&text, "\n\n").to_string();

    let multi_space = regex_lite::Regex::new(r"[ \t]{2,}").unwrap();
    text = multi_space.replace_all(&text, "  ").to_string();

    // Trim each line
    text = text
        .lines()
        .map(|line| line.trim())
        .collect::<Vec<&str>>()
        .join("\n");

    // Add form feed at end for dot matrix printers
    text.push_str("\n\n\n");

    text.trim().to_string()
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
                let printer_name = stdout.trim();
                log::info!("Default printer: {}", printer_name);
                Ok(!printer_name.is_empty())
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
                let stdout = String::from_utf8_lossy(&result.stdout);
                let printer_name = stdout.trim().to_string();
                if printer_name.is_empty() {
                    Err("No default printer configured".to_string())
                } else {
                    Ok(printer_name)
                }
            }
            Err(e) => Err(format!("Failed to get printer: {}", e)),
        }
    }

    #[cfg(not(windows))]
    {
        Err("Only supported on Windows".to_string())
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
            Err(e) => Err(format!("Failed to list printers: {}", e)),
        }
    }

    #[cfg(not(windows))]
    {
        Err("Only supported on Windows".to_string())
    }
}

/// Print raw text directly to printer
#[command]
pub async fn print_raw_text(text: String, _printer_name: Option<String>) -> Result<String, String> {
    #[cfg(windows)]
    {
        let escaped_text = text.replace("'", "''").replace("`", "``");

        let ps_script = format!(
            r#"
$content = @'
{}
'@
$content | Out-Printer
Write-Output "SUCCESS"
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
                let stdout = String::from_utf8_lossy(&result.stdout);
                if stdout.contains("SUCCESS") {
                    Ok("Print job sent".to_string())
                } else {
                    let stderr = String::from_utf8_lossy(&result.stderr);
                    Err(format!("Print failed: {}", stderr))
                }
            }
            Err(e) => Err(format!("Failed to execute: {}", e)),
        }
    }

    #[cfg(not(windows))]
    {
        let _ = text;
        Err("Only supported on Windows".to_string())
    }
}
