# Gemini Connection Implementation Guide

This guide documents the specific architectural and implementation details required to make Google Gemini work within the Waidrin engine using its OpenAI-compatible endpoint.

## 1. Architectural Overview: The Proxy Requirement
Google's Generative AI API (`generativelanguage.googleapis.com`) does not support direct browser-side requests due to strict **CORS policies**. To resolve this, a server-side proxy was implemented.

### The Flow
**Browser** ➔ **Local Next.js Proxy** (`/api/gemini`) ➔ **Google Gemini API**

### Implementation Details
The proxy is located at `app/api/gemini/chat/completions/route.ts`. 
- **Header Sanitization (Request):** The proxy MUST strip browser-specific headers (like `Origin`, `Referer`, `Cookie`) and only forward `Content-Type` and `Authorization`. Google's API rejects requests containing an `Origin` header with a `400 Bad Request`.
- **Header Sanitization (Response):** Only the `Content-Type` header is returned to the browser to avoid encoding/mismatch issues with Next.js response handling.
- **Static vs Catch-all:** A static route (`/chat/completions`) was found to be more reliable than a catch-all (`[...path]`) in certain Next.js environments to avoid `404` errors.

---

## 2. GeminiBackend Implementation
Located in `lib/backend.ts`, the `GeminiBackend` class extends `DefaultBackend` with critical overrides to handle Gemini's unique behavior.

### A. Base URL & Origin
The `OpenAI` client requires an absolute URL in browser environments. The backend dynamically determines the origin:
```typescript
const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
baseURL: `${origin}/api/gemini`
```

### B. Parameter Whitelisting
Gemini's adapter rejects "unknown" parameters used by local backends (like KoboldCpp). The backend implements a strict whitelist:
- **Supported:** `temperature`, `top_p`, `max_tokens`, `stream`, `stop`, `presence_penalty`, `frequency_penalty`, `logit_bias`, `user`, `response_format`, `seed`.
- **Filtered Out:** `min_p`, `dry_multiplier`, `max_completion_tokens`.

### C. Structured Outputs (JSON) Support
Gemini's OpenAI adapter often ignores `response_format` constraints for primitive types or complex nested schemas.
- **Schema Sanitization:** Recursively removes `$schema` and `additionalProperties` from the JSON schema before sending, as these can cause `400` errors or "Instruction Drift."
- **Dual-Layer Enforcement:** The schema is injected directly into the **System Prompt** as a stringified JSON constraint *and* sent in the `response_format` header.
- **Root Wrapping:** Gemini requires an object root. If the engine asks for a primitive (like `z.literal`), the backend wraps it in a `{ "result": ... }` object and robustly unwraps it before returning to the Zod parser.

### D. Robust Extraction Fallback
If Gemini returns plain text (e.g., "Here is the JSON: {}") instead of raw JSON, the backend:
1. Extracts content from Markdown code blocks (```json ... ```).
2. Attempts to auto-wrap raw text as a string inside a `result` object if a literal value was expected.

---

## 3. UI Configuration
The **Connection Setup** (`views/ConnectionSetup.tsx`) includes a dedicated "Gemini" tab:
- **Lockdown:** The API base URL is hidden/locked to the local proxy.
- **Guidance:** Provides specific model placeholders (e.g., `gemini-1.5-flash`, `gemini-2.0-flash`).
- **Context:** Hardcoded notes remind users that keys are stored client-side only.

---

## 4. Troubleshooting Common Errors

| Error | Cause | Fix |
| :--- | :--- | :--- |
| **CORS / Preflight Failure** | Browser blocked direct call to Google. | Ensure `activeBackend` is set to `"gemini"` to trigger the proxy. |
| **400 Bad Request (Unknown name "X")** | Prohibited params like `min_p` sent. | Verify the parameter whitelist in `lib/backend.ts`. |
| **404 Not Found** | Next.js didn't find the route handler. | Ensure the proxy is at the static path `/api/gemini/chat/completions`. |
| **ZodError (expected "X" but got "test")** | Model followed text prompt, ignored schema. | Ensure `effectivePrompt` includes the schema string injection. |
| **SyntaxError (Unexpected token 'H')** | Model returned "Here is..." text. | The markdown/regex extractor in `getObject` handles this. |