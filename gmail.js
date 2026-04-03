/**
 * INTU Wellness — Gmail Integration
 * Full send, reply, delete, and draft management via Gmail API + OAuth2
 */

const { google } = require("googleapis");
const fs = require("fs");
const path = require("path");
const readline = require("readline");
const http = require("http");
const url = require("url");

const CREDENTIALS_PATH = path.join(__dirname, "gmail-credentials.json");
const TOKEN_PATH = path.join(__dirname, "gmail-token.json");
const SCOPES = [
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/gmail.modify",
  "https://www.googleapis.com/auth/gmail.readonly",
];

// ─── Auth ─────────────────────────────────────────────────────────────────────

function loadCredentials() {
  if (!fs.existsSync(CREDENTIALS_PATH)) {
    throw new Error(
      "gmail-credentials.json not found.\n" +
      "Download it from Google Cloud Console and place it in:\n" +
      CREDENTIALS_PATH
    );
  }
  return JSON.parse(fs.readFileSync(CREDENTIALS_PATH, "utf8"));
}

function createOAuthClient() {
  const creds = loadCredentials();
  const { client_id, client_secret, redirect_uris } = creds.installed || creds.web;
  return new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);
}

async function authorize() {
  const oAuth2Client = createOAuthClient();

  // Use cached token if available
  if (fs.existsSync(TOKEN_PATH)) {
    const token = JSON.parse(fs.readFileSync(TOKEN_PATH, "utf8"));
    oAuth2Client.setCredentials(token);

    // Refresh if expired
    if (token.expiry_date && token.expiry_date < Date.now()) {
      const { credentials } = await oAuth2Client.refreshAccessToken();
      oAuth2Client.setCredentials(credentials);
      fs.writeFileSync(TOKEN_PATH, JSON.stringify(credentials));
    }

    return oAuth2Client;
  }

  // First-time auth — open browser
  return await getNewToken(oAuth2Client);
}

async function getNewToken(oAuth2Client) {
  return new Promise((resolve, reject) => {
    // Try local server callback first (cleaner UX)
    const server = http.createServer(async (req, res) => {
      const qs = new url.URL(req.url, "http://localhost:3000").searchParams;
      const code = qs.get("code");
      if (!code) return;

      res.end("<h2>INTU Agent authorised. You can close this tab.</h2>");
      server.close();

      try {
        const { tokens } = await oAuth2Client.getToken(code);
        oAuth2Client.setCredentials(tokens);
        fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens));
        console.log("\nAuthorisation complete. Token saved.\n");
        resolve(oAuth2Client);
      } catch (err) {
        reject(err);
      }
    });

    server.listen(3000, () => {
      const authUrl = oAuth2Client.generateAuthUrl({
        access_type: "offline",
        scope: SCOPES,
        redirect_uri: "http://localhost:3000",
      });
      oAuth2Client.redirectUri = "http://localhost:3000";
      console.log("\nOpening browser for Gmail authorisation...");
      console.log("If it does not open automatically, visit:\n" + authUrl);

      // Try to open browser
      const { exec } = require("child_process");
      exec(`open "${authUrl}"`);
    });

    server.on("error", () => {
      // Fallback to manual code entry if port 3000 is busy
      const authUrl = oAuth2Client.generateAuthUrl({
        access_type: "offline",
        scope: SCOPES,
      });
      console.log("\nVisit this URL to authorise:\n" + authUrl);
      const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
      rl.question("\nPaste the authorisation code here: ", async (code) => {
        rl.close();
        try {
          const { tokens } = await oAuth2Client.getToken(code);
          oAuth2Client.setCredentials(tokens);
          fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens));
          console.log("Authorisation complete.\n");
          resolve(oAuth2Client);
        } catch (err) {
          reject(err);
        }
      });
    });
  });
}

// ─── Gmail operations ─────────────────────────────────────────────────────────

function makeEmailRaw({ to, subject, body, replyToMessageId, replyToThreadId, from }) {
  const fromAddr = from || "hello@intuwellness.com";
  const headers = [
    `From: INTU WELLNESS <${fromAddr}>`,
    `To: ${to}`,
    `Subject: ${subject}`,
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=UTF-8",
  ];
  if (replyToMessageId) {
    headers.push(`In-Reply-To: ${replyToMessageId}`);
    headers.push(`References: ${replyToMessageId}`);
  }
  const email = headers.join("\r\n") + "\r\n\r\n" + body;
  return Buffer.from(email).toString("base64url");
}

/**
 * Send a new email
 */
async function sendEmail({ to, subject, body }) {
  const auth = await authorize();
  const gmail = google.gmail({ version: "v1", auth });
  const raw = makeEmailRaw({ to, subject, body });
  const res = await gmail.users.messages.send({
    userId: "me",
    requestBody: { raw },
  });
  return res.data;
}

/**
 * Reply to an existing email thread
 */
async function replyToEmail({ to, subject, body, messageId, threadId }) {
  const auth = await authorize();
  const gmail = google.gmail({ version: "v1", auth });
  const raw = makeEmailRaw({
    to,
    subject: subject.startsWith("Re:") ? subject : `Re: ${subject}`,
    body,
    replyToMessageId: messageId,
  });
  const res = await gmail.users.messages.send({
    userId: "me",
    requestBody: { raw, threadId },
  });
  return res.data;
}

/**
 * Delete (trash) a draft by draft ID
 */
async function deleteDraft(draftId) {
  const auth = await authorize();
  const gmail = google.gmail({ version: "v1", auth });
  await gmail.users.drafts.delete({ userId: "me", id: draftId });
  return { deleted: draftId };
}

/**
 * Send an existing draft by draft ID
 */
async function sendDraft(draftId) {
  const auth = await authorize();
  const gmail = google.gmail({ version: "v1", auth });
  const res = await gmail.users.drafts.send({
    userId: "me",
    requestBody: { id: draftId },
  });
  return res.data;
}

/**
 * Create a draft (alternative to MCP)
 */
async function createDraft({ to, subject, body, threadId }) {
  const auth = await authorize();
  const gmail = google.gmail({ version: "v1", auth });
  const raw = makeEmailRaw({ to, subject, body });
  const requestBody = { message: { raw } };
  if (threadId) requestBody.message.threadId = threadId;
  const res = await gmail.users.drafts.create({ userId: "me", requestBody });
  return res.data;
}

/**
 * Mark a message as read
 */
async function markAsRead(messageId) {
  const auth = await authorize();
  const gmail = google.gmail({ version: "v1", auth });
  await gmail.users.messages.modify({
    userId: "me",
    id: messageId,
    requestBody: { removeLabelIds: ["UNREAD"] },
  });
}

// ─── CLI (for setup/testing) ──────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);

  if (args[0] === "--auth") {
    console.log("Authorising Gmail...");
    await authorize();
    console.log("Done. You can now send emails via the agent.");
    return;
  }

  if (args[0] === "--send-draft" && args[1]) {
    console.log(`Sending draft ${args[1]}...`);
    const result = await sendDraft(args[1]);
    console.log("Sent. Message ID:", result.id);
    return;
  }

  if (args[0] === "--delete-draft" && args[1]) {
    console.log(`Deleting draft ${args[1]}...`);
    await deleteDraft(args[1]);
    console.log("Draft deleted.");
    return;
  }

  if (args[0] === "--test") {
    console.log("Sending test email to hello@intuwellness.com...");
    await sendEmail({
      to: "hello@intuwellness.com",
      subject: "INTU Agent — Gmail send test",
      body: "This is a test email from the INTU Wellness customer service agent. If you received this, sending is working correctly.\n\nKind regards,\nAlex\nIntu Wellness Customer Care",
    });
    console.log("Test email sent.");
    return;
  }

  console.log("Gmail integration commands:");
  console.log("  node gmail.js --auth                        # Authorise Gmail (run first)");
  console.log("  node gmail.js --send-draft <draftId>        # Send a saved draft");
  console.log("  node gmail.js --delete-draft <draftId>      # Delete a draft");
  console.log("  node gmail.js --test                        # Send a test email");
}

main().catch((err) => {
  console.error("Error:", err.message);
  process.exit(1);
});

module.exports = { sendEmail, replyToEmail, sendDraft, deleteDraft, createDraft, markAsRead, authorize };
