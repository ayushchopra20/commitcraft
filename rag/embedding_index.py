import json
import faiss
from sentence_transformers import SentenceTransformer
import hashlib

def read_dataset(path):
    with open(path, "r", encoding="utf-8") as f:
        content = f.read().split("----------------------------------------")
        return [c.strip() for c in content if c.strip()]

model = SentenceTransformer("all-MiniLM-L6-v2")  # fast & small

data = read_dataset("data/cleaned_dataset.txt")

embeddings = model.encode(data, convert_to_numpy=True)

index = faiss.IndexFlatL2(embeddings.shape[1])
index.add(embeddings)

faiss.write_index(index, "rag/faiss_index.bin")

with open("rag/raw_chunks.json", "w", encoding="utf-8") as f:
    json.dump(data, f, indent=4)

print("FAISS index created with", len(data), "chunks.")
