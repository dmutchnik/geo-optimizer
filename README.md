# GEO-Optimized Web Parser

This project is a browser-based demo for a Computational Advertising final project. It accepts webpage HTML or plain text, parses major on-page elements, scores the page against GEO-oriented criteria, and generates an improved version of the content. The current optimizer uses the DeepSeek API through a local server-side proxy so the API key is not exposed in the browser.

## Features

- Paste raw HTML or plain webpage text
- Upload an HTML file for analysis
- Parse title, meta description, headings, body copy, and links
- Score content using GEO-related criteria:
  - title quality
  - meta description coverage
  - heading structure
  - keyword placement and density
  - readability
  - content depth
  - link usage
- Generate an optimized page version
- Compare original vs. optimized output side by side
- Run sample tests with Node's built-in test runner

## Project Structure

- [index.html](/Users/drewmutchnik/Desktop/adv final project/index.html)
- [styles.css](/Users/drewmutchnik/Desktop/adv final project/styles.css)
- [app.js](/Users/drewmutchnik/Desktop/adv final project/app.js)
- [browser-app.js](/Users/drewmutchnik/Desktop/adv final project/browser-app.js)
- [server.js](/Users/drewmutchnik/Desktop/adv final project/server.js)
- [lib/geo-engine.js](/Users/drewmutchnik/Desktop/adv final project/lib/geo-engine.js)
- [lib/parsers.js](/Users/drewmutchnik/Desktop/adv final project/lib/parsers.js)
- [docs/methodology-and-results.md](/Users/drewmutchnik/Desktop/adv final project/docs/methodology-and-results.md)
- [tests/geo-engine.test.js](/Users/drewmutchnik/Desktop/adv final project/tests/geo-engine.test.js)

## How to Run

1. Create a `.env` file in [/Users/drewmutchnik/Desktop/adv final project](/Users/drewmutchnik/Desktop/adv final project) based on [.env.example](/Users/drewmutchnik/Desktop/adv final project/.env.example):

```bash
DEEPSEEK_API_KEY=your_actual_key_here
DEEPSEEK_MODEL=deepseek-chat
```

2. Start the local server:

```bash
npm start
```

3. Open [http://localhost:3000](http://localhost:3000)

To run tests:

```bash
npm test
```

## Suggested Presentation Framing

You can present the system as a lightweight GEO assistant with this workflow:

1. Parse incoming webpage content into structured on-page elements.
2. Score the page using explicit GEO criteria.
3. Recommend improvements tied to specific weaknesses.
4. Generate a more optimized webpage draft.
5. Compare pre- and post-optimization results.

## Limitations

- The optimizer now depends on a working DeepSeek API key and network access.
- GEO is still an emerging concept, so the scoring criteria are a practical classroom approximation.
- Real production validation would require experiments on live webpages and traffic outcomes.
