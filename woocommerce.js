/**
 * WooCommerce Order Lookup
 * INTU Wellness — intuwellness.com
 */

const https = require("https");

const WC_BASE_URL = process.env.WC_BASE_URL || "https://intuwellness.com";
const WC_KEY = process.env.WC_CONSUMER_KEY;
const WC_SECRET = process.env.WC_CONSUMER_SECRET;

function wcRequest(path) {
  return new Promise((resolve, reject) => {
    const auth = Buffer.from(`${WC_KEY}:${WC_SECRET}`).toString("base64");
    const url = `${WC_BASE_URL}/wp-json/wc/v3${path}`;

    const options = {
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/json",
      },
    };

    https.get(url, options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch {
          reject(new Error(`Failed to parse response: ${data}`));
        }
      });
    }).on("error", reject);
  });
}

/**
 * Look up an order by order number
 */
async function getOrder(orderId) {
  const { status, body } = await wcRequest(`/orders/${orderId}`);
  if (status !== 200) {
    throw new Error(`Order not found (status ${status})`);
  }
  return formatOrder(body);
}

/**
 * Look up orders by customer email
 */
async function getOrdersByEmail(email) {
  const { status, body } = await wcRequest(
    `/orders?search=${encodeURIComponent(email)}&per_page=5&orderby=date&order=desc`
  );
  if (status !== 200 || !Array.isArray(body) || body.length === 0) {
    throw new Error(`No orders found for ${email}`);
  }
  return body.map(formatOrder);
}

/**
 * Format a WooCommerce order into a clean summary
 */
function formatOrder(order) {
  const items = (order.line_items || []).map((item) => ({
    name: item.name,
    quantity: item.quantity,
    total: item.total,
  }));

  return {
    id: order.id,
    number: order.number,
    status: order.status,
    date: order.date_created,
    customer: {
      name: `${order.billing?.first_name || ""} ${order.billing?.last_name || ""}`.trim(),
      email: order.billing?.email || "",
      phone: order.billing?.phone || "",
    },
    shipping: {
      address: [
        order.shipping?.address_1,
        order.shipping?.address_2,
        order.shipping?.city,
        order.shipping?.state,
        order.shipping?.postcode,
        order.shipping?.country,
      ]
        .filter(Boolean)
        .join(", "),
      method: order.shipping_lines?.[0]?.method_title || "",
    },
    items,
    total: order.total,
    currency: order.currency,
    payment_method: order.payment_method_title || "",
    note: order.customer_note || "",
  };
}

/**
 * Print a human-readable order summary
 */
function printOrder(order) {
  console.log("\n" + "─".repeat(50));
  console.log(`Order #${order.number} — ${order.status.toUpperCase()}`);
  console.log(`Date: ${new Date(order.date).toLocaleDateString("en-AU")}`);
  console.log(`\nCustomer: ${order.customer.name}`);
  console.log(`Email:    ${order.customer.email}`);
  if (order.customer.phone) console.log(`Phone:    ${order.customer.phone}`);
  console.log(`\nShipping: ${order.shipping.address}`);
  if (order.shipping.method) console.log(`Method:   ${order.shipping.method}`);
  console.log(`\nItems:`);
  order.items.forEach((item) => {
    console.log(`  • ${item.name} x${item.quantity} — $${item.total}`);
  });
  console.log(`\nTotal: $${order.total} ${order.currency}`);
  console.log(`Payment: ${order.payment_method}`);
  if (order.note) console.log(`Note: ${order.note}`);
  console.log("─".repeat(50));
}

// ─── CLI ──────────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);

  if (!WC_KEY || !WC_SECRET) {
    console.error("Error: WC_CONSUMER_KEY and WC_CONSUMER_SECRET must be set.");
    process.exit(1);
  }

  if (args[0] === "--order" && args[1]) {
    const order = await getOrder(args[1]);
    printOrder(order);
  } else if (args[0] === "--email" && args[1]) {
    const orders = await getOrdersByEmail(args[1]);
    orders.forEach(printOrder);
  } else {
    console.log("Usage:");
    console.log("  node woocommerce.js --order 21291");
    console.log("  node woocommerce.js --email customer@example.com");
  }
}

main().catch((err) => {
  console.error("Error:", err.message);
  process.exit(1);
});

module.exports = { getOrder, getOrdersByEmail };
