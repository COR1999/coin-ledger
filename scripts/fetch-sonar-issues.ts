/**
 * Pulls open SonarCloud issues for this project and prints them as markdown,
 * so they can be pasted into (or redirected to a file for) an agent session
 * instead of clicking through the SonarCloud UI one issue at a time.
 *
 * Usage: node --env-file=.env.local --experimental-strip-types scripts/fetch-sonar-issues.ts [pull-request-number]
 */
const ORGANIZATION = "cor1999";
const PROJECT_KEY = "COR1999_coin-ledger";

interface SonarIssue {
  rule: string;
  severity: string;
  component: string;
  line?: number;
  message: string;
}

interface SonarIssuesResponse {
  total: number;
  issues: SonarIssue[];
}

async function main() {
  const token = process.env.SONAR_TOKEN;
  if (!token) throw new Error("SONAR_TOKEN must be set");

  const pullRequest = process.argv[2];

  const params = new URLSearchParams({
    componentKeys: PROJECT_KEY,
    organization: ORGANIZATION,
    resolved: "false",
    ps: "500",
  });
  if (pullRequest) params.set("pullRequest", pullRequest);

  const res = await fetch(`https://sonarcloud.io/api/issues/search?${params}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    throw new Error(
      `SonarCloud API returned ${res.status}: ${await res.text()}`,
    );
  }

  const { total, issues }: SonarIssuesResponse = await res.json();

  console.log(
    `# SonarCloud issues${pullRequest ? ` — PR #${pullRequest}` : ""} (${total} open)\n`,
  );
  for (const issue of issues) {
    const file = issue.component.replace(`${PROJECT_KEY}:`, "");
    const location = issue.line ? `${file}:${issue.line}` : file;
    console.log(
      `- [${issue.severity}] ${issue.rule} — ${location} — ${issue.message}`,
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
