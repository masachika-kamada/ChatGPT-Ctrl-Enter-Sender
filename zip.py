import os
import shutil
import zipfile


def zipdir(path, ziph):
    for root, _, files in os.walk(path):
        for file in files:
            file_path = os.path.join(root, file)
            arcname = os.path.relpath(file_path, path)
            ziph.write(file_path, arcname)


def create_zip(source_dir, target_zip, include_items):
    temp_dir = "temp_dir"
    shutil.rmtree(temp_dir, ignore_errors=True)
    os.makedirs(temp_dir)

    for item in os.listdir(source_dir):
        s = os.path.join(source_dir, item)
        d = os.path.join(temp_dir, item)
        if item in include_items:
            if os.path.isdir(s):
                shutil.copytree(s, d, False, None)
            else:
                shutil.copy2(s, d)

    if os.path.exists(target_zip):
        os.remove(target_zip)
    with zipfile.ZipFile(target_zip, "w", zipfile.ZIP_DEFLATED) as zipf:
        zipdir(temp_dir, zipf)

    shutil.rmtree(temp_dir, ignore_errors=True)


def main():
    include_items = [
        "_locales",
        "icon",
        "background.js",
        "manifest.json",
        "popup.css",
        "popup.html",
        "popup.js",
        "script.js"
    ]
    create_zip(".", "extension.zip", include_items)


if __name__ == "__main__":
    main()
