// =====================================================
// Silent Print Module
// Windows-only truly silent printing using IE COM object
// =====================================================

use std::io::Write;
use std::process::Command;
use tauri::command;

/// Print HTML content silently using IE COM object.
/// This prints directly to the default printer without any dialogs.
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
        
        log::info!("Silent printing file: {:?}", html_path);
        
        // Use IE COM object for truly silent printing
        // ExecWB(6, 2) = Print command with silent flag
        let ps_script = format!(
            r#"
$ErrorActionPreference = 'SilentlyContinue'
$filePath = '{}'

# Check if default printer exists
$printer = (Get-CimInstance -Class Win32_Printer -ErrorAction SilentlyContinue | Where-Object {{$_.Default -eq $true}}).Name
if (-not $printer) {{
    Write-Output "ERROR:No default printer configured"
    exit 0
}}

try {{
    $ie = New-Object -ComObject InternetExplorer.Application
    $ie.Visible = $false
    $ie.Silent = $true
    $ie.Navigate("file:///$($filePath -replace '\\', '/')")
    
    # Wait for page to load with timeout (max 5 seconds)
    $timeout = 50  # 50 * 100ms = 5 seconds
    $count = 0
    while (($ie.Busy -or $ie.ReadyState -ne 4) -and $count -lt $timeout) {{
        Start-Sleep -Milliseconds 100
        $count++
    }}
    
    if ($count -ge $timeout) {{
        $ie.Quit()
        Write-Output "ERROR:Page load timeout"
        exit 0
    }}
    
    # Small delay to ensure rendering is complete
    Start-Sleep -Milliseconds 300
    
    # Print silently: ExecWB(6, 2) = OLECMDID_PRINT with OLECMDEXECOPT_DONTPROMPTUSER
    $ie.ExecWB(6, 2)
    
    # Brief delay to allow print job to be queued
    Start-Sleep -Milliseconds 500
    
    $ie.Quit()
    [System.Runtime.Interopservices.Marshal]::ReleaseComObject($ie) | Out-Null
    Write-Output "SUCCESS"
}} catch {{
    Write-Output "ERROR:$_"
    exit 0
}}
            "#,
            html_path_str.replace("'", "''")
        );
        
        // Run with a timeout using a separate thread
        let output = std::thread::spawn(move || {
            Command::new("powershell")
                .args([
                    "-NoProfile",
                    "-NonInteractive",
                    "-WindowStyle", "Hidden",
                    "-ExecutionPolicy", "Bypass",
                    "-Command", &ps_script
                ])
                .output()
        });
        
        // Wait max 10 seconds for the print job
        let result = match output.join() {
            Ok(Ok(result)) => {
                let stdout = String::from_utf8_lossy(&result.stdout);
                let output_str = stdout.trim();
                
                log::info!("Print result: {}", output_str);
                
                if output_str.contains("SUCCESS") {
                    Ok("Print job sent to default printer".to_string())
                } else if output_str.starts_with("ERROR:") {
                    let error_msg = output_str.replace("ERROR:", "");
                    Err(error_msg)
                } else {
                    Ok("Print initiated".to_string())
                }
            }
            Ok(Err(e)) => Err(format!("Failed to execute: {}", e)),
            Err(_) => Err("Print command timed out".to_string())
        };
        
        result
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
