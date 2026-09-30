/**
 * Minimal Server-Sent Events frame parser for fetch() streams.
 *
 * The backend emits frames of the form `data: {json}\n\n` with the event
 * name inside the JSON payload (no `event:` line). This parser follows the
 * SSE spec closely enough to also tolerate CRLF line endings, comments,
 * multi-line data fields and frames split across network chunks.
 */
export class SseParser {
  private buffer = "";

  /** Feed a decoded text chunk; returns the `data` payloads of completed frames. */
  push(chunk: string): string[] {
    this.buffer += chunk;
    const frames: string[] = [];

    // Normalise line endings, then split on blank lines.
    this.buffer = this.buffer.replace(/\r\n?/g, "\n");
    let boundary = this.buffer.indexOf("\n\n");
    while (boundary !== -1) {
      const raw = this.buffer.slice(0, boundary);
      this.buffer = this.buffer.slice(boundary + 2);
      const data = parseFrame(raw);
      if (data !== null) frames.push(data);
      boundary = this.buffer.indexOf("\n\n");
    }
    return frames;
  }

  /** Flush a trailing frame that was not terminated by a blank line. */
  flush(): string[] {
    const rest = this.buffer.trim();
    this.buffer = "";
    if (!rest) return [];
    const data = parseFrame(rest);
    return data === null ? [] : [data];
  }
}

function parseFrame(raw: string): string | null {
  const dataLines: string[] = [];
  for (const line of raw.split("\n")) {
    if (!line || line.startsWith(":")) continue;
    const colon = line.indexOf(":");
    const field = colon === -1 ? line : line.slice(0, colon);
    let value = colon === -1 ? "" : line.slice(colon + 1);
    if (value.startsWith(" ")) value = value.slice(1);
    if (field === "data") dataLines.push(value);
  }
  return dataLines.length ? dataLines.join("\n") : null;
}
