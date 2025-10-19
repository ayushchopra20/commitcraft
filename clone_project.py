# Script to clone multiple GitHub repositories listed in a text file.

import os
import subprocess

# Path to your text file containing repo URLs
repo_file = "github_repos.txt"

# Directory where you want to clone all repositories
base_dir = "repos"
os.makedirs(base_dir, exist_ok=True)

# Read all repo URLs from file
with open(repo_file, "r") as f:
    repos = [line.strip() for line in f if line.strip()]

for repo_url in repos:
    repo_name = repo_url.split("/")[-1].replace(".git", "")
    repo_path = os.path.join(base_dir, repo_name)

    if os.path.exists(repo_path):
        print(f"✅ Repository '{repo_name}' already exists. Skipping clone.")
    else:
        print(f"⬇️ Cloning '{repo_name}'...")
        try:
            subprocess.run(["git", "clone", repo_url, repo_path], check=True)
            print(f"✅ Successfully cloned '{repo_name}'.\n")
        except subprocess.CalledProcessError:
            print(f"❌ Failed to clone '{repo_name}'.\n")
