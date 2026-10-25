import type { LogLevel } from "./types";

const PREFIX = "[Transcreve.ai]";

let lastLine = "";

function format(tag: string, message: string, extra?: string): string {
  return extra ? `${PREFIX} (${tag}) ${message} ${extra}` : `${PREFIX} (${tag}) ${message}`;
}

function emit(level: LogLevel, line: string): void {
  if (line === lastLine) {
    return;
  }
  lastLine = line;
  if (level === "error") {
    console.error(line);
  } else if (level === "warn") {
    console.warn(line);
  } else {
    console.log(line);
  }
}

export const log = {
  info(tag: string, message: string, extra?: string): void {
    emit("info", format(tag, message, extra));
  },
  warn(tag: string, message: string, extra?: string): void {
    emit("warn", format(tag, message, extra));
  },
  error(tag: string, message: string, extra?: string): void {
    emit("error", format(tag, message, extra));
  },
};

export function logDuration(tag: string, message: string, startedAt: number): void {
  emit("info", format(tag, message, `${Date.now() - startedAt}ms`));
}
