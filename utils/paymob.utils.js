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
 * Create Paymob Intention API payment
 */
export async function createPaymobIntention({
  amount,
  currency = "EGP",
  integrationName, // ✅ Changed from integrationId to integrationName
  userDetails,
  uniqueId,
  baseUrl,
  items = [],
}) {
  try {
    const amountCents = Math.round(amount * 100);

    const nameParts = userDetails.name.split(" ");
    const firstName = nameParts[0] || userDetails.name;
    const lastName = nameParts.slice(1).join(" ") || userDetails.name;

    const intentionPayload = {
      amount: amountCents,
      currency,
      payment_methods: [integrationName], // ✅ Use the integration name as string
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
        phone_number: userDetails.phoneNumber || "+20",
      },
      extras: {
        ee: uniqueId,
        merchant_order_id: uniqueId,
      },
      // ✅ Redirect to FRONTEND after payment
      redirection_url: `${frontendUrl}/payment-redirect?orderId=${uniqueId}`,
      // ✅ Webhook goes to BACKEND API
      notification_url: `${baseUrl}/api/v2/paymob-webhook`,
      special_reference: uniqueId,
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
  createPaymobIntention,
};
