// =====================================================
// Silent Print Module
// Windows-only silent printing using notepad /p method
// =====================================================

use std::io::Write;
use std::process::Command;
use tauri::command;

/// Print HTML content silently by converting to text and using notepad /p
/// or by using the print verb with specific application.
#[command]
pub async fn silent_print(html_content: String) -> Result<String, String> {
    // Get temp directory and create file paths
    let temp_dir = std::env::temp_dir();
    let html_path = temp_dir.join("velan_medicals_bill.html");
    
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
        
        // Use PowerShell with Out-Printer to print HTML
        // This opens the file in the default browser and sends it to the default printer
        let ps_script = format!(
            r#"
            # Get the default printer name
            $defaultPrinter = (Get-CimInstance -Class Win32_Printer | Where-Object {{$_.Default -eq $true}}).Name
            
            if ($defaultPrinter) {{
                # Use printui.dll to print
                $filePath = '{}'
                
                # Method 1: Use IE COM object for silent printing
                try {{
                    $ie = New-Object -ComObject InternetExplorer.Application
                    $ie.Visible = $false
                    $ie.Silent = $true
                    $ie.Navigate("file:///$($filePath -replace '\\', '/')")
                    
                    # Wait for page to load
                    while ($ie.Busy -or $ie.ReadyState -ne 4) {{
                        Start-Sleep -Milliseconds 200
                    }}
                    Start-Sleep -Milliseconds 500
                    
                    # Print using ExecWB (6 = print, 2 = silent/no UI)
                    $ie.ExecWB(6, 2)
                    
                    # Wait for print to complete
                    Start-Sleep -Seconds 3
                    
                    $ie.Quit()
                    [System.Runtime.Interopservices.Marshal]::ReleaseComObject($ie) | Out-Null
                    Write-Output "SUCCESS"
                }} catch {{
                    Write-Error "IE Print failed: $_"
                    exit 1
                }}
            }} else {{
                Write-Error "No default printer found"
                exit 1
            }}
            "#,
            html_path_str.replace("\\", "\\\\").replace("'", "''")
        );
        
        log::info!("Executing PowerShell print script for: {:?}", html_path);
        
        let output = Command::new("powershell")
            .args([
                "-NoProfile",
                "-NonInteractive",
                "-WindowStyle", "Hidden",
                "-ExecutionPolicy", "Bypass",
                "-Command", &ps_script
            ])
            .output();
        
        match output {
            Ok(result) => {
                let stdout = String::from_utf8_lossy(&result.stdout);
                let stderr = String::from_utf8_lossy(&result.stderr);
                
                log::info!("Print stdout: {}", stdout);
                if !stderr.is_empty() {
                    log::error!("Print stderr: {}", stderr);
                }
                
                if result.status.success() && stdout.contains("SUCCESS") {
                    Ok("Print job sent to default printer".to_string())
                } else if result.status.success() {
                    // Command succeeded but may not have printed
                    log::warn!("Print command completed but output unclear: {}", stdout);
                    Ok("Print job initiated".to_string())
                } else {
                    Err(format!("Print failed: {}", stderr))
                }
            }
            Err(e) => Err(format!("Failed to execute print command: {}", e))
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
                "(Get-CimInstance -Class Win32_Printer | Where-Object {$_.Default -eq $true}).Name"
            ])
            .output();
        
        match output {
            Ok(result) => {
                let stdout = String::from_utf8_lossy(&result.stdout);
                let printer_name = stdout.trim();
                log::info!("Default printer: {}", printer_name);
                Ok(!printer_name.is_empty())
            }
            Err(_) => Ok(false)
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
                "(Get-CimInstance -Class Win32_Printer | Where-Object {$_.Default -eq $true}).Name"
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
            Err(e) => Err(format!("Failed to get printer: {}", e))
        }
    }
    
    #[cfg(not(windows))]
    {
        Err("Only supported on Windows".to_string())
    }
}
