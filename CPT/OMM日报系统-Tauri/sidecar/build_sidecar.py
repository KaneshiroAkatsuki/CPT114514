import PyInstaller.__main__
import os
import shutil

SIDE_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT_DIR = os.path.dirname(SIDE_DIR)
TAURI_BIN_DIR = os.path.join(ROOT_DIR, "src-tauri", "binaries")

os.makedirs(TAURI_BIN_DIR, exist_ok=True)

PyInstaller.__main__.run([
    os.path.join(SIDE_DIR, "sidecar_main.py"),
    "--onefile",
    "--name=generate_report",
    "--hidden-import=generate_report",
    "--add-data", f"{os.path.join(SIDE_DIR, 'generate_report.py')};.",
    "--distpath", TAURI_BIN_DIR,
    "--workpath", os.path.join(SIDE_DIR, "build"),
    "--specpath", os.path.join(SIDE_DIR, "build"),
    "--noconfirm",
])

# Also create the target-triple-named copy used by Tauri externalBin
src = os.path.join(TAURI_BIN_DIR, "generate_report.exe")
dst = os.path.join(TAURI_BIN_DIR, "generate_report-x86_64-pc-windows-msvc.exe")
shutil.copy2(src, dst)

print(f"Sidecar built at: {src}")
print(f"Sidecar copied to: {dst}")
