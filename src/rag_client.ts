import * as cp from "child_process";
import * as path from "path";

export function queryRAG(diff: string): Promise<string[]> {
  return new Promise((resolve, reject) => {
    const pythonScript = path.join(__dirname, "../rag/query_rag.py");
    const indexPath = path.join(__dirname, "../rag/faiss_index.bin");
    const chunkPath = path.join(__dirname, "../rag/raw_chunks.json");

    console.log("Python script:", pythonScript);
    console.log("FAISS index path:", indexPath);
    console.log("Chunk file path:", chunkPath);

    const py = cp.spawn("python", [
      pythonScript,
      diff,
      indexPath,
      chunkPath
    ]);

    let data = "";
    let error = "";

    py.stdout.on("data", (chunk) => (data += chunk.toString()));
    py.stderr.on("data", (chunk) => (error += chunk.toString()));

    py.on("close", () => {
      if (error.trim()) {
        console.error("RAG Python Error:", error);
      }

      try {
        resolve(JSON.parse(data));
      } catch (e) {
        reject("RAG parse failed: " + data + "\n" + error);
      }
    });
  });
}
