import os
import zipfile

OUTPUT_ZIP = "public/nayab-billing-source-code.zip"
EXCLUDE_DIRS = {
    "node_modules",
    ".git",
    "dist",
    ".aistudio",
    "__pycache__"
}
EXCLUDE_FILES = {
    "nayab-billing-source-code.zip",
    "package_project.py"
}

def make_zip():
    os.makedirs("public", exist_ok=True)
    if os.path.exists(OUTPUT_ZIP):
        os.remove(OUTPUT_ZIP)

    print(f"Creating {OUTPUT_ZIP}...")
    file_count = 0
    with zipfile.ZipFile(OUTPUT_ZIP, "w", zipfile.ZIP_DEFLATED) as zf:
        for root, dirs, files in os.walk("."):
            dirs[:] = [d for d in dirs if d not in EXCLUDE_DIRS and not d.startswith(".")]
            for file in files:
                if file in EXCLUDE_FILES or file.endswith(".pyc"):
                    continue
                file_path = os.path.join(root, file)
                # Relative archive name
                arcname = os.path.relpath(file_path, ".")
                if arcname.startswith("."):
                    continue
                zf.write(file_path, arcname)
                file_count += 1
    print(f"Successfully packaged {file_count} files into {OUTPUT_ZIP} ({os.path.getsize(OUTPUT_ZIP)} bytes)")

if __name__ == "__main__":
    make_zip()
