import test from "node:test";
import assert from "node:assert/strict";

import { analyzePage, optimizePage } from "../lib/geo-engine.js";

const weakPage = {
  title: "Fast shoes",
  metaDescription: "Running shoes",
  headings: [{ level: "h1", text: "Fast shoes" }],
  bodyText:
    "These shoes are light and quick. They help runners train. They are easy to wear and look nice.",
  links: []
};

const strongPage = {
  title: "Sustainable Running Shoes for Everyday Training",
  metaDescription:
    "Explore sustainable running shoes with lightweight cushioning, recycled materials, and fit guidance for daily training and race prep.",
  headings: [
    { level: "h1", text: "Sustainable Running Shoes for Everyday Training" },
    { level: "h2", text: "Why Sustainable Running Shoes Matter" },
    { level: "h2", text: "Materials, Fit, and Performance" },
    { level: "h3", text: "How to Choose the Right Pair" }
  ],
  bodyText:
    "Sustainable running shoes help athletes reduce waste while keeping comfort, cushioning, and durability in focus. This guide explains how recycled uppers, responsive foam, and breathable designs support daily mileage. Runners can compare stability, traction, and fit so they choose a pair that matches training goals. The page also highlights how sustainable running shoes fit different budgets, surfaces, and long-term performance needs. Helpful details, direct explanations, and clear organization make the content easier for readers and search systems to understand.",
  links: [
    { text: "Shop the collection", href: "/shop" },
    { text: "Read sizing guide", href: "/sizing-guide" }
  ]
};

test("analyzePage gives stronger pages a higher score", () => {
  const weakScore = analyzePage(weakPage, "sustainable running shoes").score;
  const strongScore = analyzePage(strongPage, "sustainable running shoes").score;

  assert.ok(strongScore > weakScore);
});

test("optimizePage improves the score for weak content", () => {
  const before = analyzePage(weakPage, "sustainable running shoes").score;
  const optimized = optimizePage(weakPage, "sustainable running shoes");

  assert.ok(optimized.analysis.score > before);
  assert.match(optimized.optimizedPage.title, /Sustainable Running Shoes/i);
});
