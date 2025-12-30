import crypto from "crypto";
import axios from "axios";

/**
 * Generate unique 8-character alphanumeric ID
 */
export function generateUniqueId() {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let result = "";
  for (let i = 0; i < 8; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Generate HMAC for QR code verification
 */
export function generateHMAC(data) {
  return crypto
    .createHmac("sha256", process.env.HMAC_SECRET)
    .update(data)
    .digest("hex");
}

/**
 * Verify Paymob webhook HMAC
 */
export function verifyPaymobHMAC(data) {
  const {
    amount_cents,
    created_at,
    currency,
    error_occured,
    has_parent_transaction,
    id,
    integration_id,
    is_3d_secure,
    is_auth,
    is_capture,
    is_refunded,
    is_standalone_payment,
    is_voided,
    order,
    owner,
    pending,
    source_data_pan,
    source_data_sub_type,
    source_data_type,
    success,
  } = data;

  const concatenatedString = [
    amount_cents,
    created_at,
    currency,
    error_occured,
    has_parent_transaction,
    id,
    integration_id,
    is_3d_secure,
    is_auth,
    is_capture,
    is_refunded,
    is_standalone_payment,
    is_voided,
    order,
    owner,
    pending,
    source_data_pan,
    source_data_sub_type,
    source_data_type,
    success,
  ].join("");

  const expectedHmac = crypto
    .createHmac("sha512", process.env.PAYMOB_HMAC_SECRET)
    .update(concatenatedString)
    .digest("hex");

  return expectedHmac === data.hmac;
}

/**
 * Build base URL for callbacks
 */
export function getBaseUrl(req) {
  function normalizeUrl(u) {
    if (!u) return null;
    let url = u.toString().trim();
    url = url.replace(/\/$/, "");
    if (!/^https?:\/\//i.test(url)) {
      url = `https://${url}`;
    }
    return url;
  }

  if (process.env.BASE_URL) return normalizeUrl(process.env.BASE_URL);

  if (process.env.WEBHOOK_URL) {
    const derived = process.env.WEBHOOK_URL.replace(
      "/api/v2/paymob-webhook",
      ""
    );
    return normalizeUrl(derived);
  }

  const proto = req.headers["x-forwarded-proto"] || req.protocol || "https";
  const host = req.headers["x-forwarded-host"] || req.headers.host;
  if (host) return `${proto}://${host}`;

  return `http://localhost:${process.env.PORT || 4000}`;
}

/**
 * Get frontend URL
 */
export function getFrontendUrl() {
  return process.env.FRONT_PRODUCTION_URL || process.env.CLIENT_URL || "http://localhost:3000";
}

/**
 * Create Paymob Intention API payment
 * 
 * @param {Object} params
 * @param {number} params.amount - Amount in currency units (e.g., 100 for 100 EGP)
 * @param {string} params.currency - Currency code (default: "EGP")
 * @param {string} params.integrationName - Integration name from Paymob dashboard
 * @param {Object} params.userDetails - User details (name, email, phoneNumber)
 * @param {string} params.uniqueId - Unique payment ID
 * @param {string} params.baseUrl - Backend base URL for webhooks
 * @param {string} params.frontendUrl - Frontend URL for redirects (optional)
 * @param {string} params.redirectUrl - Custom redirect URL (optional)
 * @param {string} params.webhookUrl - Custom webhook URL (optional)
 * @param {Array} params.items - Line items (optional)
 * @param {number} params.expirationMinutes - Expiration in minutes (default: 30, max: 51840 = 36 days)
 */
export async function createPaymobIntention({
  amount,
  currency = "EGP",
  integrationName,
  userDetails,
  uniqueId,
  baseUrl,
  frontendUrl,
  redirectUrl,
  webhookUrl,
  items = [],
  expirationMinutes = 30,
}) {
  try {
    const amountCents = Math.round(amount * 100);

    const nameParts = userDetails.name.split(" ");
    const firstName = nameParts[0] || userDetails.name;
    const lastName = nameParts.slice(1).join(" ") || userDetails.name;

    // Get URLs with fallbacks
    const actualFrontendUrl = frontendUrl || getFrontendUrl();
    const actualRedirectUrl = redirectUrl || `${actualFrontendUrl}/payment-redirect?orderId=${uniqueId}`;
    const actualWebhookUrl = webhookUrl || `${baseUrl}/api/v2/paymob-webhook`;

    // ✅ FIX: Calculate expiration as RELATIVE SECONDS, not absolute timestamp
    // Paymob expects: number of seconds from now (max: 3,110,400 = ~36 days)
    // expirationMinutes is in minutes, convert to seconds
    let expirationSeconds = expirationMinutes * 60;
    
    // Paymob max is 3,110,400 seconds (~36 days)
    const MAX_EXPIRATION_SECONDS = 3110400;
    if (expirationSeconds > MAX_EXPIRATION_SECONDS) {
      console.warn(`Expiration ${expirationSeconds}s exceeds Paymob max (${MAX_EXPIRATION_SECONDS}s). Using max value.`);
      expirationSeconds = MAX_EXPIRATION_SECONDS;
    }

    const intentionPayload = {
      amount: amountCents,
      currency,
      payment_methods: [integrationName],
      items:
        items.length > 0
          ? items
          : [
              {
                name: "Order Payment",
                amount: amountCents,
                description: `Payment for order ${uniqueId}`,
                quantity: 1,
              },
            ],
      billing_data: {
        apartment: "NA",
        first_name: firstName,
        last_name: lastName,
        street: "NA",
        building: "NA",
        phone_number: userDetails.phoneNumber || "+20",
        country: "EG",
        email: userDetails.email,
        floor: "NA",
        state: "NA",
      },
      customer: {
        first_name: firstName,
        last_name: lastName,
        email: userDetails.email,
        extras: {
          re: uniqueId,
        },
      },
      extras: {
        ee: uniqueId,
        merchant_order_id: uniqueId,
      },
      redirection_url: actualRedirectUrl,
      notification_url: actualWebhookUrl,
      special_reference: uniqueId,
      // ✅ FIX: expiration is RELATIVE seconds from now, NOT absolute timestamp
      expiration: expirationSeconds,
    };

    console.log(
      "Creating Paymob Intention:",
      JSON.stringify(intentionPayload, null, 2)
    );

    const response = await axios.post(
      `${process.env.PAYMOB_API_URL}/v1/intention/`,
      intentionPayload,
      {
        headers: {
          Authorization: `Token ${process.env.PAYMOB_SECRET_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );

    console.log(
      "Paymob Intention Response:",
      JSON.stringify(response.data, null, 2)
    );

    return {
      success: true,
      data: response.data,
      checkoutUrl: `https://accept.paymob.com/unifiedcheckout/?publicKey=${process.env.PAYMOB_PUBLIC_KEY}&clientSecret=${response.data.client_secret}`,
    };
  } catch (error) {
    console.error(
      "Paymob Intention Error:",
      error.response?.data || error.message
    );
    return {
      success: false,
      error: error.response?.data?.detail || error.message,
    };
  }
}

export default {
  generateUniqueId,
  generateHMAC,
  verifyPaymobHMAC,
  getBaseUrl,
  getFrontendUrl,
  createPaymobIntention,
};