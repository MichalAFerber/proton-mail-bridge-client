// Library entry point: importable service classes, with no side effects on import
// (unlike dist/index.js, which is also the MCP server's self-executing entry point).
// See package.json "exports" — this compiles to dist/lib.js under "./services".

export { SimpleIMAPService, isLikelyAuthenticationError, planFolderSync } from "./services/simple-imap-service.js";
export { SMTPService, sanitizeHeader } from "./services/smtp-service.js";
export * from "./types/index.js";
