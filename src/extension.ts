import * as vscode from "vscode";
import { execSync } from "child_process";
import * as dotenv from "dotenv";
import { GoogleGenerativeAI } from "@google/generative-ai";

dotenv.config();

function getRepo(api: any): any | undefined {
  if (!api || api.repositories.length === 0) {return undefined;}
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
  const cmd = vscode.commands.registerCommand("commitcraft.generateCommit", async () => {
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
      const diff = execSync("git diff --staged", { encoding: "utf-8", cwd });
      if (!diff.trim()) {
        vscode.window.showWarningMessage("CommitCraft: No staged changes found.");
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
      const modelName = cfg.get<string>("commitcraft.model") || "gemini-2.5-flash";
      const maxChars = cfg.get<number>("commitcraft.maxChars") || 100;

      vscode.window.setStatusBarMessage("$(sync) CommitCraft: generating…", 3000);

      // 4) Build prompt and call Gemini
      const genAI = new GoogleGenerativeAI(apiKey);
      const model = genAI.getGenerativeModel({ model: modelName });

      const prompt =
        [
          "You are an expert software engineer.",
          `Generate a SINGLE-LINE Git commit message in imperative mood, under ${maxChars} characters.`,
          "Prefer Conventional Commits type if obvious (performance, speed up, accelerate, fast, slow, latency, optimize, efficient).",
          "Do NOT wrap in quotes, no code fences, no extra commentary.",
          "",
          "Diff:",
          hardLimit(diff)
        ].join("\n");

      const resp = await model.generateContent(prompt);
      const text = resp.response.text().trim();
	  console.log("Generated commit message:", text);
	  console.log("Full response:", resp);
	  console.log("Used model:", modelName);
	  console.log("<<<<< API >>>>>");
	  console.log("Max chars setting:", diff);

      if (!text) {
        vscode.window.showErrorMessage("CommitCraft: No message returned from Gemini.");
        return;
      }

      // 5) Insert into the built-in Source Control commit box
      repo.inputBox.value = text;
      vscode.window.showInformationMessage("CommitGen: commit message inserted.");
    } catch (err: any) {
      const msg =
        err?.response?.status
          ? `CommitGen error (${err.response.status}): ${err.response.statusText}`
          : `CommitGen error: ${err?.message || String(err)}`;
      vscode.window.showErrorMessage(msg);
    }
  });

  context.subscriptions.push(cmd);
}

export function deactivate() {}