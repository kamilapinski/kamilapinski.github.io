import os
from pathlib import Path

# 🔧 Ustaw ścieżkę do folderu z plikami PNG
folder_path = Path(r"C:\Users\kamil\OneDrive\Dokument\github\wkp\media\konkursowe")  # ← zmień na swoją ścieżkę

# 🔢 Prefiks kodu
prefix = "SZ2223"

# 🧭 Pobranie plików PNG i sortowanie po dacie modyfikacji
png_files = sorted(
    folder_path.glob("Zrzut*.png"),
    key=lambda f: f.stat().st_mtime
)

# 🚀 Zmiana nazw
for i, file in enumerate(png_files, start=1):
    new_name = f"{prefix}{i:02d}.png"  # np. SZ242501.png
    new_path = folder_path / new_name
    file.rename(new_path)
    print(f"Zmieniono: {file.name} → {new_name}")

print("✅ Zakończono zmianę nazw plików.")
