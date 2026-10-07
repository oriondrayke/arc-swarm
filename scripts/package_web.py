from pathlib import Path
import shutil
root=Path(__file__).resolve().parents[1]
shutil.copytree(root/'data',root/'web/data',dirs_exist_ok=True)
print('Copied public data to web/data')
