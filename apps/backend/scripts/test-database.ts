// Explicit opt-in only. Never select DATABASE_URL as a fallback, and never
// include connection strings in validation errors. Call before importing Prisma.
export function getTestDatabaseUrl(env: NodeJS.ProcessEnv = process.env): string {
  if (!env.TEST_DATABASE_URL) {
    throw new Error("Set TEST_DATABASE_URL to an isolated, migrated, disposable PostgreSQL database");
  }
  const parse = (value: string): URL => {
    try {
      const url = new URL(value);
      if (!["postgres:", "postgresql:"].includes(url.protocol) || url.pathname.length <= 1) {
        throw new Error();
      }
      return url;
    } catch {
      throw new Error("Test database configuration must be a valid PostgreSQL URL");
    }
  };
  const test = parse(env.TEST_DATABASE_URL);
  if (env.DATABASE_URL) {
    const application = parse(env.DATABASE_URL);
    const identity = (url: URL) => [
      url.searchParams.get("host") ?? url.hostname.replace(/^localhost$/, "127.0.0.1"),
      url.port || "5432",
      decodeURIComponent(url.pathname),
    ].join("|");
    if (identity(test) === identity(application)) {
      throw new Error("TEST_DATABASE_URL must be separate from the application DATABASE_URL");
    }
  }
  return test.toString();
}
