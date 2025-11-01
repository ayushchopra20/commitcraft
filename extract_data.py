import os
import json
import string
import random
from git import Repo
from langdetect import detect, DetectorFactory

DetectorFactory.seed = 0  # for consistent results

BASE_DIR = "repos"
OUTPUT_JSON = "repo_commit_data.json"
MAX_COMMITS = 50

# --- Helpers ------------------------------------------------------------

def get_word_count(text):
    return len(text.strip().split())

def is_english_text(text):
    """Check if text is English or too short to detect."""
    try:
        if not text or len(text.strip()) < 3:
            return True
        return detect(text) == "en"
    except Exception:
        return True

def is_binary_data(text):
    """Heuristic: if <90% printable ASCII, treat as binary."""
    if not text:
        return False
    printable = sum(ch in string.printable for ch in text)
    return printable / len(text) < 0.9

CONTROL_SEPS = (
    "\u2028",  # LINE SEPARATOR
    "\u2029",  # PARAGRAPH SEPARATOR
    "\x1e",    # RECORD SEPARATOR
    "\x1f",    # UNIT SEPARATOR
    "\x85",    # NEXT LINE
)

def clean_text(s: str) -> str:
    if not s:
        return ""
    s = ''.join(ch for ch in s if ch in string.printable)
    s = s.replace("\r\n", "\\n").replace("\r", "\\n").replace("\n", "\\n")
    for sep in CONTROL_SEPS:
        s = s.replace(sep, "\\n")
    s = s.replace('"', '""')
    s = s.replace("\t", "    ")
    return s.strip()

# --- Core analysis ------------------------------------------------------

def analyze_repo(repo_path):
    records = []
    try:
        repo_name = os.path.basename(repo_path)
        repo = Repo(repo_path)
        all_commits = list(repo.iter_commits())  # all commits from the default branch (HEAD)

        if len(all_commits) > MAX_COMMITS:
            commits = random.sample(all_commits, MAX_COMMITS)
        else:
            commits = all_commits

        print(f"📘 {repo_name}: {len(commits)} commits found")

        # if len(commits) < 500:
        #     print(f"⏩ Skipping {repo_name} (less than 500 commits)")
        #     return records

        for commit in commits:
            msg = commit.message.strip()

            if "merge" in msg.lower() or not commit.parents:
                continue

            word_count = get_word_count(msg)
            if word_count < 5 or word_count > 150:
                continue

            if not is_english_text(msg):
                continue

            parent = commit.parents[0]
            diff_index = parent.diff(commit, create_patch=True)

            for diff in diff_index:
                try:
                    diff_text = diff.diff.decode("utf-8", errors="ignore")
                    if diff_text.count("\n") > 20:
                        continue

                    file_name = diff.b_path or diff.a_path or ""
                    # only process certain file extensions
                    allowed_exts = {'.py', '.txt', '.yml'}
                    _, ext = os.path.splitext(file_name or '')
                    if not ext or ext.lower() not in allowed_exts:
                        # skip files with non-matching extensions
                        continue
                    if file_name and not is_english_text(file_name):
                        continue

                    try:
                        before_code = diff.a_blob.data_stream.read().decode("utf-8", errors="ignore") if diff.a_blob else ""
                    except Exception:
                        before_code = ""

                    try:
                        after_code = diff.b_blob.data_stream.read().decode("utf-8", errors="ignore") if diff.b_blob else ""
                    except Exception:
                        after_code = ""

                    # require that after_code is present (non-empty) — skip otherwise
                    if not after_code or not after_code.strip():
                        continue

                    combined = before_code[:500] + after_code[:500] + diff_text[:500]
                    if is_binary_data(combined):
                        continue

                    records.append({
                        "repo_name": repo_name,
                        "file_name": clean_text(file_name),
                        "diff": clean_text(diff_text),
                        "commit_message": clean_text(msg),
                        "before_code": clean_text(before_code),
                        "after_code": clean_text(after_code),
                        "commit_id": commit.hexsha
                    })

                except Exception as e:
                    print(f"⚠️ Skipped a diff in {repo_name}: {e}")

    except Exception as e:
        print(f"❌ Failed to process {repo_path}: {e}")
    return records

# --- Main ---------------------------------------------------------------

def main():
    all_records = []

    for folder in os.listdir(BASE_DIR):
        repo_path = os.path.join(BASE_DIR, folder)
        if os.path.isdir(repo_path) and os.path.exists(os.path.join(repo_path, ".git")):
            all_records.extend(analyze_repo(repo_path))

    # Save JSON
    with open(OUTPUT_JSON, "w", encoding="utf-8") as f:
        json.dump(all_records, f, ensure_ascii=False, indent=2)

    print(f"✅ Data extraction complete. Saved to {OUTPUT_JSON}")

if __name__ == "__main__":
    main()
