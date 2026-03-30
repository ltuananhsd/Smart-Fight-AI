function escapeHtml(text: string) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

export function renderMarkdownInner(text: string) {
  if (!text) return "";
  let html = escapeHtml(text);

  html = html.replace(
    /```(\w*)\n([\s\S]*?)```/g,
    (_, lang, code) =>
      `<pre><code class="language-${lang}">${code.trim()}</code></pre>`
  );
  html = html.replace(/`([^`]+)`/g, "<code>$1</code>");
  html = html.replace(/^#### (.+)$/gm, "<h4>$1</h4>");
  html = html.replace(/^### (.+)$/gm, "<h3>$1</h3>");
  html = html.replace(/^## (.+)$/gm, "<h2>$1</h2>");
  html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/\*(.+?)\*/g, "<em>$1</em>");
  html = html.replace(/^- (.+)$/gm, "<li>$1</li>");
  html = html.replace(/(<li>.*<\/li>(\n|$))+/g, (match) => `<ul>${match}</ul>`);

  // Tables
  html = html.replace(/((\|.+\|\n)+)/g, (tableBlock) => {
    const rows = tableBlock.trim().split("\n");
    if (rows.length < 2) return tableBlock;
    let table = "<table>";
    rows.forEach((row, i) => {
      if (row.match(/^\|[\s-:|]+\|$/)) return;
      const cells = row.split("|").filter((c) => c.trim() !== "");
      const tag = i === 0 ? "th" : "td";
      table += "<tr>";
      cells.forEach((cell) => {
        table += `<${tag}>${cell.trim()}</${tag}>`;
      });
      table += "</tr>";
    });
    table += "</table>";
    return table;
  });

  html = html.replace(/\n\n/g, "</p><p>");
  html = html.replace(/\n/g, "<br>");
  html = `<p>${html}</p>`;
  html = html.replace(/<p>\s*<\/p>/g, "");
  html = html.replace(/<p>(<h[1-4]>)/g, "$1");
  html = html.replace(/(<\/h[1-4]>)<\/p>/g, "$1");
  html = html.replace(/<p>(<table>)/g, "$1");
  html = html.replace(/(<\/table>)<\/p>/g, "$1");
  html = html.replace(/<p>(<ul>)/g, "$1");
  html = html.replace(/(<\/ul>)<\/p>/g, "$1");
  html = html.replace(/<p>(<pre>)/g, "$1");
  html = html.replace(/(<\/pre>)<\/p>/g, "$1");
  return html;
}

export function renderMarkdown(text: string) {
  if (!text) return "";

  const uiBoxes: string[] = [];
  let safeText = text.replace(
    /<div class="ui-box[^"]*">([\s\S]*?)<\/div>/g,
    (match) => {
      const placeholder = `__UIBOX_${uiBoxes.length}__`;
      uiBoxes.push(match);
      return placeholder;
    }
  );

  let html = escapeHtml(safeText);

  html = html.replace(
    /```(\w*)\n([\s\S]*?)```/g,
    (_, lang, code) =>
      `<pre><code class="language-${lang}">${code.trim()}</code></pre>`
  );
  html = html.replace(/`([^`]+)`/g, "<code>$1</code>");
  html = html.replace(/^### (.+)$/gm, "<h3>$1</h3>");
  html = html.replace(/^## (.+)$/gm, "<h2>$1</h2>");
  html = html.replace(/^# (.+)$/gm, "<h1>$1</h1>");
  html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/\*(.+?)\*/g, "<em>$1</em>");
  html = html.replace(/^- (.+)$/gm, "<li>$1</li>");
  html = html.replace(/(<li>.*<\/li>(\n|$))+/g, (match) => `<ul>${match}</ul>`);

  html = html.replace(/((\|.+\|\n)+)/g, (tableBlock) => {
    const rows = tableBlock.trim().split("\n");
    if (rows.length < 2) return tableBlock;
    let table = "<table>";
    rows.forEach((row, i) => {
      if (row.match(/^\|[\s-:|]+\|$/)) return;
      const cells = row.split("|").filter((c) => c.trim() !== "");
      const tag = i === 0 ? "th" : "td";
      table += "<tr>";
      cells.forEach((cell) => {
        table += `<${tag}>${cell.trim()}</${tag}>`;
      });
      table += "</tr>";
    });
    table += "</table>";
    return table;
  });

  html = html.replace(/\n\n/g, "</p><p>");
  html = html.replace(/\n/g, "<br>");
  html = `<p>${html}</p>`;

  html = html.replace(/<p>\s*<\/p>/g, "");
  html = html.replace(/<p>(<h[1-3]>)/g, "$1");
  html = html.replace(/(<\/h[1-3]>)<\/p>/g, "$1");
  html = html.replace(/<p>(<table>)/g, "$1");
  html = html.replace(/(<\/table>)<\/p>/g, "$1");
  html = html.replace(/<p>(<ul>)/g, "$1");
  html = html.replace(/(<\/ul>)<\/p>/g, "$1");
  html = html.replace(/<p>(<pre>)/g, "$1");
  html = html.replace(/(<\/pre>)<\/p>/g, "$1");

  uiBoxes.forEach((box, i) => {
    const innerMatch = box.match(/<div class="(ui-box[^"]*)">(([\s\S]*?))<\/div>/);
    if (innerMatch) {
      const className = innerMatch[1];
      const innerText = innerMatch[2];
      const innerHtml = renderMarkdownInner(innerText);
      html = html.replace(`__UIBOX_${i}__`, `<div class="${className}">${innerHtml}</div>`);
    } else {
      html = html.replace(`__UIBOX_${i}__`, box);
    }
  });

  html = html.replace(/<p>(<div class="ui-box)/g, "$1");
  html = html.replace(/(<\/div>)<\/p>/g, "$1");

  return html;
}
