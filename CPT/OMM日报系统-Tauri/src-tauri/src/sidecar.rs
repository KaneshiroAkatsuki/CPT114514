use anyhow::{anyhow, Result};
use std::io::{BufRead, BufReader, Write};
use std::process::{Child, ChildStdin, Command, Stdio};
use std::sync::{mpsc, Arc, Mutex};
use std::time::Duration;

#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

pub struct SidecarManager {
    inner: Arc<Mutex<SidecarInner>>,
}

struct SidecarInner {
    child: Option<Child>,
    stdin: Option<ChildStdin>,
    stdout_rx: Option<mpsc::Receiver<String>>,
}

const SIDECAR_COMMAND_TIMEOUT: Duration = Duration::from_secs(180);

impl SidecarManager {
    pub fn new() -> Self {
        Self {
            inner: Arc::new(Mutex::new(SidecarInner {
                child: None,
                stdin: None,
                stdout_rx: None,
            })),
        }
    }

    pub fn start(&self, program: &str, args: &[&str]) -> Result<()> {
        self.start_with_envs(program, args, &[])
    }

    pub fn start_with_envs(
        &self,
        program: &str,
        args: &[&str],
        envs: &[(&str, String)],
    ) -> Result<()> {
        let mut inner = self.inner.lock().unwrap();

        Self::clear_process(&mut inner);

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
            .map_err(|e| {
                anyhow!(
                    "Failed to spawn sidecar '{} {}': {}",
                    program,
                    args.join(" "),
                    e
                )
            })?;

        let stdin = child
            .stdin
            .take()
            .ok_or_else(|| anyhow!("Failed to get stdin"))?;
        let stdout = child
            .stdout
            .take()
            .ok_or_else(|| anyhow!("Failed to get stdout"))?;
        let stderr = child
            .stderr
            .take()
            .ok_or_else(|| anyhow!("Failed to get stderr"))?;

        // Drain stderr in background thread to prevent pipe buffer deadlock
        std::thread::spawn(move || {
            let reader = BufReader::new(stderr);
            for line in reader.lines() {
                if let Ok(l) = line {
                    eprintln!("[sidecar stderr] {}", l);
                }
            }
        });

        let (stdout_tx, stdout_rx) = mpsc::channel();
        std::thread::spawn(move || {
            let reader = BufReader::new(stdout);
            for line in reader.lines() {
                match line {
                    Ok(l) => {
                        if stdout_tx.send(l).is_err() {
                            break;
                        }
                    }
                    Err(_) => break,
                }
            }
        });

        inner.stdin = Some(stdin);
        inner.stdout_rx = Some(stdout_rx);
        inner.child = Some(child);

        Ok(())
    }

    pub fn send_command(&self, command: &str) -> Result<String> {
        let mut inner = self.inner.lock().unwrap();

        {
            let stdin = inner
                .stdin
                .as_mut()
                .ok_or_else(|| anyhow!("Sidecar not started"))?;
            if let Err(e) = writeln!(stdin, "{}", command) {
                Self::clear_process(&mut inner);
                return Err(anyhow!("Failed to write to sidecar stdin: {}", e));
            }
            if let Err(e) = stdin.flush() {
                Self::clear_process(&mut inner);
                return Err(anyhow!("Failed to flush sidecar stdin: {}", e));
            }
        }

        let receive_result = {
            let rx = inner
                .stdout_rx
                .as_ref()
                .ok_or_else(|| anyhow!("Sidecar not started"))?;
            rx.recv_timeout(SIDECAR_COMMAND_TIMEOUT)
        };

        let response = match receive_result {
            Ok(response) => response,
            Err(mpsc::RecvTimeoutError::Timeout) => {
                Self::clear_process(&mut inner);
                return Err(anyhow!(
                    "Sidecar command timed out after {} seconds",
                    SIDECAR_COMMAND_TIMEOUT.as_secs()
                ));
            }
            Err(mpsc::RecvTimeoutError::Disconnected) => {
                Self::clear_process(&mut inner);
                return Err(anyhow!("Sidecar stdout closed before response"));
            }
        };

        if response.trim().is_empty() {
            return Err(anyhow!("Empty response from sidecar"));
        }

        Ok(response.trim().to_string())
    }

    pub fn stop(&self) -> Result<()> {
        let mut inner = self.inner.lock().unwrap();
        Self::clear_process(&mut inner);
        Ok(())
    }

    fn clear_process(inner: &mut SidecarInner) {
        if let Some(mut child) = inner.child.take() {
            let _ = child.kill();
            let _ = child.wait();
        }
        inner.stdin = None;
        inner.stdout_rx = None;
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
        let exe_dir =
            std::env::current_exe().map_err(|e| anyhow!("Failed to get exe dir: {}", e))?;
        let exe_parent = exe_dir.parent().ok_or_else(|| anyhow!("No parent dir"))?;

        let mut tried: Vec<std::path::PathBuf> = Vec::new();
        let mut check = |p: std::path::PathBuf| -> Option<std::path::PathBuf> {
            tried.push(p.clone());
            if p.is_file() {
                Some(p)
            } else {
                None
            }
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
            tried
                .iter()
                .map(|p| p.display().to_string())
                .collect::<Vec<_>>()
        ));
    }

    // In dev mode, find python and sidecar_main.py
    #[cfg(debug_assertions)]
    {
        let project_dir =
            std::env::current_dir().map_err(|e| anyhow!("Failed to get current dir: {}", e))?;
        let sidecar_script = project_dir.join("sidecar").join("sidecar_main.py");

        if !sidecar_script.exists() {
            // Try parent directory (when running from src-tauri)
            let sidecar_script = project_dir
                .parent()
                .ok_or_else(|| anyhow!("No parent dir"))?
                .join("sidecar")
                .join("sidecar_main.py");
            if !sidecar_script.exists() {
                return Err(anyhow!("Sidecar script not found"));
            }
            return Ok((
                "python".to_string(),
                vec![sidecar_script.to_string_lossy().to_string()],
            ));
        }

        Ok((
            "python".to_string(),
            vec![sidecar_script.to_string_lossy().to_string()],
        ))
    }
}
