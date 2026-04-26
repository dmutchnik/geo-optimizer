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

const MODEL_LIMITS = {
  optimizationRawContentChars: 7000,
  optimizationBodyTextChars: 3200,
  optimizationParagraphTextChars: 280,
  scoringBodyTextChars: 2600,
  scoringSummaryTextChars: 240,
  maxHeadings: 14,
  maxParagraphs: 12,
  maxListItems: 16,
  maxLinks: 12,
  maxRecommendations: 8,
  repairResponseChars: 9000
};

export async function optimizeWithDeepSeek(body, env = process.env) {
  const deepseekApiKey = env.DEEPSEEK_API_KEY || "";
  if (!deepseekApiKey) {
    throw new Error("Missing DEEPSEEK_API_KEY. Configure it in your environment before using /api/optimize.");
  }

  const deepseekModel = env.DEEPSEEK_MODEL || "deepseek-chat";
  const optimizationContext = buildOptimizationContext(body);
  const optimizationResult = await callDeepSeekWithRepair(
    buildDeepSeekPayload(body, deepseekModel, optimizationContext),
    deepseekApiKey,
    (rawResponseContent) =>
      buildDeepSeekOptimizationRepairPayload({
        body,
        deepseekModel,
        optimizationContext,
        rawResponseContent
      })
  );
  const resolvedKeyword = normalizeText(
    optimizationResult?.resolvedKeyword || body?.page?.title || body?.page?.headings?.[0]?.text || ""
  );
  const originalPage = body?.page || {};
  const optimizedPage = buildOptimizedPageForScoring(body, optimizationResult);
  const originalPageForScoring = buildScoringContextPage(originalPage);
  const optimizedPageForScoring = buildScoringContextPage(optimizedPage);
  let scoringResult = normalizeScoringResult(
    await callDeepSeekWithRepair(
      buildDeepSeekScoringPayload({
        resolvedKeyword,
        originalPage: originalPageForScoring,
        optimizedPage: optimizedPageForScoring,
        deepseekModel
      }),
      deepseekApiKey,
      (rawResponseContent) =>
        buildDeepSeekScoreRepairPayload({
          resolvedKeyword,
          originalPage: originalPageForScoring,
          optimizedPage: optimizedPageForScoring,
          invalidResult: { rawResponseContent },
          deepseekModel
        })
    )
  );

  if (!isValidEvaluation(scoringResult.originalEvaluation) || !isValidEvaluation(scoringResult.optimizedEvaluation)) {
    scoringResult = normalizeScoringResult(
      await callDeepSeek(
        buildDeepSeekScoreRepairPayload({
          resolvedKeyword,
          originalPage: originalPageForScoring,
          optimizedPage: optimizedPageForScoring,
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

function buildDeepSeekPayload(body, deepseekModel, optimizationContext) {
  const mode = body?.mode === "text" ? "text" : "html";
  const context = optimizationContext || buildOptimizationContext(body);
  const htmlEditRequirements = mode === "html" ? buildHtmlEditRequirements(context.editableContent) : null;

  const systemPrompt =
    "You optimize webpages for GEO while preserving their existing structure and visual design. " +
    "Return valid JSON only. Do not wrap your answer in markdown. " +
    "Do not invent claims, statistics, or product capabilities not supported by the source content. " +
    "Infer the primary topic yourself from the page. " +
    "Prefer meaningful edits that improve clarity, topical focus, answer-engine readability, metadata, click intent, and conversion guidance. " +
    "Do not limit yourself to metadata-only edits when meaningful on-page content rewrites are possible. " +
    "For HTML mode, preserve the overall page structure and styling intent, but you may substantially rewrite text inside existing content nodes. " +
    "Do not add or remove DOM nodes, scripts, styles, classes, ids, href destinations, or layout wrappers.";

  const userPrompt = JSON.stringify(
    {
      task:
        mode === "html"
          ? "Return JSON with resolvedKeyword, recommendations, and htmlEdits. Infer the main topic yourself. htmlEdits should include visible on-page content improvements, not just metadata. For headings, paragraphs, listItems, and links, return only changed items using their existing index values."
          : "Return JSON with resolvedKeyword, recommendations, and textModePage. Infer the main topic yourself. textModePage must include title, metaDescription, headings, bodyText, and links.",
      constraints: [
        "Preserve tone, layout intent, and factual meaning.",
        "Keep edits visually safe, but stronger than a trivial touch-up.",
        "When the page has substantive body copy, rewrite multiple visible content blocks instead of stopping at metadata.",
        "You may rewrite most existing text blocks if that materially improves GEO quality.",
        "Use the inferred topic naturally, not repetitively.",
        "Improve titles and descriptions for discoverability.",
        "Make headings, paragraph text, list text, and CTA copy clearer and more answer-engine friendly.",
        "If a link label is generic, make it more descriptive without changing the destination.",
        "Preserve the same general structure and visual feel of the page.",
        "Do not invent unsupported facts."
      ],
      htmlEditRequirements,
      sourceHtmlSnippet: context.sourceHtmlSnippet,
      sourcePage: context.sourcePage,
      editableContent: context.editableContent
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

function buildDeepSeekOptimizationRepairPayload({
  body,
  deepseekModel,
  optimizationContext,
  rawResponseContent
}) {
  const mode = body?.mode === "text" ? "text" : "html";
  const htmlEditRequirements = mode === "html" ? buildHtmlEditRequirements(optimizationContext.editableContent) : null;
  const schemaExample =
    mode === "html"
      ? {
          resolvedKeyword: "Main topic",
          recommendations: ["Short recommendation"],
          htmlEdits: {
            title: "Optimized page title",
            metaDescription: "Improved meta description",
            headings: [{ index: 0, text: "Improved heading text" }],
            paragraphs: [{ index: 0, text: "Improved paragraph text" }],
            listItems: [{ index: 0, text: "Improved list item text" }],
            links: [{ index: 0, text: "Descriptive link label", title: "Optional link title" }]
          }
        }
      : {
          resolvedKeyword: "Main topic",
          recommendations: ["Short recommendation"],
          textModePage: {
            title: "Optimized page title",
            metaDescription: "Improved meta description",
            headings: [{ level: "h1", text: "Improved heading text" }],
            bodyText: "Improved body text",
            links: [{ text: "Descriptive link label", href: "/example" }]
          }
        };

  return {
    model: deepseekModel,
    temperature: 0,
    max_tokens: 1800,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content:
          "You repair malformed GEO optimization output. Return valid JSON only, no markdown or commentary. " +
          "Keep the same intent as the original optimization response, but make the output match the requested schema exactly."
      },
      {
        role: "user",
        content: JSON.stringify(
          {
            task:
              "Convert the previous optimization response into valid JSON. If parts are unusable, reconstruct the most likely intended edits from the provided page snapshot.",
            mode,
            htmlEditRequirements,
            sourcePage: optimizationContext.sourcePage,
            editableContent: optimizationContext.editableContent,
            previousModelResponse: truncateText(rawResponseContent, MODEL_LIMITS.repairResponseChars),
            requiredSchemaExample: schemaExample
          },
          null,
          2
        )
      }
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

  const content = getMessageText(parsed?.choices?.[0]?.message?.content);
  if (!content) {
    throw new Error("DeepSeek returned an empty response.");
  }

  try {
    return extractJsonFromModelText(content);
  } catch {
    const error = new Error("DeepSeek returned non-JSON content.");
    error.code = "DEEPSEEK_NON_JSON";
    error.rawContent = content;
    throw error;
  }
}

async function callDeepSeekWithRepair(payload, deepseekApiKey, repairPayloadBuilder) {
  try {
    return await callDeepSeek(payload, deepseekApiKey);
  } catch (error) {
    if (error && error.code === "DEEPSEEK_NON_JSON" && typeof repairPayloadBuilder === "function") {
      return callDeepSeek(repairPayloadBuilder(error.rawContent || ""), deepseekApiKey);
    }

    throw error;
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

function buildOptimizationContext(body) {
  const mode = body?.mode === "text" ? "text" : "html";
  return {
    mode,
    sourceHtmlSnippet: truncateText(
      mode === "html" ? sanitizeRawHtml(body?.rawContent || "") : normalizeText(body?.rawContent || ""),
      MODEL_LIMITS.optimizationRawContentChars
    ),
    sourcePage: buildOptimizationContextPage(body?.page || {}),
    editableContent: buildOptimizationEditableContent(body?.editableContent || {})
  };
}

function buildOptimizationContextPage(page) {
  return {
    title: normalizeText(page.title),
    metaDescription: normalizeText(page.metaDescription),
    headings: limitStructuredItems(page.headings, MODEL_LIMITS.maxHeadings),
    bodyText: truncateText(normalizeText(page.bodyText), MODEL_LIMITS.optimizationBodyTextChars),
    links: limitLinks(page.links, MODEL_LIMITS.maxLinks)
  };
}

function buildOptimizationEditableContent(editableContent) {
  return {
    title: normalizeText(editableContent.title),
    metaDescription: normalizeText(editableContent.metaDescription),
    headings: limitStructuredItems(editableContent.headings, MODEL_LIMITS.maxHeadings),
    paragraphs: limitStructuredItems(
      editableContent.paragraphs,
      MODEL_LIMITS.maxParagraphs,
      MODEL_LIMITS.optimizationParagraphTextChars
    ),
    listItems: limitStructuredItems(
      editableContent.listItems,
      MODEL_LIMITS.maxListItems,
      MODEL_LIMITS.optimizationParagraphTextChars
    ),
    links: limitLinks(editableContent.links, MODEL_LIMITS.maxLinks)
  };
}

function buildScoringContextPage(page) {
  return {
    title: normalizeText(page.title),
    metaDescription: normalizeText(page.metaDescription),
    headings: limitStructuredItems(page.headings, MODEL_LIMITS.maxHeadings),
    bodyText: truncateText(normalizeText(page.bodyText), MODEL_LIMITS.scoringBodyTextChars),
    links: limitLinks(page.links, MODEL_LIMITS.maxLinks)
  };
}

function buildHtmlEditRequirements(editableContent) {
  const headings = Array.isArray(editableContent?.headings) ? editableContent.headings : [];
  const paragraphs = Array.isArray(editableContent?.paragraphs) ? editableContent.paragraphs : [];
  const listItems = Array.isArray(editableContent?.listItems) ? editableContent.listItems : [];
  const links = Array.isArray(editableContent?.links) ? editableContent.links : [];
  const hasSubstantiveParagraphs = paragraphs.filter((item) => splitWordCount(item?.text) >= 12);
  const descriptiveLinks = links.filter((item) => splitWordCount(item?.text) > 0);

  return {
    strategy:
      "Preserve the DOM structure, but make the optimized page visibly stronger by rewriting core user-facing copy in place.",
    requiredEdits: [
      "Always improve title and metaDescription.",
      headings.length
        ? "Rewrite the primary H1 and at least one additional heading when available."
        : "No headings available to rewrite.",
      hasSubstantiveParagraphs.length >= 4
        ? "Rewrite at least the first 4 substantive paragraphs."
        : hasSubstantiveParagraphs.length >= 2
          ? "Rewrite all substantive paragraphs, with emphasis on the first 2."
          : hasSubstantiveParagraphs.length === 1
            ? "Rewrite the main paragraph substantially."
            : "No substantive paragraphs available to rewrite.",
      listItems.length >= 3
        ? "Rewrite several list items if they are generic or low-value."
        : listItems.length
          ? "Rewrite list items if they can be made more specific."
          : "No list items available to rewrite.",
      descriptiveLinks.length
        ? "Rewrite at least one CTA or generic link label to be more descriptive."
        : "No links available to rewrite."
    ],
    preferredTargets: {
      headingIndexes: headings.slice(0, Math.min(3, headings.length)).map((item) => item.index),
      paragraphIndexes: hasSubstantiveParagraphs
        .slice(0, Math.min(4, hasSubstantiveParagraphs.length))
        .map((item) => item.index),
      listItemIndexes: listItems.slice(0, Math.min(4, listItems.length)).map((item) => item.index),
      linkIndexes: descriptiveLinks.slice(0, Math.min(2, descriptiveLinks.length)).map((item) => item.index)
    }
  };
}

function limitStructuredItems(items, maxItems, textLimit) {
  if (!Array.isArray(items)) {
    return [];
  }

  return items
    .slice(0, maxItems)
    .map((item, index) => ({
      ...(item && typeof item === "object" ? item : {}),
      index: typeof item?.index === "number" ? item.index : index,
      text: truncateText(normalizeText(item?.text), textLimit || MODEL_LIMITS.scoringSummaryTextChars)
    }))
    .filter((item) => item.text);
}

function limitLinks(links, maxItems) {
  if (!Array.isArray(links)) {
    return [];
  }

  return links
    .slice(0, maxItems)
    .map((link, index) => ({
      ...(link && typeof link === "object" ? link : {}),
      index: typeof link?.index === "number" ? link.index : index,
      text: truncateText(normalizeText(link?.text), 120),
      href: truncateText(normalizeText(link?.href), 220)
    }))
    .filter((link) => link.text || link.href);
}

function sanitizeRawHtml(value) {
  return String(value || "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function truncateText(value, maxLength) {
  const text = String(value || "").trim();
  if (!maxLength || text.length <= maxLength) {
    return text;
  }

  return text.slice(0, Math.max(maxLength - 1, 0)).trimEnd() + "…";
}

function splitWordCount(value) {
  const text = normalizeText(value);
  return text ? text.split(/\s+/).length : 0;
}

function getMessageText(content) {
  if (typeof content === "string") {
    return content.trim();
  }

  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === "string") {
          return part;
        }

        if (part && typeof part === "object") {
          return part.text || part.content || "";
        }

        return "";
      })
      .join("")
      .trim();
  }

  return "";
}

export function extractJsonFromModelText(content) {
  const normalized = String(content || "").replace(/^\uFEFF/, "").trim();
  const candidates = [];
  const fencedMatch = normalized.match(/```(?:json)?\s*([\s\S]*?)```/i);

  if (normalized) {
    candidates.push(normalized);
  }

  if (fencedMatch && fencedMatch[1]) {
    candidates.push(fencedMatch[1].trim());
  }

  const objectSlice = extractBalancedJsonSlice(normalized, "{", "}");
  const arraySlice = extractBalancedJsonSlice(normalized, "[", "]");

  if (objectSlice) {
    candidates.push(objectSlice);
  }

  if (arraySlice) {
    candidates.push(arraySlice);
  }

  for (const candidate of uniqueNonEmptyValues(candidates)) {
    try {
      return JSON.parse(candidate);
    } catch {
      continue;
    }
  }

  throw new Error("Unable to extract JSON from model response.");
}

function extractBalancedJsonSlice(text, openChar, closeChar) {
  const start = text.indexOf(openChar);
  if (start === -1) {
    return "";
  }

  let depth = 0;
  let inString = false;
  let escapeNext = false;

  for (let index = start; index < text.length; index += 1) {
    const char = text[index];

    if (escapeNext) {
      escapeNext = false;
      continue;
    }

    if (char === "\\") {
      escapeNext = true;
      continue;
    }

    if (char === '"') {
      inString = !inString;
      continue;
    }

    if (inString) {
      continue;
    }

    if (char === openChar) {
      depth += 1;
      continue;
    }

    if (char === closeChar) {
      depth -= 1;
      if (depth === 0) {
        return text.slice(start, index + 1);
      }
    }
  }

  return "";
}

function uniqueNonEmptyValues(values) {
  return Array.from(
    new Set(
      (values || [])
        .map((value) => String(value || "").trim())
        .filter(Boolean)
    )
  );
}
