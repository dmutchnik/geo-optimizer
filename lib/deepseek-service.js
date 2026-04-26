export const GEO_RUBRIC = [
  {
    category: "Topic Clarity & Intent Match",
    maxPoints: 20,
    description: "How clearly the page communicates the main topic and satisfies likely user intent."
  },
  {
    category: "Title & Metadata Quality",
    maxPoints: 15,
    description: "How strong the title and meta description are for discoverability and click intent."
  },
  {
    category: "Keyword & Entity Integration",
    maxPoints: 15,
    description: "How naturally the target keyword and related entities appear across the page."
  },
  {
    category: "Heading Structure & Scannability",
    maxPoints: 10,
    description: "How easy the page is to scan through headings and section structure."
  },
  {
    category: "Readability & Answerability",
    maxPoints: 15,
    description: "How concise, direct, and answer-engine-friendly the writing is."
  },
  {
    category: "Specificity & Value Density",
    maxPoints: 15,
    description: "How much useful, concrete, trustworthy value the content provides."
  },
  {
    category: "CTA & Navigation Signals",
    maxPoints: 10,
    description: "How clearly the page guides the next action and supports onward discovery."
  }
];

export async function optimizeWithDeepSeek(body, env = process.env) {
  const deepseekApiKey = env.DEEPSEEK_API_KEY || "";
  if (!deepseekApiKey) {
    throw new Error("Missing DEEPSEEK_API_KEY. Configure it in your environment before using /api/optimize.");
  }

  const deepseekModel = env.DEEPSEEK_MODEL || "deepseek-chat";
  const optimizationResult = await callDeepSeek(buildDeepSeekPayload(body, deepseekModel), deepseekApiKey);
  const resolvedKeyword = normalizeText(
    optimizationResult?.resolvedKeyword || body?.page?.title || body?.page?.headings?.[0]?.text || ""
  );
  const originalPage = body?.page || {};
  const optimizedPage = buildOptimizedPageForScoring(body, optimizationResult);
  let scoringResult = normalizeScoringResult(
    await callDeepSeek(
      buildDeepSeekScoringPayload({
        resolvedKeyword,
        originalPage,
        optimizedPage,
        deepseekModel
      }),
      deepseekApiKey
    )
  );

  if (!isValidEvaluation(scoringResult.originalEvaluation) || !isValidEvaluation(scoringResult.optimizedEvaluation)) {
    scoringResult = normalizeScoringResult(
      await callDeepSeek(
        buildDeepSeekScoreRepairPayload({
          resolvedKeyword,
          originalPage,
          optimizedPage,
          invalidResult: scoringResult,
          deepseekModel
        }),
        deepseekApiKey
      )
    );
  }

  if (!isValidEvaluation(scoringResult.originalEvaluation) || !isValidEvaluation(scoringResult.optimizedEvaluation)) {
    throw new Error("DeepSeek scoring response was incomplete. The model did not return a usable breakdown.");
  }

  return {
    ...optimizationResult,
    resolvedKeyword,
    originalEvaluation: scoringResult.originalEvaluation,
    optimizedEvaluation: scoringResult.optimizedEvaluation,
    scoreRubric: GEO_RUBRIC,
    scoreSource: "deepseek-second-pass"
  };
}

function buildDeepSeekPayload(body, deepseekModel) {
  const mode = body?.mode === "text" ? "text" : "html";
  const page = body?.page || {};
  const editableContent = body?.editableContent || {};
  const rawContent = body?.rawContent || "";

  const systemPrompt =
    "You optimize webpages for GEO while preserving their existing structure and visual design. " +
    "Return valid JSON only. Do not wrap your answer in markdown. " +
    "Do not invent claims, statistics, or product capabilities not supported by the source content. " +
    "Infer the primary topic yourself from the page. " +
    "Prefer meaningful edits that improve clarity, topical focus, answer-engine readability, metadata, click intent, and conversion guidance. " +
    "For HTML mode, preserve the overall page structure and styling intent, but you may substantially rewrite text inside existing content nodes. " +
    "Do not add or remove DOM nodes, scripts, styles, classes, ids, href destinations, or layout wrappers.";

  const userPrompt = JSON.stringify(
    {
      task:
        mode === "html"
          ? "Return JSON with resolvedKeyword, recommendations, and htmlEdits. Infer the main topic yourself. htmlEdits may contain title, metaDescription, headings, paragraphs, listItems, and links. For headings, paragraphs, listItems, and links, return only changed items using their existing index values."
          : "Return JSON with resolvedKeyword, recommendations, and textModePage. Infer the main topic yourself. textModePage must include title, metaDescription, headings, bodyText, and links.",
      constraints: [
        "Preserve tone, layout intent, and factual meaning.",
        "Keep edits visually safe, but stronger than a trivial touch-up.",
        "You may rewrite most existing text blocks if that materially improves GEO quality.",
        "Use the inferred topic naturally, not repetitively.",
        "Improve titles and descriptions for discoverability.",
        "Make headings, paragraph text, and CTA copy clearer and more answer-engine friendly.",
        "If a link label is generic, make it more descriptive without changing the destination.",
        "Preserve the same general structure and visual feel of the page.",
        "Do not invent unsupported facts."
      ],
      sourceHtmlSnippet: rawContent.slice(0, 12000),
      sourcePage: page,
      editableContent
    },
    null,
    2
  );

  return {
    model: deepseekModel,
    temperature: 0.2,
    max_tokens: 1800,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt }
    ],
    stream: false
  };
}

function buildDeepSeekScoringPayload({ resolvedKeyword, originalPage, optimizedPage, deepseekModel }) {
  const systemPrompt =
    "You are a GEO evaluator. Score content using the provided rubric only. " +
    "Return valid JSON only, with no markdown. " +
    "Be strict, consistent, and use the full 100-point scale. " +
    "Return both originalEvaluation and optimizedEvaluation. " +
    "Each evaluation must include totalScore, summary, and breakdown. " +
    "Each breakdown item must include category, score, maxPoints, and rationale. " +
    "Use exactly the rubric category names provided. " +
    "Do not rename fields.";

  const userPrompt = JSON.stringify(
    {
      task: "Evaluate the original page and the optimized page using the rubric. Return JSON with originalEvaluation and optimizedEvaluation only.",
      rubric: GEO_RUBRIC,
      resolvedKeyword,
      originalPage,
      optimizedPage,
      requiredSchemaExample: {
        originalEvaluation: {
          totalScore: 0,
          summary: "Short summary",
          breakdown: GEO_RUBRIC.map((item) => ({
            category: item.category,
            score: 0,
            maxPoints: item.maxPoints,
            rationale: "Short rationale"
          }))
        },
        optimizedEvaluation: {
          totalScore: 0,
          summary: "Short summary",
          breakdown: GEO_RUBRIC.map((item) => ({
            category: item.category,
            score: 0,
            maxPoints: item.maxPoints,
            rationale: "Short rationale"
          }))
        }
      }
    },
    null,
    2
  );

  return {
    model: deepseekModel,
    temperature: 0.1,
    max_tokens: 1600,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt }
    ],
    stream: false
  };
}

function buildDeepSeekScoreRepairPayload({ resolvedKeyword, originalPage, optimizedPage, invalidResult, deepseekModel }) {
  const systemPrompt =
    "You repair malformed GEO scoring JSON. Return valid JSON only, no markdown. " +
    "Use exactly the requested field names and rubric category names.";

  const userPrompt = JSON.stringify(
    {
      task: "The previous scoring output was malformed or incomplete. Re-score the pages and return only valid JSON in the required schema.",
      rubric: GEO_RUBRIC,
      resolvedKeyword,
      originalPage,
      optimizedPage,
      previousInvalidResult: invalidResult,
      requiredSchemaExample: {
        originalEvaluation: {
          totalScore: 0,
          summary: "Short summary",
          breakdown: GEO_RUBRIC.map((item) => ({
            category: item.category,
            score: 0,
            maxPoints: item.maxPoints,
            rationale: "Short rationale"
          }))
        },
        optimizedEvaluation: {
          totalScore: 0,
          summary: "Short summary",
          breakdown: GEO_RUBRIC.map((item) => ({
            category: item.category,
            score: 0,
            maxPoints: item.maxPoints,
            rationale: "Short rationale"
          }))
        }
      }
    },
    null,
    2
  );

  return {
    model: deepseekModel,
    temperature: 0,
    max_tokens: 1800,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt }
    ],
    stream: false
  };
}

async function callDeepSeek(payload, deepseekApiKey) {
  const response = await fetch("https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + deepseekApiKey
    },
    body: JSON.stringify(payload)
  });

  const raw = await response.text();
  let parsed;

  try {
    parsed = JSON.parse(raw);
  } catch {
    parsed = null;
  }

  if (!response.ok) {
    const upstreamError =
      parsed && parsed.error && parsed.error.message
        ? parsed.error.message
        : "DeepSeek request failed.";
    throw new Error(upstreamError);
  }

  const content = parsed?.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("DeepSeek returned an empty response.");
  }

  try {
    return JSON.parse(content);
  } catch {
    throw new Error("DeepSeek returned non-JSON content.");
  }
}

function buildOptimizedPageForScoring(body, optimizationResult) {
  const mode = body?.mode === "text" ? "text" : "html";
  const originalPage = body?.page || {};

  if (mode === "text") {
    return optimizationResult.textModePage || originalPage;
  }

  const editableContent = body?.editableContent || {};
  const htmlEdits = optimizationResult?.htmlEdits || {};
  const originalHeadings = Array.isArray(editableContent.headings) ? editableContent.headings : [];
  const originalParagraphs = Array.isArray(editableContent.paragraphs) ? editableContent.paragraphs : [];
  const originalListItems = Array.isArray(editableContent.listItems) ? editableContent.listItems : [];
  const originalLinks = Array.isArray(editableContent.links) ? editableContent.links : [];
  const headings = applyIndexedStructuredEdits(originalHeadings, htmlEdits.headings);
  const paragraphs = applyIndexedStructuredEdits(originalParagraphs, htmlEdits.paragraphs);
  const listItems = applyIndexedStructuredEdits(originalListItems, htmlEdits.listItems);
  const links = applyIndexedLinkEdits(originalLinks, htmlEdits.links);

  return {
    title: normalizeText(htmlEdits.title || editableContent.title || originalPage.title),
    metaDescription: normalizeText(
      htmlEdits.metaDescription || editableContent.metaDescription || originalPage.metaDescription
    ),
    headings: headings.map((item) => ({
      level: item.level,
      text: normalizeText(item.text)
    })),
    bodyText: normalizeText([].concat(paragraphs.map((item) => item.text), listItems.map((item) => item.text)).join(" ") || originalPage.bodyText),
    links: links.map((item) => ({
      text: normalizeText(item.text),
      href: item.href || ""
    }))
  };
}

function normalizeScoringResult(result) {
  const root = result || {};
  return {
    originalEvaluation: normalizeEvaluation(root.originalEvaluation || root.original || root.beforeEvaluation || root.before),
    optimizedEvaluation: normalizeEvaluation(root.optimizedEvaluation || root.optimized || root.afterEvaluation || root.after)
  };
}

function normalizeEvaluation(evaluation) {
  if (!evaluation || typeof evaluation !== "object") {
    return null;
  }

  const breakdownSource =
    evaluation.breakdown ||
    evaluation.scores ||
    evaluation.criteria ||
    evaluation.categories ||
    [];
  const normalizedBreakdown = GEO_RUBRIC.map((rubricItem) => {
    const rawItem = findBreakdownItem(breakdownSource, rubricItem.category);
    return {
      category: rubricItem.category,
      score: coerceNumber(rawItem && (rawItem.score ?? rawItem.points ?? rawItem.value), null),
      maxPoints: rubricItem.maxPoints,
      rationale: normalizeText(rawItem && (rawItem.rationale || rawItem.reason || rawItem.explanation || rawItem.notes))
    };
  });

  const completeBreakdown = normalizedBreakdown.every((item) => typeof item.score === "number");
  const totalScore =
    coerceNumber(evaluation.totalScore ?? evaluation.score ?? evaluation.total ?? evaluation.points, null) ??
    (completeBreakdown ? normalizedBreakdown.reduce((sum, item) => sum + item.score, 0) : null);

  return {
    totalScore,
    summary: normalizeText(evaluation.summary || evaluation.overview || evaluation.assessment),
    breakdown: normalizedBreakdown
  };
}

function findBreakdownItem(items, category) {
  if (!Array.isArray(items)) {
    return null;
  }

  const normalizedCategory = normalizeCategoryName(category);
  return items.find((item) => normalizeCategoryName(item && (item.category || item.name || item.title)) === normalizedCategory) || null;
}

function normalizeCategoryName(value) {
  return normalizeText(value).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function coerceNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function isValidEvaluation(evaluation) {
  return Boolean(
    evaluation &&
      typeof evaluation.totalScore === "number" &&
      Array.isArray(evaluation.breakdown) &&
      evaluation.breakdown.length === GEO_RUBRIC.length &&
      evaluation.breakdown.every(
        (item) =>
          item &&
          typeof item.category === "string" &&
          typeof item.score === "number" &&
          typeof item.maxPoints === "number"
      )
  );
}

function applyIndexedStructuredEdits(originalItems, edits) {
  const result = originalItems.map((item) => ({ ...item }));
  if (!Array.isArray(edits)) {
    return result;
  }

  edits.forEach((edit) => {
    if (!edit || typeof edit.index !== "number" || !result[edit.index]) {
      return;
    }

    if (typeof edit.text === "string") {
      result[edit.index].text = edit.text;
    }
  });

  return result;
}

function applyIndexedLinkEdits(originalItems, edits) {
  const result = originalItems.map((item) => ({ ...item }));
  if (!Array.isArray(edits)) {
    return result;
  }

  edits.forEach((edit) => {
    if (!edit || typeof edit.index !== "number" || !result[edit.index]) {
      return;
    }

    if (typeof edit.text === "string") {
      result[edit.index].text = edit.text;
    }
  });

  return result;
}

function normalizeText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}
