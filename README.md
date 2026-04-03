# INTU Wellness Customer Service Agent

Powered by Claude Opus 4.6. Built for INTU Wellness — responding as Alex, your customer care agent.

---

## Setup

### 1. Install dependencies

```bash
pip install -r requirements.txt
```

### 2. Set your API key

```bash
export ANTHROPIC_API_KEY="your-anthropic-api-key"
```

Get your API key from: https://console.anthropic.com/

---

## Usage

### Interactive mode (recommended for testing)

```bash
python agent.py
```

Type customer messages and see Alex respond in real time. Type `new` to start a fresh conversation, `quit` to exit.

### Specify a channel

```bash
python agent.py --channel email
python agent.py --channel instagram
python agent.py --channel facebook
```

### Single response (for integrations)

```bash
python agent.py --single "Hi, I still haven't received my order from 10 days ago"
```

---

## Project Structure

```
INTU Customer Service Agent/
├── agent.py              # Main agent — run this
├── system_prompt.py      # Agent brain — loads all knowledge
├── requirements.txt      # Python dependencies
├── README.md             # This file
└── knowledge/
    ├── products.md       # All 3 products: ingredients, benefits, compliance
    ├── faq.md            # 24 Q&As from real customer emails
    └── policies.md       # Shipping, refund, subscription, privacy policies
```

---

## Keeping the Agent Up to Date

The agent's knowledge lives in the `knowledge/` folder. Update these files as the business evolves:

| File | Update when... |
|------|----------------|
| `knowledge/products.md` | New products launch, formulations change, pricing updates |
| `knowledge/faq.md` | New common questions emerge (especially during restocks, promos, sales) |
| `knowledge/policies.md` | Shipping, refund, or subscription policies change |
| `system_prompt.py` | Escalation contacts change, known issues are resolved or emerge |

**Current known issues to remove from `system_prompt.py` once resolved:**
- Sleep & Skin Renewal tub back-order (expected April 2026)
- Short-dated stock (May 2026 expiry) — no longer a concern once new stock arrives

---

## Escalation Contact

Natalie Turner — General Manager
natalie@intuwellness.com

---

## Deploying to Channels

This agent is channel-agnostic — the same brain can power:

- **Website chat widget** (Tidio, Intercom, Crisp, Gorgias)
- **Email** (Zendesk, Help Scout, Gmail with Zapier)
- **Instagram/Facebook DMs** (ManyChat, Meta Business Suite integrations)

To deploy to a specific platform, use the `system_prompt.py` prompt as the AI's system prompt and feed customer messages to the `respond()` function in `agent.py`.

---

## Brand Voice Quick Reference

| DO | DON'T |
|----|-------|
| "traditionally used to relieve sleeplessness" | "cures insomnia" |
| "listed medicine on the ARTG" | "TGA approved" |
| "may support" / "is formulated to" | "heals" / "fixes" / "eliminates" |
| "supports healthy stress response" | "treats anxiety" |
| "Niacin" (not "Vitamin B3") | em-dashes as parenthetical substitutes |
| Warm, direct, conversational | Corporate, clinical, preachy |
