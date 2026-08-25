import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const output = new URL("../docs/freelaw-studio-review.gif", import.meta.url).pathname;
const temp = mkdtempSync(join(tmpdir(), "freelaw-studio-review-"));

const slides = [
  {
    eyebrow: "SYNTHETIC REVIEWER WALKTHROUGH",
    title: "Freelaw Studio",
    body: ["OAuth 2.1 + PKCE", "Organization-scoped MCP", "Synthetic data only"],
    accent: "app.freelaw.ai/api/agent/mcp",
  },
  {
    eyebrow: "01 / CONNECT SECURELY",
    title: "OAuth before data",
    body: ["The host opens the authorization flow.", "Tokens stay out of the chat transcript.", "Scopes are explicit and revocable."],
    accent: "office:read  •  office:write",
  },
  {
    eyebrow: "02 / DISCOVER",
    title: "Permission-aware tools",
    body: ["permissions.describe → tools/list", "The catalog exposes only allowed actions.", "No guessed IDs or internal admin tools."],
    accent: "catalog.list",
  },
  {
    eyebrow: "03 / TENANT BOUNDARIES",
    title: "One office at a time",
    body: ["Clients, processes and tasks are scoped to the organization.", "Cross-office reads fail closed.", "Reviewer data below is entirely fictitious."],
    accent: "organization_id = synthetic-review-office",
  },
  {
    eyebrow: "04 / MUTATIONS",
    title: "Confirm before changing",
    body: ["Create, upload, generate, submit and delete are explicit.", "Idempotency and correlation IDs prevent duplicates.", "Sensitive actions never hide behind a read-only label."],
    accent: "confirmation_required: true",
  },
  {
    eyebrow: "05 / VERIFY",
    title: "Accepted is not completed",
    body: ["Long-running work returns a traceable job.", "Retry-After and terminal state are observable.", "The host checks the final result before reporting success."],
    accent: "status: completed",
  },
  {
    eyebrow: "HUMAN REVIEW REQUIRED",
    title: "Assistive, not autonomous",
    body: ["AI output is reviewed by a qualified professional", "before reliance, filing or finalization.", "No autonomous high-impact legal decisions."],
    accent: "Fictitious data • no client information",
  },
];

const escapeXml = (value) => value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");

const svg = ({ eyebrow, title, body, accent }) => `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720" viewBox="0 0 1280 720">
  <rect width="1280" height="720" fill="#f8fafc"/>
  <rect width="18" height="720" fill="#2563eb"/>
  <circle cx="1160" cy="118" r="210" fill="#dbeafe" opacity="0.75"/>
  <circle cx="1140" cy="138" r="118" fill="#bfdbfe" opacity="0.65"/>
  <text x="86" y="112" font-family="Arial, sans-serif" font-size="24" font-weight="700" letter-spacing="3" fill="#2563eb">${escapeXml(eyebrow)}</text>
  <text x="86" y="210" font-family="Arial, sans-serif" font-size="64" font-weight="700" fill="#0f172a">${escapeXml(title)}</text>
  ${body.map((line, index) => `<text x="92" y="${320 + index * 58}" font-family="Arial, sans-serif" font-size="32" fill="#334155">${escapeXml(line)}</text>`).join("\n  ")}
  <rect x="86" y="574" width="1108" height="64" rx="16" fill="#0f172a"/>
  <text x="116" y="616" font-family="Menlo, monospace" font-size="24" fill="#bfdbfe">${escapeXml(accent)}</text>
  <text x="86" y="684" font-family="Arial, sans-serif" font-size="18" fill="#64748b">Freelaw Studio • reviewer demo • synthetic data only</text>
</svg>`;

try {
  const frames = slides.map((slide, index) => {
    const file = join(temp, `frame-${String(index).padStart(2, "0")}.svg`);
    writeFileSync(file, svg(slide));
    return file;
  });

  const result = spawnSync("/opt/homebrew/bin/magick", [
    "-density",
    "96",
    "-font",
    "/System/Library/Fonts/Helvetica.ttc",
    ...frames,
    "-set",
    "delay",
    "180",
    "-loop",
    "0",
    output,
  ], { encoding: "utf8" });

  if (result.status !== 0) {
    process.stderr.write(result.stderr || result.stdout || "ImageMagick failed\n");
    process.exit(result.status ?? 1);
  }
} finally {
  rmSync(temp, { recursive: true, force: true });
}
