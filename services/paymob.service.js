// paymob.service.js
// ✅ Paymob payment service
// ❌ REMOVED: PaymobConfig.isPaymentMethodEnabled() check
// Activation is validated in validatePaymentMethod() BEFORE reaching this service

import axios from "axios";
import Order from "../models/order.model.js";
import PaymobConfig from "../models/paymobConfig.model.js";
import {
  generateUniqueId,
  createPaymobIntention,
  getBaseUrl,
} from "../utils/paymob.utils.js";
import Cart from "../models/cart.model.js";

class PaymobService {
  /**
   * Get active Paymob configuration
   */
  async getConfig() {
    return PaymobConfig.findOne({ isActive: true });
  }

  /**
   * Get integration name from config or fallback to default
   */
  async getIntegrationName(paymentMethodName) {
    const config = await this.getConfig();

    if (config) {
      const integrationName = await PaymobConfig.getIntegrationName(paymentMethodName);
      if (integrationName) return integrationName;
    }

    // Fallback to default names
    const defaultNames = {
      "Paymob-Card": "card",
      "Paymob-Wallet": "wallet",
      "Paymob-Kiosk": "kiosk",
      "Paymob-Installments": "installments",
      "Paymob-ValU": "valu",
    };

    return defaultNames[paymentMethodName] || "card";
  }

  /**
   * Authenticate with Paymob API (for legacy API calls)
   */
  async authenticate() {
    try {
      const response = await axios.post(
        `${process.env.PAYMOB_API_URL}/auth/tokens`,
        { api_key: process.env.PAYMOB_API_KEY }
      );
      return {
        success: true,
        token: response.data.token,
      };
    } catch (error) {
      console.error("Paymob authentication error:", error.response?.data || error.message);
      return {
        success: false,
        error: error.response?.data?.message || error.message,
      };
    }
  }

  /**
   * Create Paymob payment for order
   * ✅ NOTE: Activation is validated in validatePaymentMethod() BEFORE reaching here
   * @param {Object} order - The order document
   * @param {Object} req - Express request object
   * @param {String} paymentMethodName - Payment method name
   */
  async createPaymentForOrder(order, req, paymentMethodName) {
    try {
      const config = await this.getConfig();

      // ✅ Only validate amount (activation is done in validatePaymentMethod)
      if (config) {
        const amountValidation = await PaymobConfig.validateOrderAmount(
          order.totalPrice,
          paymentMethodName
        );
        if (!amountValidation.success) {
          return amountValidation;
        }
      }

      // Generate unique payment ID
      let uniquePaymentId = generateUniqueId();
      let isUnique = false;

      while (!isUnique) {
        const existing = await Order.findOne({ uniquePaymentId });
        if (!existing) {
          isUnique = true;
        } else {
          uniquePaymentId = generateUniqueId();
        }
      }

      // Update order with unique ID
      order.uniquePaymentId = uniquePaymentId;
      await order.save();

      const baseUrl = getBaseUrl(req);
      const integrationName = await this.getIntegrationName(paymentMethodName);

      console.log(`Payment Method: ${paymentMethodName}, Integration: ${integrationName}`);

      // Get user details
      const user = await order.populate("buyer");

      // Create line items from order products
      await order.populate("products.product");
      const items = order.products.map((item) => ({
        name: item.product.name,
        amount: Math.round(item.product.price * 100),
        description: item.product.description?.substring(0, 50) || "",
        quantity: item.quantity,
      }));

      // Add delivery fee if applicable
      if (order.deliveryFee > 0) {
        items.push({
          name: "Delivery Fee",
          amount: Math.round(order.deliveryFee * 100),
          description: `Delivery to ${order.deliveryLocation?.city || "location"}`,
          quantity: 1,
        });
      }

      // Get settings from config
      const currency = config?.currency || "EGP";
      const frontendUrl = process.env.FRONT_PRODUCTION_URL || process.env.CLIENT_URL;
      const redirectUrl = config?.customRedirectUrl || `${frontendUrl}/payment-redirect`;
      const webhookUrl = config?.customWebhookUrl || `${baseUrl}/api/v2/webhooks/paymob`;

      // Create Paymob intention
      const result = await createPaymobIntention({
        amount: order.totalPrice,
        currency,
        integrationName,
        userDetails: {
          name: user.buyer.name,
          email: user.buyer.email,
          phoneNumber: user.buyer.phoneNumber,
        },
        uniqueId: uniquePaymentId,
        baseUrl,
        frontendUrl,
        redirectUrl,
        webhookUrl,
        items,
        expirationMinutes: config?.transactionExpirationMinutes || 30,
      });

      if (!result.success) {
        throw new Error(result.error);
      }

      // Update order with Paymob data
      order.paymobData = {
        intentionId: result.data.id,
        clientSecret: result.data.client_secret,
        paymentMethods: result.data.payment_methods,
        intentionResponse: result.data,
        paymentMethodUsed: paymentMethodName,
        integrationName,
      };
      order.paymobIntentionId = result.data.id;
      order.paymobPaymentId = result.data.id?.toString();

      await order.save();

      return {
        success: true,
        checkoutUrl: result.checkoutUrl,
        order,
      };
    } catch (error) {
      console.error("PaymobService.createPaymentForOrder Error:", error);
      return {
        success: false,
        message: error.message,
      };
    }
  }

  /**
   * Refund a Paymob transaction
   */
  async refundTransaction(transactionId, amountCents) {
    try {
      const auth = await this.authenticate();
      if (!auth.success) {
        return { success: false, message: "Authentication failed: " + auth.error };
      }

      const response = await axios.post(
        `${process.env.PAYMOB_API_URL}/acceptance/void_refund/refund`,
        {
          auth_token: auth.token,
          transaction_id: transactionId,
          amount_cents: amountCents,
        }
      );

      if (response.data.success || response.data.refunded_amount_cents) {
        return {
          success: true,
          refundId: response.data.id,
          amount: amountCents / 100,
          status: "completed",
          data: response.data,
        };
      }

      return {
        success: false,
        message: response.data.message || "Refund failed",
        data: response.data,
      };
    } catch (error) {
      console.error("Paymob refund error:", error.response?.data || error.message);
      return {
        success: false,
        message: error.response?.data?.message || error.message,
      };
    }
  }

  /**
   * Void a Paymob transaction (same-day cancellation)
   */
  async voidTransaction(transactionId) {
    try {
      const config = await this.getConfig();

      if (config && !config.allowVoidTransaction) {
        return { success: false, message: "Void transactions are disabled" };
      }

      const auth = await this.authenticate();
      if (!auth.success) {
        return { success: false, message: "Authentication failed: " + auth.error };
      }

      const response = await axios.post(
        `${process.env.PAYMOB_API_URL}/acceptance/void_refund/void`,
        {
          auth_token: auth.token,
          transaction_id: transactionId,
        }
      );

      if (response.data.success) {
        return {
          success: true,
          message: "Transaction voided successfully",
          data: response.data,
        };
      }

      return {
        success: false,
        message: response.data.message || "Void failed",
        data: response.data,
      };
    } catch (error) {
      console.error("Paymob void error:", error.response?.data || error.message);
      return {
        success: false,
        message: error.response?.data?.message || error.message,
      };
    }
  }

  /**
   * Capture an authorized transaction
   */
  async captureTransaction(transactionId, amountCents) {
    try {
      const auth = await this.authenticate();
      if (!auth.success) {
        return { success: false, message: "Authentication failed: " + auth.error };
      }

      const response = await axios.post(
        `${process.env.PAYMOB_API_URL}/acceptance/capture`,
        {
          auth_token: auth.token,
          transaction_id: transactionId,
          amount_cents: amountCents,
        }
      );

      if (response.data.success) {
        return {
          success: true,
          message: "Transaction captured successfully",
          data: response.data,
        };
      }

      return {
        success: false,
        message: response.data.message || "Capture failed",
        data: response.data,
      };
    } catch (error) {
      console.error("Paymob capture error:", error.response?.data || error.message);
      return {
        success: false,
        message: error.response?.data?.message || error.message,
      };
    }
  }

  /**
   * Retrieve transaction details
   */
  async getTransaction(transactionId) {
    try {
      const auth = await this.authenticate();
      if (!auth.success) {
        return { success: false, message: "Authentication failed: " + auth.error };
      }

      const response = await axios.get(
        `${process.env.PAYMOB_API_URL}/acceptance/transactions/${transactionId}`,
        { headers: { Authorization: `Bearer ${auth.token}` } }
      );

      return { success: true, data: response.data };
    } catch (error) {
      console.error("Paymob get transaction error:", error.response?.data || error.message);
      return {
        success: false,
        message: error.response?.data?.message || error.message,
      };
    }
  }

  /**
   * Process webhook payment confirmation
   */
 async processWebhookPayment(webhookData) {
    try {
      console.log("Processing webhook:", JSON.stringify(webhookData, null, 2));

      let order = null;
      let transactionSuccess = false;

      if (webhookData.obj) {
        transactionSuccess =
          webhookData.obj.success === true ||
          webhookData.obj.success === "true" ||
          webhookData.obj.pending === false ||
          webhookData.obj.response_code === 200 ||
          webhookData.obj.response_code === "200" ||
          (webhookData.obj.id && !webhookData.obj.error);
      }

      // Try to find by merchant_order_id
      if (webhookData.obj?.merchant_order_id) {
        order = await Order.findOne({ uniquePaymentId: webhookData.obj.merchant_order_id });
      }

      // Try to find by extras.ee
      if (!order && webhookData.obj?.payment_key_claims?.extra?.ee) {
        order = await Order.findOne({
          uniquePaymentId: webhookData.obj.payment_key_claims.extra.ee,
        });
      }

      if (!order) {
        console.error("Order not found in webhook");
        return { success: false, message: "Order not found" };
      }

      // Store transaction ID
      if (webhookData.obj?.id) {
        order.paymobTransactionId = webhookData.obj.id.toString();
      }

      // Update order status
      if (transactionSuccess && webhookData.type === "TRANSACTION") {
        order.paymentStatus = "Completed";
        order.orderStatus = "Paid";
        order.paymobData = {
          ...order.paymobData,
          webhookResponse: webhookData,
          completedAt: new Date(),
        };
        await order.save();
        console.log("Payment completed:", order.uniquePaymentId);

        // ✅ ADD CART CLEARING LOGIC HERE
        try {
          const cart = await Cart.findOne({ owner: order.buyer });
          if (cart && cart.products.length > 0) {
            cart.products = [];
            cart.totalPrice = 0;
            cart.totalQuantity = 0;
            await cart.save();
            console.log(`Cart cleared for user ${order.buyer} after Paymob payment success`);
          }
        } catch (cartError) {
          console.error("Error clearing cart after Paymob payment:", cartError);
          // Don't fail the webhook - order is already marked as paid
        }

      } else if (!transactionSuccess && webhookData.obj) {
        order.paymentStatus = "Failed";
        order.orderStatus = "Failed";
        order.paymobData = {
          ...order.paymobData,
          webhookResponse: webhookData,
          failedAt: new Date(),
          failureReason: webhookData.obj.data?.message || "Payment failed",
        };
        await order.save();
        console.log("Payment failed:", order.uniquePaymentId);
      }

      return { success: true, order };
    } catch (error) {
      console.error("PaymobService.processWebhookPayment Error:", error);
      throw error;
    }
  }

  /**
   * Handle order cancellation with auto-void/refund
   */
  async handleOrderCancellation(order) {
    const config = await this.getConfig();
    const transactionId = order.paymobTransactionId || order.paymobData?.obj?.id;

    if (!transactionId) {
      return { success: true, message: "No Paymob transaction to cancel" };
    }

    if (order.paymentStatus === "Pending") {
      if (config?.autoVoidOnCancellation) {
        return this.voidTransaction(transactionId);
      }
    } else if (order.paymentStatus === "Completed") {
      if (config?.autoRefundOnCancellation) {
        const canRefund = await PaymobConfig.canRefundOrder(
          order.createdAt,
          order.totalPrice,
          order.totalPrice
        );

        if (canRefund.success) {
          return this.refundTransaction(transactionId, Math.round(order.totalPrice * 100));
        }
        return canRefund;
      }
    }

    return { success: true, message: "No automatic action taken" };
  }
}

export default new PaymobService();
