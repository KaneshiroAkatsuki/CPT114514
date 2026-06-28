use anyhow::{anyhow, Result};
use std::io::{BufRead, BufReader, Write};
use std::process::{Child, ChildStdin, ChildStdout, Command, Stdio};
use std::sync::{Arc, Mutex};

#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

pub struct SidecarManager {
    inner: Arc<Mutex<SidecarInner>>,
}

struct SidecarInner {
    child: Option<Child>,
    stdin: Option<ChildStdin>,
    stdout_reader: Option<BufReader<ChildStdout>>,
}

impl SidecarManager {
    pub fn new() -> Self {
        Self {
            inner: Arc::new(Mutex::new(SidecarInner {
                child: None,
                stdin: None,
                stdout_reader: None,
            })),
        }
    }

    pub fn start(&self, program: &str, args: &[&str]) -> Result<()> {
        self.start_with_envs(program, args, &[])
    }

    pub fn start_with_envs(&self, program: &str, args: &[&str], envs: &[(&str, String)]) -> Result<()> {
        let mut inner = self.inner.lock().unwrap();

        // Kill existing process if any
        if let Some(mut child) = inner.child.take() {
            let _ = child.kill();
            let _ = child.wait();
        }

        let mut cmd = Command::new(program);
        for arg in args {
            cmd.arg(arg);
        }
        for (key, value) in envs {
            cmd.env(key, value);
        }

        // Windows: 隐藏控制台窗口，避免 PyInstaller onefile exe 启动时弹出黑框
        #[cfg(target_os = "windows")]
        cmd.creation_flags(0x08000000); // CREATE_NO_WINDOW

        let mut child = cmd
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn()
            .map_err(|e| anyhow!("Failed to spawn sidecar '{} {}': {}", program, args.join(" "), e))?;

        let stdin = child.stdin.take().ok_or_else(|| anyhow!("Failed to get stdin"))?;
        let stdout = child.stdout.take().ok_or_else(|| anyhow!("Failed to get stdout"))?;
        let stderr = child.stderr.take().ok_or_else(|| anyhow!("Failed to get stderr"))?;

        // Drain stderr in background thread to prevent pipe buffer deadlock
        std::thread::spawn(move || {
            let reader = BufReader::new(stderr);
            for line in reader.lines() {
                if let Ok(l) = line {
                    eprintln!("[sidecar stderr] {}", l);
                }
            }
        });

        inner.stdin = Some(stdin);
        inner.stdout_reader = Some(BufReader::new(stdout));
        inner.child = Some(child);

        Ok(())
    }

    pub fn send_command(&self, command: &str) -> Result<String> {
        let mut inner = self.inner.lock().unwrap();

        let stdin = inner
            .stdin
            .as_mut()
            .ok_or_else(|| anyhow!("Sidecar not started"))?;
        writeln!(stdin, "{}", command)
            .map_err(|e| anyhow!("Failed to write to sidecar stdin: {}", e))?;
        stdin
            .flush()
            .map_err(|e| anyhow!("Failed to flush sidecar stdin: {}", e))?;

        let reader = inner
            .stdout_reader
            .as_mut()
            .ok_or_else(|| anyhow!("Sidecar not started"))?;
        let mut response = String::new();
        reader
            .read_line(&mut response)
            .map_err(|e| anyhow!("Failed to read from sidecar stdout: {}", e))?;

        if response.trim().is_empty() {
            return Err(anyhow!("Empty response from sidecar"));
        }

        Ok(response.trim().to_string())
    }

    pub fn stop(&self) -> Result<()> {
        let mut inner = self.inner.lock().unwrap();
        if let Some(mut child) = inner.child.take() {
            let _ = child.kill();
            let _ = child.wait();
        }
        inner.stdin = None;
        inner.stdout_reader = None;
        Ok(())
    }
}

impl Drop for SidecarManager {
    fn drop(&mut self) {
        let _ = self.stop();
    }
}

pub fn find_sidecar_path(resource_dir: Option<&std::path::Path>) -> Result<(String, Vec<String>)> {
    // In production, use bundled sidecar. Try several candidate locations so that
    // both Tauri-packaged installs and the manually-assembled portable layout work.
    #[cfg(not(debug_assertions))]
    {
        let exe_dir = std::env::current_exe()
            .map_err(|e| anyhow!("Failed to get exe dir: {}", e))?;
        let exe_parent = exe_dir.parent()
            .ok_or_else(|| anyhow!("No parent dir"))?;

        let mut tried: Vec<std::path::PathBuf> = Vec::new();
        let mut check = |p: std::path::PathBuf| -> Option<std::path::PathBuf> {
            tried.push(p.clone());
            if p.is_file() { Some(p) } else { None }
        };

        let candidates: Vec<std::path::PathBuf> = {
            let mut c = vec![
                exe_parent.join("binaries").join("generate_report.exe"),
                exe_parent.join("generate_report.exe"),
            ];
            if let Some(rd) = resource_dir {
                c.push(rd.join("binaries").join("generate_report.exe"));
                c.push(rd.join("generate_report.exe"));
            }
            c
        };

        for candidate in candidates {
            if let Some(found) = check(candidate) {
                return Ok((found.to_string_lossy().to_string(), vec![]));
            }
        }

        return Err(anyhow!(
            "Sidecar executable not found. Tried paths: {:?}",
            tried.iter().map(|p| p.display().to_string()).collect::<Vec<_>>()
        ));
    }

    // In dev mode, find python and sidecar_main.py
    #[cfg(debug_assertions)]
    {
        let project_dir = std::env::current_dir()
            .map_err(|e| anyhow!("Failed to get current dir: {}", e))?;
        let sidecar_script = project_dir.join("sidecar").join("sidecar_main.py");

        if !sidecar_script.exists() {
            // Try parent directory (when running from src-tauri)
            let sidecar_script = project_dir.parent()
                .ok_or_else(|| anyhow!("No parent dir"))?
                .join("sidecar")
                .join("sidecar_main.py");
            if !sidecar_script.exists() {
                return Err(anyhow!("Sidecar script not found"));
            }
            return Ok(("python".to_string(), vec![sidecar_script.to_string_lossy().to_string()]));
        }

        Ok(("python".to_string(), vec![sidecar_script.to_string_lossy().to_string()]))
    }
}
