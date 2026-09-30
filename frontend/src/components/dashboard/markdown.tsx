import { Fragment, type ReactNode } from "react";

/**
 * Small, safe Markdown renderer for the backend's report (headings, bold,
 * inline code, links, bullet lists, tables, rules, paragraphs). Everything is
 * rendered as React text — no raw HTML is injected.
 */

function inline(text: string, keyPrefix: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\((https?:\/\/[^)\s]+)\))/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const tok = m[0];
    const key = `${keyPrefix}-${i++}`;
    // Bold may contain inline code, e.g. the backend's "**[Pro] `storage`**".
    if (tok.startsWith("**")) out.push(<strong key={key}>{inline(tok.slice(2, -2), key)}</strong>);
    else if (tok.startsWith("`")) out.push(<code key={key}>{tok.slice(1, -1)}</code>);
    else {
      const label = tok.slice(1, tok.indexOf("]"));
      out.push(
        <a key={key} href={m[2]} target="_blank" rel="noopener noreferrer">
          {label}
        </a>,
      );
    }
    last = m.index + tok.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

const splitRow = (line: string) =>
  line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((c) => c.trim());

export default function Markdown({ source }: { source: string }) {
  const lines = source.replace(/\r\n?/g, "\n").split("\n");
  const blocks: ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();
    const key = `b${i}`;

    if (!trimmed) {
      i++;
      continue;
    }

    const heading = /^(#{1,4})\s+(.*)$/.exec(trimmed);
    if (heading) {
      const level = Math.min(heading[1].length + 1, 5);
      const Tag = `h${level}` as "h2" | "h3" | "h4" | "h5";
      blocks.push(<Tag key={key}>{inline(heading[2], key)}</Tag>);
      i++;
      continue;
    }

    if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
      blocks.push(<hr key={key} />);
      i++;
      continue;
    }

    if (trimmed.startsWith("|") && i + 1 < lines.length && /^\|?\s*:?-{2,}/.test(lines[i + 1].trim())) {
      const header = splitRow(trimmed);
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && lines[i].trim().startsWith("|")) {
        rows.push(splitRow(lines[i]));
        i++;
      }
      blocks.push(
        <div className="table-scroll" key={key}>
          <table className="data-table">
            <thead>
              <tr>
                {header.map((h, j) => (
                  <th key={j} scope="col">
                    {inline(h, `${key}h${j}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, ri) => (
                <tr key={ri}>
                  {header.map((_, j) => (
                    <td key={j} className="cell-wrap">
                      {inline(r[j] ?? "", `${key}r${ri}c${j}`)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      );
      continue;
    }

    if (/^[*-]\s+/.test(trimmed)) {
      const items: string[] = [];
      while (i < lines.length && /^[*-]\s+/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^[*-]\s+/, ""));
        i++;
      }
      blocks.push(
        <ul key={key}>
          {items.map((it, j) => (
            <li key={j}>{inline(it, `${key}l${j}`)}</li>
          ))}
        </ul>,
      );
      continue;
    }

    const para: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() &&
      !/^(#{1,4}\s|[*-]\s|\||-{3,}$)/.test(lines[i].trim())
    ) {
      para.push(lines[i].trim());
      i++;
    }
    if (!para.length) {
      // Unrecognised single line; render as text to guarantee progress.
      para.push(trimmed);
      i++;
    }
    blocks.push(
      <p key={key}>
        {para.map((p, j) => (
          <Fragment key={j}>
            {j > 0 && " "}
            {inline(p, `${key}p${j}`)}
          </Fragment>
        ))}
      </p>,
    );
  }

  return <div className="markdown">{blocks}</div>;
}
