function normalizeWhitespace(value = "") {
  return value.replace(/\s+/g, " ").trim();
}

function stripTags(html = "") {
  return normalizeWhitespace(html.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " "));
}

function matchAllValues(source, regex, mapper) {
  return [...source.matchAll(regex)].map(mapper).filter(Boolean);
}

export function parseTextInput(rawText) {
  const cleaned = normalizeWhitespace(rawText);
  const sentences = cleaned.split(/(?<=[.!?])\s+/).filter(Boolean);
  const title = sentences[0] ? sentences[0].slice(0, 60) : "Untitled Page";

  return {
    title,
    metaDescription: sentences.slice(0, 2).join(" ").slice(0, 160),
    headings: [
      { level: "h1", text: title },
      { level: "h2", text: "Overview" },
      { level: "h2", text: "Details" }
    ],
    bodyText: cleaned,
    links: []
  };
}

export function parseHtmlInput(rawHtml) {
  if (typeof DOMParser !== "undefined") {
    const parser = new DOMParser();
    const doc = parser.parseFromString(rawHtml, "text/html");

    const title = normalizeWhitespace(doc.querySelector("title")?.textContent || "");
    const metaDescription = normalizeWhitespace(
      doc.querySelector('meta[name="description"]')?.getAttribute("content") || ""
    );

    const headings = [...doc.querySelectorAll("h1, h2, h3")]
      .map((node) => ({
        level: node.tagName.toLowerCase(),
        text: normalizeWhitespace(node.textContent || "")
      }))
      .filter((heading) => heading.text);

    const bodyText = normalizeWhitespace(doc.body?.textContent || "");
    const links = [...doc.querySelectorAll("a[href]")]
      .map((node) => ({
        text: normalizeWhitespace(node.textContent || "Link"),
        href: node.getAttribute("href") || ""
      }))
      .filter((link) => link.href);

    return {
      title,
      metaDescription,
      headings,
      bodyText,
      links
    };
  }

  const title = normalizeWhitespace(rawHtml.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || "");
  const metaDescription = normalizeWhitespace(
    rawHtml.match(/<meta[^>]+name=["']description["'][^>]+content=["']([\s\S]*?)["'][^>]*>/i)?.[1] || ""
  );

  const headings = matchAllValues(
    rawHtml,
    /<(h[1-3])[^>]*>([\s\S]*?)<\/\1>/gi,
    ([, level, text]) => ({
      level: level.toLowerCase(),
      text: stripTags(text)
    })
  );

  const links = matchAllValues(
    rawHtml,
    /<a[^>]+href=["']([\s\S]*?)["'][^>]*>([\s\S]*?)<\/a>/gi,
    ([, href, text]) => ({
      href: normalizeWhitespace(href),
      text: stripTags(text) || "Link"
    })
  );

  return {
    title,
    metaDescription,
    headings,
    bodyText: stripTags(rawHtml),
    links
  };
}

export function parseContent(rawContent, mode) {
  if (!normalizeWhitespace(rawContent)) {
    return {
      title: "",
      metaDescription: "",
      headings: [],
      bodyText: "",
      links: []
    };
  }

  return mode === "text" ? parseTextInput(rawContent) : parseHtmlInput(rawContent);
}
