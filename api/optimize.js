import { optimizeWithDeepSeek } from "../lib/deepseek-service.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed." });
    return;
  }

  try {
    const result = await optimizeWithDeepSeek(req.body || {}, process.env);
    res.status(200).json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({
      error: error && error.message ? error.message : "Unexpected server error."
    });
  }
}
