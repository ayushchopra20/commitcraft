import sys
import json
import faiss
from sentence_transformers import SentenceTransformer

# Arguments passed from Node
query = sys.argv[1]
index_path = sys.argv[2]
chunk_path = sys.argv[3]

# Load FAISS
index = faiss.read_index(index_path)

# Load chunks
with open(chunk_path, "r", encoding="utf-8") as f:
    chunks = json.load(f)

# Encode and search
model = SentenceTransformer("all-MiniLM-L6-v2")
q_emb = model.encode([query], convert_to_numpy=True)

distances, indices = index.search(q_emb, 3)

results = [chunks[i] for i in indices[0]]

print(json.dumps(results))
