// =====================================================
// Silent Print Module
// Windows-only truly silent printing for dot matrix printers
// =====================================================

use std::io::Write;
use std::process::Command;
use tauri::command;

/// Print HTML content silently using Microsoft Edge or system browser in kiosk print mode.
/// This prints directly to the default printer without user dialogs.
#[command]
pub async fn silent_print(html_content: String) -> Result<String, String> {
    // Get temp directory and create file paths
    let temp_dir = std::env::temp_dir();
    let html_path = temp_dir.join("medbill_receipt.html");

    // Write HTML content to temp file
    let mut file = std::fs::File::create(&html_path)
        .map_err(|e| format!("Failed to create temp file: {}", e))?;

    file.write_all(html_content.as_bytes())
        .map_err(|e| format!("Failed to write HTML content: {}", e))?;

    file.flush()
        .map_err(|e| format!("Failed to flush file: {}", e))?;
    drop(file);

    #[cfg(windows)]
    {
        let html_path_str = html_path.to_string_lossy().to_string();
        let file_url = format!("file:///{}", html_path_str.replace("\\", "/"));

        log::info!("Silent printing file: {:?}", html_path);

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
            return Err("No default printer configured. Please set TVS MSP 250 as default printer in Windows Settings.".to_string());
        }

        // Check if it's a PDF printer (not useful for receipts)
        if printer_name.to_lowercase().contains("pdf")
            || printer_name.to_lowercase().contains("onenote")
        {
            return Err(format!(
                "Default printer is '{}'. Please set your TVS MSP 250 printer as the default printer in Windows Settings.",
                printer_name
            ));
        }

        // Method: Use Microsoft Edge in kiosk printing mode (no dialogs)
        // Edge supports --kiosk-printing which prints directly without dialog
        let edge_paths = [
            "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
            "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
        ];

        let mut edge_path: Option<&str> = None;
        for path in edge_paths.iter() {
            if std::path::Path::new(path).exists() {
                edge_path = Some(path);
                break;
            }
        }

        if let Some(edge) = edge_path {
            log::info!("Using Edge for silent printing: {}", edge);

            // Use Edge with kiosk printing - this prints silently to default printer
            let result = Command::new(edge)
                .args([
                    "--headless",
                    "--disable-gpu",
                    "--run-all-compositor-stages-before-draw",
                    &format!("--print-to-pdf-no-header"),
                    "--kiosk-printing",
                    &file_url,
                ])
                .output();

            match result {
                Ok(output) => {
                    log::info!(
                        "Edge print output: {:?}",
                        String::from_utf8_lossy(&output.stderr)
                    );

                    // Edge kiosk printing should complete quickly
                    // Give a small delay for print spooler
                    std::thread::sleep(std::time::Duration::from_millis(500));

                    return Ok(format!("Print job sent to {}", printer_name));
                }
                Err(e) => {
                    log::error!("Edge print failed: {}", e);
                }
            }
        }

        // Fallback: Use PowerShell with Out-Printer for plain text (works great for dot matrix)
        // Convert HTML to plain text and print directly
        let ps_script = format!(
            r#"
$ErrorActionPreference = 'Stop'
$filePath = '{}'

# Get default printer
$printer = (Get-CimInstance -Class Win32_Printer | Where-Object {{$_.Default -eq $true}}).Name
Write-Output "PRINTER:$printer"

# Try to use IE (if available) with ExecWB
try {{
    $ie = New-Object -ComObject InternetExplorer.Application
    $ie.Visible = $false
    $ie.Silent = $true
    $ie.Navigate("file:///$($filePath -replace '\\\\', '/')")
    
    $timeout = 30
    $count = 0
    while (($ie.Busy -or $ie.ReadyState -ne 4) -and $count -lt $timeout) {{
        Start-Sleep -Milliseconds 100
        $count++
    }}
    
    Start-Sleep -Milliseconds 200
    
    # OLECMDID_PRINT (6) with OLECMDEXECOPT_DONTPROMPTUSER (2)
    $ie.ExecWB(6, 2)
    
    Start-Sleep -Milliseconds 1000
    $ie.Quit()
    [System.Runtime.Interopservices.Marshal]::ReleaseComObject($ie) | Out-Null
    
    Write-Output "SUCCESS"
    exit 0
}} catch {{
    Write-Output "IE_FAILED:$_"
}}

# Fallback: Open with default app and send print command
try {{
    $shell = New-Object -ComObject Shell.Application
    $shell.ShellExecute($filePath, "", "", "print", 0)
    Start-Sleep -Milliseconds 2000
    Write-Output "SUCCESS"
}} catch {{
    Write-Output "ERROR:$_"
}}
            "#,
            html_path_str.replace("'", "''")
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
                let output_str = stdout.trim();

                log::info!("Print result: {}", output_str);

                if output_str.contains("SUCCESS") {
                    let printer_line = output_str
                        .lines()
                        .find(|l| l.starts_with("PRINTER:"))
                        .map(|l| l.replace("PRINTER:", ""))
                        .unwrap_or_default();
                    Ok(format!("Print job sent to {}", printer_line))
                } else if output_str.contains("ERROR:") || output_str.contains("IE_FAILED:") {
                    let error_msg = output_str
                        .lines()
                        .find(|l| l.starts_with("ERROR:") || l.starts_with("IE_FAILED:"))
                        .map(|l| l.replace("ERROR:", "").replace("IE_FAILED:", ""))
                        .unwrap_or_else(|| "Print failed".to_string());
                    Err(error_msg)
                } else {
                    Ok("Print initiated".to_string())
                }
            }
            Err(e) => Err(format!("Failed to execute: {}", e)),
        }
    }

    #[cfg(not(windows))]
    {
        Err("Silent printing is only supported on Windows".to_string())
    }
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

/// Print raw text directly to printer (for dot matrix)
#[command]
pub async fn print_raw_text(text: String, printer_name: Option<String>) -> Result<String, String> {
    #[cfg(windows)]
    {
        let printer_arg = if let Some(ref name) = printer_name {
            format!("-PrinterName '{}'", name.replace("'", "''"))
        } else {
            String::new()
        };

        let escaped_text = text.replace("'", "''").replace("`", "``");

        let ps_script = format!(
            r#"
$content = @'
{}
'@
Out-Printer {} -InputObject $content
Write-Output "SUCCESS"
            "#,
            escaped_text, printer_arg
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
                    Ok("Raw print job sent".to_string())
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
        let _ = (text, printer_name);
        Err("Only supported on Windows".to_string())
    }
}
