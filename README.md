# CommitCraft – VS Code Extension

Repository-aware commit messages using a RAG pipeline, sent to the Gemini API, directly from VS Code.

## Overview
- Purpose: Generate high-quality, context-aware Git commit messages.
- How it works: The extension summarizes your staged diff, optionally augments it with RAG-retrieved project context, then calls Gemini to produce a concise commit message inserted into the Source Control commit box.

## Architecture
- `src/extension.ts`: VS Code extension entry. Registers commands (e.g., Generate Commit Message), reads staged diffs, handles configuration, and writes the result to the commit box.
- `src/rag_client.ts`: RAG integration from the extension. Orchestrates querying the local RAG index utilities and merges results with the diff for Gemini.
- `rag/embedding_index.py`: Builds an embedding index from your corpus. Run before querying.

- `rag/query_rag.py`: Queries the embedding index and returns the most relevant chunks for a given query (e.g., a diff summary).
- `rag/raw_chunks.json`: Pre-split chunks used to bootstrap the index.
- `data/cleaned_dataset.txt`: Example corpus file used to populate `raw_chunks.json` and build the index.

- `esbuild.js`: Bundling configuration for packaging the extension.
- `tsconfig.json`: TypeScript configuration for building the extension.
- `eslint.config.mjs`: Lint rules.

- `src/test/extension.test.ts`: Basic tests for extension activation and commands.

## Setup

### Prerequisites
- VS Code (latest)
- Node.js LTS
- Python 3.10+ (for RAG utilities)

- Gemini API key (Google AI Studio)

### Install dependencies

```powershell
# From repo root
npm install
```

### Configure Gemini
- In VS Code settings:
	- `CommitCraft: Gemini API Key`: set your key
	- `CommitCraft: Model`: choose `gemini-1.5-flash` or `gemini-1.5-pro`

## RAG Workflow
1) Prepare corpus
- Put project text in `data/cleaned_dataset.txt`
- Ensure `rag/raw_chunks.json` aligns with your corpus

2) Build index
```powershell
python rag/embedding_index.py
```

3) Query for relevant context
```powershell
python rag/query_rag.py "Refactor parser to handle edge cases"
```

4) Extension usage
- The extension summarizes staged diffs
- Queries the RAG index (via `src/rag_client.ts`) for top-k chunks
- Sends augmented prompt (diff + chunks) to Gemini
- Writes the final message to the commit box

## Running the Extension (Dev)
### Launch in VS Code
- First compile the extension, then launch the Dev Host.
```powershell
npm run compile
```
- Press `F5` (Run Extension) to open a new Extension Development Host.
- In the Dev Host, open a repo, stage changes, then run `CommitCraft: Generate Commit Message`.

### Watch build
Use the provided tasks to continuously build TypeScript and bundle:
```powershell
# Start watch tasks (TypeScript + esbuild)
# VS Code: Terminal > Run Task > watch
```

Tasks available (from `.vscode/tasks.json` / workspace tasks):
- `watch` → depends on `npm: watch:tsc` and `npm: watch:esbuild`
- `npm: watch:tsc` → TypeScript compile in watch mode
- `npm: watch:esbuild` → esbuild bundle in watch mode

## Building/Compiling
These scripts are defined in `package.json` and driven by `esbuild.js` and `tsconfig.json`.
```powershell
# One-off TypeScript build
npm run build:tsc
```

# One-off esbuild bundle
npm run build:esbuild

# Continuous watch (both)
npm run watch
```

If tasks are configured in VS Code, you can use `Run Task` to start `watch` which runs both `npm: watch:tsc` and `npm: watch:esbuild` in the background.

## Testing

Run extension tests:
```powershell
npm test
```

Watch tests (if configured):
```powershell
# VS Code: Terminal > Run Task > tasks: watch-tests
```

## File-by-File Guide
- `src/extension.ts`: Main entry; registers the generate command, reads diffs using VS Code APIs, calls RAG client and Gemini, writes commit message.
- `src/rag_client.ts`: Exposes functions for querying the Python RAG utilities and merging retrieved chunks. Handles timeouts and fallbacks if RAG isn’t available.
- `rag/embedding_index.py`: Reads `raw_chunks.json`/corpus, builds embeddings, saves index (e.g., `rag/index.*`).

- `rag/query_rag.py`: Accepts a query string, returns top-k chunks and metadata.
- `rag/raw_chunks.json`: JSON of text chunks used for indexing.
- `data/cleaned_dataset.txt`: Example corpus for development.

- `esbuild.js`: Bundles the extension for packaging.
- `tsconfig.json`: TypeScript compiler configuration.
- `eslint.config.mjs`: Lint configuration.

- `src/test/extension.test.ts`: Sanity tests for command registration/activation.

## Packaging & Publish (optional)

Build the extension bundle and package a `.vsix` (requires `vsce`):
```powershell
npm install -g vsce
vsce package
```

You can then install the `.vsix` in VS Code via `Extensions` panel → `...` → `Install from VSIX...`.

## Troubleshooting

- No commit message inserted: ensure changes are staged and the command is run in a Git workspace.
- RAG results empty: rebuild the index and verify your corpus.
- Gemini errors: check API key and model selection.

---
