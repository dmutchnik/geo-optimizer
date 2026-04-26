(function () {
  const STOP_WORDS = new Set([
    "a",
    "an",
    "and",
    "are",
    "as",
    "at",
    "be",
    "by",
    "for",
    "from",
    "how",
    "in",
    "is",
    "it",
    "of",
    "on",
    "or",
    "that",
    "the",
    "this",
    "to",
    "was",
    "what",
    "when",
    "where",
    "who",
    "will",
    "with"
  ]);

  const samplePage = {
    keyword: "sustainable running shoes",
    mode: "html",
    content: '<!DOCTYPE html><html lang="en"><head><title>Fast shoes for everyday runners</title><meta name="description" content="Shop lightweight shoes for training and race day with comfort and speed." /></head><body><h1>Fast shoes for everyday runners</h1><p>Our running shoes help athletes move quickly and stay comfortable. The shoes are light, modern, and built for training days. Customers can compare materials, sizes, and support features.</p><h2>Why runners choose them</h2><p>Foam cushioning reduces fatigue while the upper remains breathable. The product line works for daily mileage and occasional races, but the page does not clearly explain sustainability details.</p><a href="/shop">Shop now</a></body></html>'
  };

  function normalizeWhitespace(value) {
    return (value || "").replace(/\s+/g, " ").trim();
  }

  function splitWords(text) {
    return normalizeWhitespace((text || "").toLowerCase())
      .split(/[^a-z0-9]+/i)
      .filter(Boolean);
  }

  function splitSentences(text) {
    return normalizeWhitespace(text)
      .split(/[.!?]+(?:\s+|$)/)
      .map(function (sentence) {
        return sentence.trim();
      })
      .filter(Boolean);
  }

  function sentenceCount(text) {
    return Math.max(splitSentences(text).length, 1);
  }

  function estimateSyllables(word) {
    const cleaned = (word || "").toLowerCase().replace(/[^a-z]/g, "");
    if (!cleaned) {
      return 1;
    }

    if (cleaned.length <= 3) {
      return 1;
    }

    const vowelGroups = cleaned.match(/[aeiouy]{1,2}/g);
    let count = vowelGroups ? vowelGroups.length : 1;

    if (cleaned.endsWith("e")) {
      count -= 1;
    }

    return Math.max(count, 1);
  }

  function fleschReadingEase(text) {
    const words = splitWords(text);
    if (!words.length) {
      return 0;
    }

    const syllableCount = words.reduce(function (total, word) {
      return total + estimateSyllables(word);
    }, 0);

    const score =
      206.835 -
      1.015 * (words.length / sentenceCount(text)) -
      84.6 * (syllableCount / words.length);

    return Math.max(0, Math.min(100, Math.round(score)));
  }

  function getKeywordStats(text, keyword) {
    const words = splitWords(text);
    const keywordWords = splitWords(keyword);

    if (!words.length || !keywordWords.length) {
      return {
        keyword: normalizeWhitespace(keyword),
        occurrences: 0,
        density: 0,
        presentInTitle: false,
        presentInDescription: false,
        presentInHeadings: false
      };
    }

    const joinedText = words.join(" ");
    const target = keywordWords.join(" ");
    const occurrences = joinedText.split(target).length - 1;

    return {
      keyword: normalizeWhitespace(keyword),
      occurrences: occurrences,
      density: Number(((occurrences / words.length) * 100).toFixed(2))
    };
  }

  function summarizeScore(score) {
    if (score >= 85) {
      return "Strong GEO alignment with only minor improvements needed.";
    }

    if (score >= 70) {
      return "Good foundation, but a few structural or wording improvements would help.";
    }

    if (score >= 50) {
      return "Moderate GEO quality. The page needs stronger structure and keyword targeting.";
    }

    return "Weak GEO readiness. Core on-page elements need substantial optimization.";
  }

  function extractTopTerms(text, limit) {
    const frequency = new Map();
    splitWords(text).forEach(function (word) {
      if (word.length < 3 || STOP_WORDS.has(word)) {
        return;
      }
      frequency.set(word, (frequency.get(word) || 0) + 1);
    });

    return Array.from(frequency.entries())
      .sort(function (a, b) {
        return b[1] - a[1];
      })
      .slice(0, limit || 6)
      .map(function (entry) {
        return entry[0];
      });
  }

  function analyzePage(page, keyword) {
    const title = normalizeWhitespace(page.title);
    const metaDescription = normalizeWhitespace(page.metaDescription);
    const headings = (page.headings || []).map(function (heading) {
      return {
        level: heading.level,
        text: normalizeWhitespace(heading.text)
      };
    });
    const bodyText = normalizeWhitespace(page.bodyText);
    const links = page.links || [];
    const fullText = [title, metaDescription, headings.map(function (item) {
      return item.text;
    }).join(" "), bodyText]
      .filter(Boolean)
      .join(" ");

    const keywordStats = getKeywordStats(fullText, keyword);
    keywordStats.presentInTitle = !!(
      keywordStats.keyword && title.toLowerCase().indexOf(keywordStats.keyword.toLowerCase()) !== -1
    );
    keywordStats.presentInDescription = !!(
      keywordStats.keyword &&
      metaDescription.toLowerCase().indexOf(keywordStats.keyword.toLowerCase()) !== -1
    );
    keywordStats.presentInHeadings = !!(
      keywordStats.keyword &&
      headings.some(function (heading) {
        return heading.text.toLowerCase().indexOf(keywordStats.keyword.toLowerCase()) !== -1;
      })
    );

    const readability = fleschReadingEase(bodyText);
    const wordCount = splitWords(bodyText).length;
    const h1Count = headings.filter(function (heading) {
      return heading.level === "h1";
    }).length;
    const headingLevels = headings.map(function (heading) {
      return Number(String(heading.level).slice(1));
    });

    const hasHeadingHierarchy = headingLevels.every(function (level, index) {
      if (index === 0) {
        return true;
      }
      return level - headingLevels[index - 1] <= 1;
    });

    let score = 0;
    const suggestions = [];
    const criteria = [];

    if (title.length >= 20 && title.length <= 65) {
      score += 15;
      criteria.push("Title length is within the recommended range.");
    } else {
      suggestions.push("Adjust the title to roughly 20-65 characters.");
    }

    if (metaDescription.length >= 120 && metaDescription.length <= 160) {
      score += 15;
      criteria.push("Meta description length supports preview snippets.");
    } else {
      suggestions.push("Add a meta description near 120-160 characters.");
    }

    if (h1Count === 1) {
      score += 10;
      criteria.push("Page includes a single H1 heading.");
    } else {
      suggestions.push("Use exactly one H1 heading for the main topic.");
    }

    if (headings.length >= 3 && hasHeadingHierarchy) {
      score += 10;
      criteria.push("Heading structure is multi-level and ordered.");
    } else {
      suggestions.push("Expand the heading structure with ordered H2 and H3 sections.");
    }

    if (wordCount >= 250) {
      score += 15;
      criteria.push("Body copy has enough depth for search and answer engines.");
    } else {
      suggestions.push("Increase body depth to at least 250 words with helpful specifics.");
    }

    if (readability >= 45 && readability <= 80) {
      score += 10;
      criteria.push("Readability is balanced for broad audiences.");
    } else if (readability > 80) {
      score += 8;
      suggestions.push("The copy is very simple. Add a bit more specificity and supporting detail.");
    } else {
      suggestions.push("Shorten sentences and simplify phrasing to improve readability.");
    }

    if (keywordStats.keyword) {
      const keywordPlacementScore =
        Number(keywordStats.presentInTitle) +
        Number(keywordStats.presentInDescription) +
        Number(keywordStats.presentInHeadings);

      score += keywordPlacementScore * 4;

      if (keywordStats.density >= 0.7 && keywordStats.density <= 2.5) {
        score += 8;
        criteria.push("Keyword density is strong without obvious stuffing.");
      } else {
        suggestions.push("Aim for roughly 0.7%-2.5% keyword density in natural language.");
      }

      if (!keywordStats.presentInTitle) {
        suggestions.push("Include the primary keyword in the title.");
      }

      if (!keywordStats.presentInDescription) {
        suggestions.push("Include the primary keyword in the meta description.");
      }

      if (!keywordStats.presentInHeadings) {
        suggestions.push("Use the primary keyword in at least one heading.");
      }
    } else {
      suggestions.push("Set a primary keyword to evaluate placement and density.");
    }

    if (links.length >= 2) {
      score += 9;
      criteria.push("Links add crawlable context and navigation signals.");
    } else {
      suggestions.push("Include at least two contextual links to supporting resources or pages.");
    }

    const roundedScore = Math.min(Math.round(score), 100);

    return {
      page: page,
      score: roundedScore,
      summary: summarizeScore(roundedScore),
      readability: readability,
      wordCount: wordCount,
      keywordStats: keywordStats,
      criteria: criteria,
      suggestions: Array.from(new Set(suggestions)),
      topTerms: extractTopTerms(fullText),
      detectedElements: [
        "Title: " + (title || "missing"),
        "Meta description: " + (metaDescription || "missing"),
        "Headings: " + headings.length,
        "Links: " + links.length,
        "Word count: " + wordCount,
        "Readability: " + readability
      ]
    };
  }

  function toTitleCase(value) {
    return (value || "")
      .split(/\s+/)
      .filter(Boolean)
      .map(function (word) {
        return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
      })
      .join(" ");
  }

  function buildMetaDescription(keyword, bodyText) {
    const base = keyword
      ? "Learn how " + keyword + " delivers practical value, key benefits, and clear next steps for readers."
      : "Learn the core benefits, structure, and next steps from this optimized webpage content.";

    const support = splitSentences(bodyText).slice(0, 1).join(" ");
    const draft = normalizeWhitespace(base + " " + support);
    return draft.length <= 160 ? draft : draft.slice(0, 157).trim() + "...";
  }

  function clipText(text, maxLength) {
    const clean = normalizeWhitespace(text);
    if (clean.length <= maxLength) {
      return clean;
    }

    return clean.slice(0, maxLength - 3).trim() + "...";
  }

  function ensureSentence(text) {
    const clean = normalizeWhitespace(text);
    if (!clean) {
      return "";
    }

    return /[.!?]$/.test(clean) ? clean : clean + ".";
  }

  function rewriteTitlePreservingIntent(originalTitle, keyword) {
    const cleanTitle = normalizeWhitespace(originalTitle);
    const cleanKeyword = normalizeWhitespace(keyword);

    if (!cleanKeyword) {
      return clipText(cleanTitle || "Optimized Page", 65);
    }

    if (cleanTitle && cleanTitle.toLowerCase().indexOf(cleanKeyword.toLowerCase()) !== -1) {
      return clipText(cleanTitle, 65);
    }

    if (!cleanTitle) {
      return clipText(toTitleCase(cleanKeyword) + " | Optimized Page", 65);
    }

    if (cleanTitle.length <= 42) {
      return clipText(cleanTitle + " | " + toTitleCase(cleanKeyword), 65);
    }

    return clipText(toTitleCase(cleanKeyword) + " | " + cleanTitle, 65);
  }

  function rewriteHeadingPreservingIntent(originalText, keyword, level, index) {
    const cleanText = normalizeWhitespace(originalText);
    const cleanKeyword = normalizeWhitespace(keyword);

    if (!cleanText || !cleanKeyword) {
      return cleanText || "";
    }

    if (cleanText.toLowerCase().indexOf(cleanKeyword.toLowerCase()) !== -1) {
      return cleanText;
    }

    if (level === "h1") {
      return clipText(cleanText + " | " + toTitleCase(cleanKeyword), 72);
    }

    if (level === "h2" && index === 0 && splitWords(cleanText).length <= 8) {
      return clipText(cleanText + ": " + toTitleCase(cleanKeyword), 78);
    }

    return cleanText;
  }

  function improveParagraphText(originalText, keyword, supportTerm, index) {
    let updated = ensureSentence(originalText);
    const cleanKeyword = normalizeWhitespace(keyword);
    const cleanSupportTerm = normalizeWhitespace(supportTerm);

    if (!updated) {
      return "";
    }

    if (
      cleanKeyword &&
      updated.toLowerCase().indexOf(cleanKeyword.toLowerCase()) === -1 &&
      splitWords(updated).length < 70
    ) {
      updated +=
        index === 0
          ? " " + ensureSentence("This section makes " + cleanKeyword + " easier to understand and evaluate")
          : " " + ensureSentence("It gives readers clearer context around " + cleanKeyword);
    }

    if (
      cleanSupportTerm &&
      updated.toLowerCase().indexOf(cleanSupportTerm.toLowerCase()) === -1 &&
      splitWords(updated).length < 90
    ) {
      updated += " " + ensureSentence("It also highlights " + cleanSupportTerm + " to add useful detail");
    }

    return normalizeWhitespace(updated);
  }

  function improveLinkText(originalText, keyword, href) {
    const cleanText = normalizeWhitespace(originalText);
    const cleanKeyword = normalizeWhitespace(keyword);
    const genericLabels = ["learn more", "click here", "read more", "more", "details"];

    if (!cleanKeyword || !cleanText) {
      return cleanText || href || "Link";
    }

    if (genericLabels.indexOf(cleanText.toLowerCase()) !== -1) {
      return clipText("Learn more about " + cleanKeyword, 42);
    }

    return cleanText;
  }

  function ensureMetaDescription(doc) {
    let metaDescription = doc.querySelector('meta[name="description"]');
    if (!metaDescription) {
      metaDescription = doc.createElement("meta");
      metaDescription.setAttribute("name", "description");
      doc.head.appendChild(metaDescription);
    }
    return metaDescription;
  }

  function serializeDocument(doc) {
    const doctype = doc.doctype ? "<!DOCTYPE " + doc.doctype.name + ">\n" : "<!DOCTYPE html>\n";
    return doctype + doc.documentElement.outerHTML;
  }

  function optimizeHtmlPreservingStructure(rawHtml, keyword) {
    if (typeof DOMParser === "undefined") {
      return "";
    }

    const parser = new DOMParser();
    const doc = parser.parseFromString(rawHtml, "text/html");
    const parsedOriginal = parseHtmlInput(rawHtml);
    const cleanKeyword =
      normalizeWhitespace(keyword) ||
      extractTopTerms(parsedOriginal.bodyText, 1)[0] ||
      "digital strategy";
    const supportTerms = extractTopTerms(parsedOriginal.bodyText, 5).filter(function (term) {
      return term !== cleanKeyword;
    });
    const optimizedPage = optimizePage(parsedOriginal, cleanKeyword).optimizedPage;
    const titleNode = doc.querySelector("title") || doc.head.appendChild(doc.createElement("title"));
    const metaDescription = ensureMetaDescription(doc);
    const headingNodes = Array.from(doc.querySelectorAll("h1, h2, h3"));
    const paragraphNodes = Array.from(doc.querySelectorAll("p"));
    const listItemNodes = Array.from(doc.querySelectorAll("li"));
    const linkNodes = Array.from(doc.querySelectorAll("a[href]"));
    const body = doc.body || doc.documentElement;

    titleNode.textContent = rewriteTitlePreservingIntent(parsedOriginal.title || optimizedPage.title, cleanKeyword);
    metaDescription.setAttribute(
      "content",
      buildMetaDescription(cleanKeyword, parsedOriginal.bodyText || optimizedPage.bodyText)
    );

    headingNodes.forEach(function (node, index) {
      const level = String(node.tagName || "").toLowerCase();
      node.textContent = rewriteHeadingPreservingIntent(node.textContent, cleanKeyword, level, index);
    });

    if (!headingNodes.length && body) {
      const heading = doc.createElement("h1");
      heading.textContent = optimizedPage.headings[0] ? optimizedPage.headings[0].text : toTitleCase(cleanKeyword);
      body.insertBefore(heading, body.firstChild);
    }

    if (paragraphNodes.length) {
      paragraphNodes.forEach(function (node, index) {
        node.textContent = improveParagraphText(
          node.textContent,
          cleanKeyword,
          supportTerms[index % Math.max(supportTerms.length, 1)] || "",
          index
        );
      });
    } else if (body && normalizeWhitespace(parsedOriginal.bodyText)) {
      const paragraph = doc.createElement("p");
      paragraph.textContent = improveParagraphText(parsedOriginal.bodyText, cleanKeyword, supportTerms[0] || "", 0);
      body.appendChild(paragraph);
    }

    listItemNodes.forEach(function (node, index) {
      const currentText = normalizeWhitespace(node.textContent);
      if (!currentText || splitWords(currentText).length > 14) {
        return;
      }

      node.textContent = improveParagraphText(
        currentText,
        cleanKeyword,
        supportTerms[index % Math.max(supportTerms.length, 1)] || "",
        index + 1
      );
    });

    linkNodes.forEach(function (node) {
      const href = node.getAttribute("href") || "";
      node.textContent = improveLinkText(node.textContent, cleanKeyword, href);
      if (!node.getAttribute("title") && cleanKeyword) {
        node.setAttribute("title", "More about " + cleanKeyword);
      }
    });

    return sanitizeHtmlForPreview(serializeDocument(doc));
  }

  function optimizePage(page, keyword) {
    const normalizedKeyword =
      normalizeWhitespace(keyword) ||
      extractTopTerms(page.bodyText, 1)[0] ||
      "digital strategy";
    const seedTerms = extractTopTerms(page.bodyText).slice(0, 3);
    const h1Heading = (page.headings || []).find(function (heading) {
      return heading.level === "h1";
    });

    const title = page.title
      ? (toTitleCase(normalizedKeyword) + " Guide | " + page.title).slice(0, 65)
      : (toTitleCase(normalizedKeyword) + " Guide for Better GEO Visibility").slice(0, 65);

    const intro = splitSentences(page.bodyText).slice(0, 2).join(". ");
    const insights = seedTerms.length
      ? "Focus areas include " + seedTerms.join(", ") + "."
      : "Focus areas include clarity, structure, and discoverability.";

    const optimizedBody = [
      intro || ("This page explains " + normalizedKeyword + " with clearer structure and stronger discoverability signals."),
      "Readers should quickly understand why " + normalizedKeyword + " matters, what action to take, and which details support the main claim.",
      insights,
      "Use concise paragraphs, explicit headings, and relevant links so both users and answer engines can identify the main topic.",
      "Close with a concrete call to action that reinforces value and encourages the next click or conversion."
    ]
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();

    const links =
      page.links && page.links.length >= 2
        ? page.links
        : (page.links || []).concat([
            { text: "Related guide", href: "/related-guide" },
            { text: "Contact sales", href: "/contact" }
          ]).slice(0, 2);

    const optimizedPage = {
      title: title,
      metaDescription: buildMetaDescription(normalizedKeyword, optimizedBody),
      headings: [
        { level: "h1", text: h1Heading ? h1Heading.text : toTitleCase(normalizedKeyword) + " for Better Visibility" },
        { level: "h2", text: "Why " + toTitleCase(normalizedKeyword) + " Matters" },
        { level: "h2", text: "How to Improve " + toTitleCase(normalizedKeyword) },
        { level: "h3", text: "Key Signals to Strengthen" }
      ],
      bodyText: optimizedBody,
      links: links
    };

    return {
      optimizedPage: optimizedPage,
      analysis: analyzePage(optimizedPage, normalizedKeyword)
    };
  }

  function formatPage(page) {
    const lines = [
      "Title: " + (page.title || "N/A"),
      "Meta Description: " + (page.metaDescription || "N/A"),
      "",
      "Headings:"
    ];

    (page.headings || []).forEach(function (heading) {
      lines.push("- " + String(heading.level).toUpperCase() + ": " + heading.text);
    });

    lines.push("", "Body:", page.bodyText || "N/A", "", "Links:");

    (page.links || []).forEach(function (link) {
      lines.push("- " + (link.text || "Untitled") + " -> " + (link.href || "#"));
    });

    return lines.join("\n");
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function sanitizeHtmlForPreview(html) {
    return String(html || "")
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(/<iframe[\s\S]*?<\/iframe>/gi, "")
      .replace(/<object[\s\S]*?<\/object>/gi, "")
      .replace(/<embed[\s\S]*?>/gi, "")
      .replace(/\son[a-z]+=(["'])[\s\S]*?\1/gi, "");
  }

  function paragraphize(text) {
    const parts = normalizeWhitespace(text)
      .split(/(?<=[.!?])\s+/)
      .map(function (part) {
        return part.trim();
      })
      .filter(Boolean);

    return parts.length ? parts : [normalizeWhitespace(text)];
  }

  function buildPreviewDocument(page) {
    const headings = (page.headings || [])
      .map(function (heading) {
        return "<" + heading.level + ">" + escapeHtml(heading.text) + "</" + heading.level + ">";
      })
      .join("");

    const paragraphs = paragraphize(page.bodyText)
      .map(function (paragraph) {
        return "<p>" + escapeHtml(paragraph) + "</p>";
      })
      .join("");

    const links = (page.links || [])
      .map(function (link) {
        return '<a href="' + escapeHtml(link.href || "#") + '">' + escapeHtml(link.text || "Link") + "</a>";
      })
      .join("");

    return [
      "<!DOCTYPE html>",
      '<html lang="en">',
      "<head>",
      '<meta charset="UTF-8">',
      '<meta name="viewport" content="width=device-width, initial-scale=1.0">',
      "<title>" + escapeHtml(page.title || "Preview") + "</title>",
      '<meta name="description" content="' + escapeHtml(page.metaDescription || "") + '">',
      "<style>",
      "body{margin:0;font-family:Georgia,serif;background:#faf7f1;color:#2d2114;line-height:1.6;}",
      "main{max-width:760px;margin:0 auto;padding:32px 20px 48px;}",
      ".meta{font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:#8a6a46;}",
      "h1,h2,h3{line-height:1.15;margin:0 0 14px;}",
      "h1{font-size:2rem;margin-top:10px;}",
      "h2{font-size:1.3rem;margin-top:28px;}",
      "h3{font-size:1.05rem;margin-top:20px;}",
      "p{margin:0 0 14px;}",
      ".link-row{display:flex;flex-wrap:wrap;gap:12px;margin-top:24px;}",
      "a{color:#0e4e3b;text-decoration:none;padding:10px 14px;border:1px solid rgba(14,78,59,.18);border-radius:999px;background:#fff;}",
      "</style>",
      "</head>",
      "<body>",
      "<main>",
      '<div class="meta">Preview</div>',
      headings,
      paragraphs,
      links ? '<div class="link-row">' + links + "</div>" : "",
      "</main>",
      "</body>",
      "</html>"
    ].join("");
  }

  function stripTags(html) {
    return normalizeWhitespace(
      (html || "")
        .replace(/<script[\s\S]*?<\/script>/gi, " ")
        .replace(/<style[\s\S]*?<\/style>/gi, " ")
        .replace(/<[^>]+>/g, " ")
    );
  }

  function matchAllValues(source, regex, mapper) {
    return Array.from((source || "").matchAll(regex))
      .map(mapper)
      .filter(Boolean);
  }

  function parseTextInput(rawText) {
    const cleaned = normalizeWhitespace(rawText);
    const sentences = splitSentences(cleaned);
    const title = sentences[0] ? sentences[0].slice(0, 60) : "Untitled Page";

    return {
      title: title,
      metaDescription: sentences.slice(0, 2).join(". ").slice(0, 160),
      headings: [
        { level: "h1", text: title },
        { level: "h2", text: "Overview" },
        { level: "h2", text: "Details" }
      ],
      bodyText: cleaned,
      links: []
    };
  }

  function parseHtmlInput(rawHtml) {
    try {
      if (typeof DOMParser !== "undefined") {
        const parser = new DOMParser();
        const doc = parser.parseFromString(rawHtml, "text/html");
        const headingNodes = doc.querySelectorAll("h1, h2, h3");
        const linkNodes = doc.querySelectorAll("a[href]");
        const titleNode = doc.querySelector("title");
        const descriptionNode = doc.querySelector('meta[name="description"]');

        return {
          title: normalizeWhitespace(titleNode ? titleNode.textContent : ""),
          metaDescription: normalizeWhitespace(
            descriptionNode ? descriptionNode.getAttribute("content") : ""
          ),
          headings: Array.from(headingNodes)
            .map(function (node) {
              return {
                level: node.tagName.toLowerCase(),
                text: normalizeWhitespace(node.textContent || "")
              };
            })
            .filter(function (heading) {
              return heading.text;
            }),
          bodyText: normalizeWhitespace((doc.body || {}).textContent || ""),
          links: Array.from(linkNodes)
            .map(function (node) {
              return {
                text: normalizeWhitespace(node.textContent || "Link"),
                href: node.getAttribute("href") || ""
              };
            })
            .filter(function (link) {
              return link.href;
            })
        };
      }
    } catch (error) {
      console.error("DOMParser path failed, falling back to regex parser.", error);
    }

    return {
      title: normalizeWhitespace(((rawHtml || "").match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1] || ""),
      metaDescription: normalizeWhitespace(
        (((rawHtml || "").match(/<meta[^>]+name=["']description["'][^>]+content=["']([\s\S]*?)["'][^>]*>/i) || [])[1]) || ""
      ),
      headings: matchAllValues(rawHtml, /<(h[1-3])[^>]*>([\s\S]*?)<\/\1>/gi, function (match) {
        return {
          level: String(match[1]).toLowerCase(),
          text: stripTags(match[2])
        };
      }),
      bodyText: stripTags(rawHtml),
      links: matchAllValues(rawHtml, /<a[^>]+href=["']([\s\S]*?)["'][^>]*>([\s\S]*?)<\/a>/gi, function (match) {
        return {
          href: normalizeWhitespace(match[1]),
          text: stripTags(match[2]) || "Link"
        };
      })
    };
  }

  function parseContent(rawContent, mode) {
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

  function extractHtmlEditableContent(rawHtml) {
    if (typeof DOMParser === "undefined") {
      return {};
    }

    const parser = new DOMParser();
    const doc = parser.parseFromString(rawHtml, "text/html");

    return {
      title: normalizeWhitespace(doc.querySelector("title") ? doc.querySelector("title").textContent : ""),
      metaDescription: normalizeWhitespace(
        doc.querySelector('meta[name="description"]')
          ? doc.querySelector('meta[name="description"]').getAttribute("content")
          : ""
      ),
      headings: Array.from(doc.querySelectorAll("h1, h2, h3")).map(function (node, index) {
        return {
          index: index,
          level: node.tagName.toLowerCase(),
          text: normalizeWhitespace(node.textContent || "")
        };
      }),
      paragraphs: Array.from(doc.querySelectorAll("p")).slice(0, 18).map(function (node, index) {
        return {
          index: index,
          text: normalizeWhitespace(node.textContent || "")
        };
      }),
      listItems: Array.from(doc.querySelectorAll("li")).slice(0, 24).map(function (node, index) {
        return {
          index: index,
          text: normalizeWhitespace(node.textContent || "")
        };
      }),
      links: Array.from(doc.querySelectorAll("a[href]")).slice(0, 20).map(function (node, index) {
        return {
          index: index,
          href: node.getAttribute("href") || "",
          text: normalizeWhitespace(node.textContent || "Link")
        };
      })
    };
  }

  function applyLlmEditsToHtml(rawHtml, edits) {
    if (typeof DOMParser === "undefined") {
      return sanitizeHtmlForPreview(rawHtml);
    }

    const parser = new DOMParser();
    const doc = parser.parseFromString(rawHtml, "text/html");
    const titleNode = doc.querySelector("title") || doc.head.appendChild(doc.createElement("title"));
    const descriptionNode = doc.querySelector('meta[name="description"]') || (function () {
      const meta = doc.createElement("meta");
      meta.setAttribute("name", "description");
      doc.head.appendChild(meta);
      return meta;
    })();

    if (edits && edits.title) {
      titleNode.textContent = normalizeWhitespace(edits.title);
    }

    if (edits && edits.metaDescription) {
      descriptionNode.setAttribute("content", normalizeWhitespace(edits.metaDescription));
    }

    applyIndexedTextEdits(doc.querySelectorAll("h1, h2, h3"), edits && edits.headings);
    applyIndexedTextEdits(doc.querySelectorAll("p"), edits && edits.paragraphs);
    applyIndexedTextEdits(doc.querySelectorAll("li"), edits && edits.listItems);
    applyLinkEdits(doc.querySelectorAll("a[href]"), edits && edits.links);

    return sanitizeHtmlForPreview(serializeDocument(doc));
  }

  function applyIndexedTextEdits(nodeList, edits) {
    if (!Array.isArray(edits) || !edits.length) {
      return;
    }

    const nodes = Array.from(nodeList);
    edits.forEach(function (edit) {
      if (!edit || typeof edit.index !== "number" || !nodes[edit.index] || !edit.text) {
        return;
      }

      nodes[edit.index].textContent = normalizeWhitespace(edit.text);
    });
  }

  function applyLinkEdits(nodeList, edits) {
    if (!Array.isArray(edits) || !edits.length) {
      return;
    }

    const nodes = Array.from(nodeList);
    edits.forEach(function (edit) {
      if (!edit || typeof edit.index !== "number" || !nodes[edit.index]) {
        return;
      }

      if (edit.text) {
        nodes[edit.index].textContent = normalizeWhitespace(edit.text);
      }

      if (edit.title) {
        nodes[edit.index].setAttribute("title", normalizeWhitespace(edit.title));
      }
    });
  }

  async function requestLlmOptimization(payload) {
    const response = await fetch("/api/optimize", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json().catch(function () {
      return {};
    });

    if (!response.ok) {
      throw new Error(data.error || "Optimization request failed.");
    }

    return data;
  }

  function renderList(node, items) {
    node.innerHTML = "";
    items.forEach(function (item) {
      const li = document.createElement("li");
      li.textContent = item;
      node.appendChild(li);
    });
  }

  function init() {
    const fileInput = document.querySelector("#fileInput");
    const contentInput = document.querySelector("#contentInput");
    const analyzeButton = document.querySelector("#analyzeButton");
    const sampleButton = document.querySelector("#sampleButton");
    const clearButton = document.querySelector("#clearButton");
    const statusMessage = document.querySelector("#statusMessage");
    const emptyState = document.querySelector("#emptyState");
    const resultsContent = document.querySelector("#resultsContent");
    const originalScore = document.querySelector("#originalScore");
    const originalScoreSummary = document.querySelector("#originalScoreSummary");
    const optimizedScore = document.querySelector("#optimizedScore");
    const optimizedScoreSummary = document.querySelector("#optimizedScoreSummary");
    const scoreBreakdown = document.querySelector("#scoreBreakdown");
    const originalPreview = document.querySelector("#originalPreview");
    const optimizedPreview = document.querySelector("#optimizedPreview");
    const detectedElements = document.querySelector("#detectedElements");
    const recommendations = document.querySelector("#recommendations");
    const originalContent = document.querySelector("#originalContent");
    const optimizedContent = document.querySelector("#optimizedContent");

    function buildScoreBreakdown(originalEvaluation, optimizedEvaluation) {
      if (
        !originalEvaluation ||
        !optimizedEvaluation ||
        !Array.isArray(originalEvaluation.breakdown) ||
        !Array.isArray(optimizedEvaluation.breakdown)
      ) {
        return [];
      }

      const optimizedMap = new Map();
      optimizedEvaluation.breakdown.forEach(function (item) {
        optimizedMap.set(item.category, item);
      });

      return originalEvaluation.breakdown.map(function (item) {
        const optimizedItem = optimizedMap.get(item.category);
        return (
          {
            category: item.category,
            beforeScore: item.score,
            afterScore: optimizedItem ? optimizedItem.score : null,
            maxPoints: item.maxPoints,
            beforeRationale: item.rationale || "",
            afterRationale: optimizedItem ? optimizedItem.rationale || "" : ""
          }
        );
      });
    }

    function renderScoreBreakdown(node, items) {
      node.innerHTML = "";

      if (!Array.isArray(items) || !items.length) {
        const li = document.createElement("li");
        li.className = "breakdown-empty";
        li.textContent = "DeepSeek did not return a usable score breakdown for this run.";
        node.appendChild(li);
        return;
      }

      items.forEach(function (item) {
        const delta =
          typeof item.beforeScore === "number" && typeof item.afterScore === "number"
            ? item.afterScore - item.beforeScore
            : null;
        const li = document.createElement("li");
        li.className = "breakdown-card";

        const beforePercent =
          typeof item.beforeScore === "number" && typeof item.maxPoints === "number"
            ? Math.max(0, Math.min(100, (item.beforeScore / item.maxPoints) * 100))
            : 0;
        const afterPercent =
          typeof item.afterScore === "number" && typeof item.maxPoints === "number"
            ? Math.max(0, Math.min(100, (item.afterScore / item.maxPoints) * 100))
            : 0;

        li.innerHTML =
          '<div class="breakdown-card-top">' +
          '<div class="breakdown-card-title">' + escapeHtml(item.category) + "</div>" +
          '<div class="breakdown-delta ' + getDeltaClass(delta) + '">' + formatDelta(delta) + "</div>" +
          "</div>" +
          '<div class="breakdown-score-row">' +
          '<div class="breakdown-score-pill"><span>Before</span><strong>' + escapeHtml(formatScore(item.beforeScore, item.maxPoints)) + "</strong></div>" +
          '<div class="breakdown-score-pill breakdown-score-pill-accent"><span>After</span><strong>' + escapeHtml(formatScore(item.afterScore, item.maxPoints)) + "</strong></div>" +
          "</div>" +
          '<div class="breakdown-bar-stack">' +
          '<div class="breakdown-bar-label"><span>Before</span><span>' + Math.round(beforePercent) + '%</span></div>' +
          '<div class="breakdown-bar"><span class="breakdown-bar-fill breakdown-bar-fill-before" style="width:' + beforePercent + '%"></span></div>' +
          '<div class="breakdown-bar-label"><span>After</span><span>' + Math.round(afterPercent) + '%</span></div>' +
          '<div class="breakdown-bar"><span class="breakdown-bar-fill breakdown-bar-fill-after" style="width:' + afterPercent + '%"></span></div>' +
          "</div>" +
          '<p class="breakdown-rationale">' + escapeHtml(item.afterRationale || item.beforeRationale || "") + "</p>";

        node.appendChild(li);
      });
    }

    function formatScore(score, maxPoints) {
      if (typeof score !== "number") {
        return "n/a";
      }

      return score + "/" + maxPoints;
    }

    function formatDelta(delta) {
      if (typeof delta !== "number") {
        return "No data";
      }

      if (delta > 0) {
        return "+" + delta;
      }

      if (delta < 0) {
        return String(delta);
      }

      return "0";
    }

    function getDeltaClass(delta) {
      if (typeof delta !== "number") {
        return "delta-neutral";
      }

      if (delta > 0) {
        return "delta-positive";
      }

      if (delta < 0) {
        return "delta-negative";
      }

      return "delta-neutral";
    }

    function setStatus(message, isError) {
      if (!message) {
        statusMessage.textContent = "";
        statusMessage.classList.add("hidden");
        statusMessage.classList.remove("error");
        return;
      }

      statusMessage.textContent = message;
      statusMessage.classList.remove("hidden");
      statusMessage.classList.toggle("error", !!isError);
    }

    async function renderAnalysis() {
      if (window.location.protocol === "file:") {
        setStatus("Run this app through `npm start` and open http://localhost:3000 so the DeepSeek API proxy can work.", true);
        return;
      }

      const content = contentInput.value;
      const mode = "html";
      const keyword = "";
      const parsedPage = parseContent(content, mode);
      const analysis = analyzePage(parsedPage, keyword);

      if (!normalizeWhitespace(content)) {
        setStatus("Paste webpage HTML or choose an HTML file before running optimization.", true);
        return;
      }

      analyzeButton.disabled = true;
      analyzeButton.textContent = "Optimizing...";
      setStatus("Requesting a structure-preserving GEO rewrite from DeepSeek...");

      try {
        const editableContent = mode === "html" ? extractHtmlEditableContent(content) : null;
        const llmResult = await requestLlmOptimization({
          mode: mode,
          page: parsedPage,
          editableContent: editableContent,
          rawContent: content
        });
        const resolvedKeyword = llmResult.resolvedKeyword || analysis.topTerms[0] || "";
        const optimizedHtml =
          mode === "html" ? applyLlmEditsToHtml(content, llmResult.htmlEdits || {}) : "";
        const optimizedPage =
          mode === "html"
            ? parseHtmlInput(optimizedHtml)
            : llmResult.textModePage || optimizePage(parsedPage, resolvedKeyword).optimizedPage;
        const optimizedAnalysis = analyzePage(optimizedPage, resolvedKeyword);

        emptyState.classList.add("hidden");
        resultsContent.classList.remove("hidden");

        const originalLlmEvaluation = llmResult.originalEvaluation || null;
        const optimizedLlmEvaluation = llmResult.optimizedEvaluation || null;

        originalScore.textContent = String(
          originalLlmEvaluation && typeof originalLlmEvaluation.totalScore === "number"
            ? originalLlmEvaluation.totalScore
            : analysis.score
        );
        originalScoreSummary.textContent =
          originalLlmEvaluation && originalLlmEvaluation.summary
            ? originalLlmEvaluation.summary
            : analysis.summary;
        optimizedScore.textContent = String(
          optimizedLlmEvaluation && typeof optimizedLlmEvaluation.totalScore === "number"
            ? optimizedLlmEvaluation.totalScore
            : optimizedAnalysis.score
        );
        optimizedScoreSummary.textContent =
          optimizedLlmEvaluation && optimizedLlmEvaluation.summary
            ? optimizedLlmEvaluation.summary
            : optimizedAnalysis.summary;
        renderScoreBreakdown(
          scoreBreakdown,
          buildScoreBreakdown(originalLlmEvaluation, optimizedLlmEvaluation)
        );
        originalPreview.srcdoc =
          mode === "html"
            ? sanitizeHtmlForPreview(content)
            : buildPreviewDocument(parsedPage);
        optimizedPreview.srcdoc =
          mode === "html" && optimizedHtml
            ? optimizedHtml
            : buildPreviewDocument(optimizedPage);

        renderList(detectedElements, analysis.detectedElements.concat([
          "Detected topic: " + (resolvedKeyword || "not set"),
          "Top terms: " + (analysis.topTerms.join(", ") || "none")
        ]));

        renderList(
          recommendations,
          Array.isArray(llmResult.recommendations) && llmResult.recommendations.length
            ? llmResult.recommendations
            : analysis.suggestions
        );
        originalContent.textContent = mode === "html" ? content : formatPage(parsedPage);
        optimizedContent.textContent =
          mode === "html" && optimizedHtml ? optimizedHtml : formatPage(optimizedPage);
        setStatus("DeepSeek optimization complete.");
      } catch (error) {
        console.error(error);
        setStatus(error.message || "DeepSeek optimization failed.", true);
      } finally {
        analyzeButton.disabled = false;
        analyzeButton.textContent = "Analyze & Optimize";
      }
    }

    function loadSample() {
      contentInput.value = samplePage.content;
      renderAnalysis();
    }

    function clearAll() {
      contentInput.value = "";
      fileInput.value = "";
      emptyState.classList.remove("hidden");
      resultsContent.classList.add("hidden");
      originalPreview.srcdoc = "";
      optimizedPreview.srcdoc = "";
      scoreBreakdown.innerHTML = "";
      setStatus("");
    }

    if (window.location.protocol === "file:") {
      setStatus("Direct file mode can render the UI, but DeepSeek optimization needs the local server. Run `npm start` and use http://localhost:3000.", true);
    }

    analyzeButton.addEventListener("click", renderAnalysis);
    sampleButton.addEventListener("click", loadSample);
    clearButton.addEventListener("click", clearAll);
    fileInput.addEventListener("change", function (event) {
      const file = event.target.files && event.target.files[0];
      if (!file) {
        return;
      }

      file.text().then(function (text) {
        contentInput.value = text;
      });
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
