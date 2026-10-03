export const EXPECTED_PROVIDER_IDS: readonly [
  "chatgpt-openai", "claude-anthropic", "gemini-google", "grok-xai", "meta-muse-spark"
];
export const SUBMISSION_PROVIDER_IDENTITIES: Readonly<{
  openai: "chatgpt-openai";
  claude: "claude-anthropic";
}>;
export type SubmissionProviderIdentity =
  (typeof SUBMISSION_PROVIDER_IDENTITIES)[keyof typeof SUBMISSION_PROVIDER_IDENTITIES];
export function validateDistributionDocuments(release: unknown, providers: unknown): void;
