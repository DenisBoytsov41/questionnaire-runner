import type { IncomingMessage, ServerResponse } from "node:http";

const colorEnabled = process.env.LOG_COLOR !== "false";

const colors = {
  reset: "\x1b[0m",
  dim: "\x1b[2m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
  gray: "\x1b[90m",
};

export function logInfo(scope: string, message: string, details?: Record<string, string | number | boolean>): void {
  console.log(formatLine("info", scope, message, details));
}

export function logWarn(scope: string, message: string, details?: Record<string, string | number | boolean>): void {
  console.warn(formatLine("warn", scope, message, details));
}

export function logError(scope: string, message: string, details?: Record<string, string | number | boolean>): void {
  console.error(formatLine("error", scope, message, details));
}

export function attachRequestLogger(req: IncomingMessage, res: ServerResponse): void {
  const startedAt = performance.now();

  res.on("finish", () => {
    const durationMs = Math.round(performance.now() - startedAt);
    const status = res.statusCode;
    const method = req.method ?? "UNKNOWN";
    const url = req.url ?? "/";
    const level = status >= 500 ? "error" : status >= 400 ? "warn" : "info";

    const message = `${method} ${url}`;

    if (level === "error") {
      logError("http", message, { status, duration: `${durationMs}ms` });
      return;
    }

    if (level === "warn") {
      logWarn("http", message, { status, duration: `${durationMs}ms` });
      return;
    }

    logInfo("http", message, { status, duration: `${durationMs}ms` });
  });
}

function formatLine(
  level: "info" | "warn" | "error",
  scope: string,
  message: string,
  details?: Record<string, string | number | boolean>,
): string {
  const timestamp = new Date().toISOString();
  const levelLabel = paint(level.toUpperCase().padEnd(5), levelColor(level));
  const scopeLabel = paint(scope.padEnd(8), colors.cyan);
  const detailsText = details
    ? ` ${paint(formatDetails(details), colors.gray)}`
    : "";

  return `${paint(timestamp, colors.dim)} ${levelLabel} ${scopeLabel} ${message}${detailsText}`;
}

function formatDetails(details: Record<string, string | number | boolean>): string {
  return Object.entries(details)
    .map(([key, value]) => `${key}=${value}`)
    .join(" ");
}

function levelColor(level: "info" | "warn" | "error"): string {
  if (level === "error") {
    return colors.red;
  }

  if (level === "warn") {
    return colors.yellow;
  }

  return colors.green;
}

function paint(value: string, color: string): string {
  if (!colorEnabled) {
    return value;
  }

  return `${color}${value}${colors.reset}`;
}
