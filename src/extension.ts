import * as vscode from "vscode";
import { execSync } from "child_process";
import * as dotenv from "dotenv";
import { queryRAG } from "./rag_client";
import { GoogleGenerativeAI } from "@google/generative-ai";

dotenv.config();

function generateTemplateCommit(diff: string): string {
  const lower = diff.toLowerCase();

  if (lower.includes("fix") || lower.includes("error") || lower.includes("bug")) {
    return "fix: resolve bug in code";
  }

  if (lower.includes("add") || lower.includes("create") || lower.includes("new")) {
    return "feat: add new functionality";
  }
  if (lower.includes("remove") || lower.includes("delete")) {
    return "chore: remove unused code";
  }

  if (lower.includes("refactor") || lower.includes("cleanup")) {
    return "refactor: improve code quality and structure";
  }

  if (lower.includes("perf") || lower.includes("speed") || lower.includes("optimiz")) {
    return "perf: optimize performance";
  }

  if (lower.includes("docs") || lower.includes(".md") || lower.includes("readme")) {
    return "docs: update documentation";
  }

  if (lower.includes("config") || lower.includes("yaml") || lower.includes("json")) {
    return "chore: update configuration";
  }

  if (lower.includes("ui") || lower.includes("ux") || lower.includes("style")) {
    return "style: improve UI/UX elements";
  }
  // Default fallback
  return "chore: update codebase";
}

function getRepo(api: any): any | undefined {
  if (!api || api.repositories.length === 0) {
    return undefined;
  }
  const selected = api.repositories.find((r: any) => r.ui?.selected);
  return selected || api.repositories[0];
}

function hardLimit(text: string, max = 180_000) {
  // Gemini 1.5 can take long prompts, but we keep a generous cap to avoid timeouts.
  return text.length > max ? text.slice(0, max) : text;
}

async function getGeminiApiKey(): Promise<string | undefined> {
  const cfg = vscode.workspace.getConfiguration();
  const fromSettings = cfg.get<string>("commitcraft.geminiApiKey");
  return (fromSettings && fromSettings.trim()) || process.env.GEMINI_API_KEY;
}

export function activate(context: vscode.ExtensionContext) {
  const cmd = vscode.commands.registerCommand(
    "commitcraft.generateCommit",
    async () => {
      try {
        // 1) Access VS Code Git API
        const gitExt = vscode.extensions.getExtension("vscode.git")?.exports;
        const api = gitExt?.getAPI(1);
        const repo = getRepo(api);
        if (!repo) {
          vscode.window.showErrorMessage("CommitCraft: No Git repository found.");
          return;
        }

        // 2) Get staged diff
        const cwd = repo.rootUri.fsPath;
        const diff = execSync("git diff --staged", {
          encoding: "utf-8",
          cwd,
        });
        if (!diff.trim()) {
          vscode.window.showWarningMessage(
            "CommitCraft: No staged changes found."
          );
          return;
        }

        // 3) Config / API key
        const apiKey = await getGeminiApiKey();
        if (!apiKey) {
          vscode.window.showErrorMessage(
            "CommitCraft: Gemini API key missing. Set Settings → CommitCraft → Gemini Api Key or define GEMINI_API_KEY."
          );
          return;
        }
        const cfg = vscode.workspace.getConfiguration();
        const modelName =
          cfg.get<string>("commitcraft.model") || "gemini-2.5-flash";
        const maxChars = cfg.get<number>("commitcraft.maxChars") || 100;

        
        // -------------------- RAG Retrieval --------------------
          vscode.window.setStatusBarMessage("$(sync) CommitCraft: retrieving similar commits…", 3000);

          let examplesSection = "";
          let usedRAG = false;

          try {
            const retrieved = await queryRAG(diff); // Call Python RAG

            if (retrieved && retrieved.length > 0) {
              usedRAG = true;
              examplesSection = retrieved
                .map((chunk, i) => `EXAMPLE ${i + 1}:\n${chunk}`)
                .join("\n\n");
            }

            console.log("Used examplesSection:", examplesSection);

          } catch (ragErr) {
            console.warn("CommitCraft RAG lookup failed:", ragErr);
          }

          // If RAG failed: use template fallback
          if (!examplesSection) {
            const template = generateTemplateCommit(diff);
            repo.inputBox.value = template;
            vscode.window.showWarningMessage(
              `CommitCraft: RAG unavailable. Applied template commit message: "${template}".`
            );
            return;
          }
          // ----------------------------------------------------------
        
          // -------------------- AI GENERATION --------------------
          vscode.window.setStatusBarMessage("$(sync) CommitCraft: generating commit message…", 3000);

          const genAI = new GoogleGenerativeAI(apiKey);
          const model = genAI.getGenerativeModel({ model: modelName });

          const prompt = [
            "You are an expert software engineer writing precise Git commit messages.",
            "Analyze the provided code diff and identify the primary user-visible change.",
            "Ignore formatting-only edits or trivial refactors unless they are the main change.",
            "",
            "Write a SINGLE-LINE commit message that:",
            "- Uses the imperative present tense (e.g., 'add', 'fix', 'remove').",
            "- Follows the Conventional Commits format: <type>(<scope>): <summary>",
            "- Types must be one of: feat, fix, refactor, perf, test, docs, chore, build,",
            "- Scope should reference the affected component or file when possible.",
            "- Summary must describe WHAT changed and WHY it matters.",
            "- Avoid vague terms like 'update' or 'change'. Be specific.",
            "",
            `Limit the message to ${maxChars} characters.`,
            "",
            "Use consistent wording style matching these prior commits:",
            hardLimit(examplesSection, 60_000),
            "",
            "New diff to summarize:",
            hardLimit(diff),
            "",
            "Return ONLY the commit message text. No quotes. No explanations."

          ].join("\n");

          const resp = await model.generateContent(prompt);
          const text = resp.response.text().trim();
          // ----------------------------------------------------------


        console.log("Generated commit message:", text);
        console.log("Prompt:", prompt);
        console.log("Full response:", resp);
        console.log("Used model:", modelName);
        console.log("<<<<< CONFIG >>>>>");
        console.log("Max chars setting:", maxChars);

        if (!text) {
          vscode.window.showErrorMessage(
            "CommitCraft: No message returned from Gemini."
          );
          return;
        }

        // 6) Insert into the built-in Source Control commit box
        repo.inputBox.value = text;
        vscode.window.showInformationMessage(
          "CommitCraft: commit message generated with RAG and inserted."
        );
      } catch (err: any) {
        const msg =
          err?.response?.status
            ? `CommitCraft error (${err.response.status}): ${err.response.statusText}`
            : `CommitCraft error: ${err?.message || String(err)}`;
        vscode.window.showErrorMessage(msg);
      }
    }
  );

  context.subscriptions.push(cmd);
}

export function deactivate() {}
