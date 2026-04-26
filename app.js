import { analyzePage, formatPage, optimizePage } from "./lib/geo-engine.js";
import { parseContent } from "./lib/parsers.js";
import { samplePage } from "./samples/sample-pages.js";

const modeSelect = document.querySelector("#modeSelect");
const fileInput = document.querySelector("#fileInput");
const keywordInput = document.querySelector("#keywordInput");
const contentInput = document.querySelector("#contentInput");
const analyzeButton = document.querySelector("#analyzeButton");
const sampleButton = document.querySelector("#sampleButton");
const clearButton = document.querySelector("#clearButton");

const emptyState = document.querySelector("#emptyState");
const resultsContent = document.querySelector("#resultsContent");
const originalScore = document.querySelector("#originalScore");
const originalScoreSummary = document.querySelector("#originalScoreSummary");
const optimizedScore = document.querySelector("#optimizedScore");
const optimizedScoreSummary = document.querySelector("#optimizedScoreSummary");
const detectedElements = document.querySelector("#detectedElements");
const recommendations = document.querySelector("#recommendations");
const originalContent = document.querySelector("#originalContent");
const optimizedContent = document.querySelector("#optimizedContent");

function renderList(node, items) {
  node.innerHTML = "";
  for (const item of items) {
    const li = document.createElement("li");
    li.textContent = item;
    node.appendChild(li);
  }
}

function renderAnalysis() {
  const content = contentInput.value;
  const mode = modeSelect.value;
  const keyword = keywordInput.value.trim();

  const parsedPage = parseContent(content, mode);
  const analysis = analyzePage(parsedPage, keyword);
  const optimized = optimizePage(parsedPage, keyword || analysis.topTerms[0] || "");

  emptyState.classList.add("hidden");
  resultsContent.classList.remove("hidden");

  originalScore.textContent = `${analysis.score}`;
  originalScoreSummary.textContent = analysis.summary;
  optimizedScore.textContent = `${optimized.analysis.score}`;
  optimizedScoreSummary.textContent = optimized.analysis.summary;

  renderList(detectedElements, [
    ...analysis.detectedElements,
    `Primary keyword: ${optimized.analysis.keywordStats.keyword || "not set"}`,
    `Top terms: ${analysis.topTerms.join(", ") || "none"}`
  ]);

  renderList(recommendations, analysis.suggestions);

  originalContent.textContent = formatPage(parsedPage);
  optimizedContent.textContent = formatPage(optimized.optimizedPage);
}

async function loadFile(event) {
  const file = event.target.files?.[0];
  if (!file) {
    return;
  }

  const text = await file.text();
  contentInput.value = text;
  modeSelect.value = "html";
}

function loadSample() {
  keywordInput.value = samplePage.keyword;
  modeSelect.value = samplePage.mode;
  contentInput.value = samplePage.content;
  renderAnalysis();
}

function clearAll() {
  keywordInput.value = "";
  contentInput.value = "";
  fileInput.value = "";
  emptyState.classList.remove("hidden");
  resultsContent.classList.add("hidden");
}

analyzeButton.addEventListener("click", renderAnalysis);
sampleButton.addEventListener("click", loadSample);
clearButton.addEventListener("click", clearAll);
fileInput.addEventListener("change", loadFile);
