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

function normalizeWhitespace(value = "") {
  return value.replace(/\s+/g, " ").trim();
}

function splitWords(text = "") {
  return normalizeWhitespace(text.toLowerCase())
    .split(/[^a-z0-9]+/i)
    .filter(Boolean);
}

function sentenceCount(text = "") {
  const sentences = text
    .split(/[.!?]+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
  return Math.max(sentences.length, 1);
}

function estimateSyllables(word) {
  const cleaned = word.toLowerCase().replace(/[^a-z]/g, "");
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

function fleschReadingEase(text = "") {
  const words = splitWords(text);
  if (!words.length) {
    return 0;
  }

  const syllableCount = words.reduce((total, word) => total + estimateSyllables(word), 0);
  const sentences = sentenceCount(text);
  const score =
    206.835 - 1.015 * (words.length / sentences) - 84.6 * (syllableCount / words.length);

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
  const density = Number(((occurrences / words.length) * 100).toFixed(2));

  return {
    keyword: normalizeWhitespace(keyword),
    occurrences,
    density
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

export function extractTopTerms(text, limit = 6) {
  const frequency = new Map();

  for (const word of splitWords(text)) {
    if (word.length < 3 || STOP_WORDS.has(word)) {
      continue;
    }

    frequency.set(word, (frequency.get(word) || 0) + 1);
  }

  return [...frequency.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([word]) => word);
}

export function analyzePage(page, keyword) {
  const title = normalizeWhitespace(page.title);
  const metaDescription = normalizeWhitespace(page.metaDescription);
  const headings = (page.headings || []).map((heading) => ({
    level: heading.level,
    text: normalizeWhitespace(heading.text)
  }));
  const bodyText = normalizeWhitespace(page.bodyText);
  const links = page.links || [];
  const fullText = [title, metaDescription, headings.map((item) => item.text).join(" "), bodyText]
    .filter(Boolean)
    .join(" ");

  const keywordStats = getKeywordStats(fullText, keyword);
  keywordStats.presentInTitle = Boolean(
    keywordStats.keyword && title.toLowerCase().includes(keywordStats.keyword.toLowerCase())
  );
  keywordStats.presentInDescription = Boolean(
    keywordStats.keyword &&
      metaDescription.toLowerCase().includes(keywordStats.keyword.toLowerCase())
  );
  keywordStats.presentInHeadings = Boolean(
    keywordStats.keyword &&
      headings.some((heading) => heading.text.toLowerCase().includes(keywordStats.keyword.toLowerCase()))
  );

  const readability = fleschReadingEase(bodyText);
  const wordCount = splitWords(bodyText).length;
  const h1Count = headings.filter((heading) => heading.level === "h1").length;
  const headingLevels = headings.map((heading) => Number(heading.level.slice(1)));
  const hasHeadingHierarchy = headingLevels.every((level, index) => {
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
    page,
    score: roundedScore,
    summary: summarizeScore(roundedScore),
    readability,
    wordCount,
    keywordStats,
    criteria,
    suggestions: [...new Set(suggestions)],
    topTerms: extractTopTerms(fullText),
    detectedElements: [
      `Title: ${title || "missing"}`,
      `Meta description: ${metaDescription || "missing"}`,
      `Headings: ${headings.length}`,
      `Links: ${links.length}`,
      `Word count: ${wordCount}`,
      `Readability: ${readability}`
    ]
  };
}

function toTitleCase(value = "") {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

function chunkSentences(text) {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

function buildMetaDescription(keyword, bodyText) {
  const base = keyword
    ? `Learn how ${keyword} delivers practical value, key benefits, and clear next steps for readers.`
    : "Learn the core benefits, structure, and next steps from this optimized webpage content.";

  const support = chunkSentences(bodyText).slice(0, 1).join(" ");
  const draft = normalizeWhitespace(`${base} ${support}`);

  return draft.length <= 160 ? draft : `${draft.slice(0, 157).trim()}...`;
}

export function optimizePage(page, keyword) {
  const normalizedKeyword = normalizeWhitespace(keyword) || extractTopTerms(page.bodyText, 1)[0] || "digital strategy";
  const seedTerms = extractTopTerms(page.bodyText).slice(0, 3);
  const h1 = page.headings.find((heading) => heading.level === "h1")?.text;
  const title = page.title
    ? `${toTitleCase(normalizedKeyword)} Guide | ${page.title}`.slice(0, 65)
    : `${toTitleCase(normalizedKeyword)} Guide for Better GEO Visibility`.slice(0, 65);

  const intro = chunkSentences(page.bodyText).slice(0, 2).join(" ");
  const insights = seedTerms.length
    ? `Focus areas include ${seedTerms.join(", ")}.`
    : "Focus areas include clarity, structure, and discoverability.";

  const optimizedBody = [
    intro || `This page explains ${normalizedKeyword} with clearer structure and stronger discoverability signals.`,
    `Readers should quickly understand why ${normalizedKeyword} matters, what action to take, and which details support the main claim.`,
    insights,
    "Use concise paragraphs, explicit headings, and relevant links so both users and answer engines can identify the main topic.",
    "Close with a concrete call to action that reinforces value and encourages the next click or conversion."
  ]
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();

  const optimizedPage = {
    ...page,
    title,
    metaDescription: buildMetaDescription(normalizedKeyword, optimizedBody),
    headings: [
      { level: "h1", text: h1 || `${toTitleCase(normalizedKeyword)} for Better Visibility` },
      { level: "h2", text: `Why ${toTitleCase(normalizedKeyword)} Matters` },
      { level: "h2", text: `How to Improve ${toTitleCase(normalizedKeyword)}` },
      { level: "h3", text: "Key Signals to Strengthen" }
    ],
    bodyText: optimizedBody,
    links:
      page.links.length >= 2
        ? page.links
        : [
            ...page.links,
            { text: "Related guide", href: "/related-guide" },
            { text: "Contact sales", href: "/contact" }
          ].slice(0, 2)
  };

  return {
    optimizedPage,
    analysis: analyzePage(optimizedPage, normalizedKeyword)
  };
}

export function formatPage(page) {
  const lines = [
    `Title: ${page.title || "N/A"}`,
    `Meta Description: ${page.metaDescription || "N/A"}`,
    "",
    "Headings:"
  ];

  for (const heading of page.headings || []) {
    lines.push(`- ${heading.level.toUpperCase()}: ${heading.text}`);
  }

  lines.push("", "Body:", page.bodyText || "N/A", "", "Links:");

  for (const link of page.links || []) {
    lines.push(`- ${link.text || "Untitled"} -> ${link.href || "#"}`);
  }

  return lines.join("\n");
}
