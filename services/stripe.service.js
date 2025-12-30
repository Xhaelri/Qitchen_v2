import Stripe from "stripe";
import Order from "../models/order.model.js";
import StripeConfig from "../models/stripeConfig.model.js";
import "dotenv/config";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

class StripeService {
  /**
   * Get active Stripe configuration
   */
  async getConfig() {
    return StripeConfig.findOne({ isActive: true });
  }

  /**
   * Get frontend URL
   */
  getFrontendUrl() {
    return process.env.FRONT_PRODUCTION_URL || process.env.CLIENT_URL || "http://localhost:3000";
  }

  /**
   * Create Stripe Checkout Session for order
   * @param {Object} order - The order document
   * @param {Object} context - Additional context (products, deliveryFee, etc.)
   */
  async createCheckoutSession(order, context) {
    try {
      const config = await this.getConfig();
      const { products, deliveryFee, userId, metadata = {} } = context;

      // Validate order amount against config
      if (config) {
        const amountValidation = await StripeConfig.validateOrderAmount(order.totalPrice);
        if (!amountValidation.success) {
          return amountValidation;
        }
      }

      // Get currency from config or default
      const currency = config?.currency || "usd";

      // Build line items from products
      const line_items = products.map((item) => ({
        price_data: {
          currency,
          product_data: {
            name: item.product.name,
            images: item.product.images || [],
            description: item.product.description?.substring(0, 500) || undefined,
          },
          unit_amount: Math.round(item.product.price * 100),
        },
        quantity: item.quantity,
      }));

      // Add delivery fee as separate line item if applicable
      if (deliveryFee > 0) {
        line_items.push({
          price_data: {
            currency,
            product_data: {
              name: "Delivery Fee",
              description: context.deliveryDescription || "Delivery charges",
            },
            unit_amount: Math.round(deliveryFee * 100),
          },
          quantity: 1,
        });
      }

      // Build URLs
      const frontendUrl = this.getFrontendUrl();
      const successUrl =
        config?.successUrl ||
        `${frontendUrl}/payment/success?session_id={CHECKOUT_SESSION_ID}&order_id=${order._id}`;
      const cancelUrl =
        config?.cancelUrl ||
        `${frontendUrl}/payment/cancelled?session_id={CHECKOUT_SESSION_ID}&order_id=${order._id}`;

      // Build session options
      let sessionOptions = {
        mode: config?.checkoutMode || "payment",
        line_items,
        success_url: successUrl,
        cancel_url: cancelUrl,
        metadata: {
          orderId: order._id.toString(),
          userId: userId?.toString(),
          ...metadata,
        },
      };

      // Apply config options
      if (config) {
        sessionOptions = await StripeConfig.getCheckoutSessionOptions(sessionOptions);

        // Payment method types
        const paymentMethodTypes = await StripeConfig.getEnabledPaymentMethodTypes();
        sessionOptions.payment_method_types = paymentMethodTypes;

        // Statement descriptor
        if (config.statementDescriptorSuffix) {
          sessionOptions.payment_intent_data = {
            ...(sessionOptions.payment_intent_data || {}),
            statement_descriptor_suffix: config.statementDescriptorSuffix,
          };
        }

        // Capture method
        if (config.captureMethod === "manual") {
          sessionOptions.payment_intent_data = {
            ...(sessionOptions.payment_intent_data || {}),
            capture_method: "manual",
          };
        }

        // Setup future usage (save card)
        if (config.saveCardForFutureUse && config.setupFutureUsage) {
          sessionOptions.payment_intent_data = {
            ...(sessionOptions.payment_intent_data || {}),
            setup_future_usage: config.setupFutureUsage,
          };
        }

        // Receipt email
        if (config.sendReceipts && context.customerEmail) {
          sessionOptions.customer_email = context.customerEmail;
        }

        // Expiration
        if (config.checkoutExpirationMinutes) {
          sessionOptions.expires_at =
            Math.floor(Date.now() / 1000) + config.checkoutExpirationMinutes * 60;
        }
      } else {
        // Default payment method types
        sessionOptions.payment_method_types = ["card"];
      }

      // Create Stripe checkout session
      const session = await stripe.checkout.sessions.create(sessionOptions);

      // Update order with Stripe session ID
      await Order.findByIdAndUpdate(order._id, { stripeSessionID: session.id });

      return {
        success: true,
        provider: "stripe",
        redirectUrl: session.url,
        sessionId: session.id,
        expiresAt: session.expires_at,
        message: "Stripe checkout session created. Redirect to payment.",
      };
    } catch (error) {
      console.error("StripeService.createCheckoutSession Error:", error);
      return {
        success: false,
        message: error.message,
      };
    }
  }

  /**
   * Refund a Stripe payment
   * @param {Object} order - The order document
   * @param {number} amount - Amount to refund (null for full refund)
   * @param {string} reason - Refund reason
   */
  async refundPayment(order, amount = null, reason = "requested_by_customer") {
    try {
      const config = await this.getConfig();

      // Validate refund is allowed
      if (config) {
        const canRefund = await StripeConfig.canRefundOrder(
          order.createdAt,
          amount || order.totalPrice,
          order.totalPrice
        );

        if (!canRefund.success) {
          return canRefund;
        }

        // Validate refund reason
        if (config.refundReasons && !config.refundReasons.includes(reason)) {
          reason = "requested_by_customer"; // Default to valid reason
        }
      }

      // Get payment intent from session
      if (!order.stripeSessionID) {
        return {
          success: false,
          message: "No Stripe session found for this order",
        };
      }

      const session = await stripe.checkout.sessions.retrieve(order.stripeSessionID);
      const paymentIntentId = session.payment_intent;

      if (!paymentIntentId) {
        return {
          success: false,
          message: "Payment intent not found for this order",
        };
      }

      // Calculate refund amount
      const refundAmount = amount || order.totalPrice;

      // Create refund
      const refund = await stripe.refunds.create({
        payment_intent: paymentIntentId,
        amount: Math.round(refundAmount * 100),
        reason,
      });

      // Update order
      const isPartialRefund = refundAmount < order.totalPrice;

      order.paymentStatus = isPartialRefund ? "PartiallyRefunded" : "Refunded";
      order.refundDetails = {
        refundId: refund.id,
        refundAmount,
        refundDate: new Date(),
        refundReason: reason,
        refundStatus: refund.status === "succeeded" ? "Completed" : "Pending",
      };

      await order.save();

      return {
        success: true,
        provider: "stripe",
        refundId: refund.id,
        amount: refundAmount,
        status: refund.status,
        isPartialRefund,
        message: `${isPartialRefund ? "Partial refund" : "Full refund"} processed successfully`,
      };
    } catch (error) {
      console.error("StripeService.refundPayment Error:", error);
      return {
        success: false,
        message: error.message,
      };
    }
  }

  /**
   * Cancel/Expire a Stripe checkout session
   * @param {Object} order - The order document
   */
  async expireSession(order) {
    try {
      if (!order.stripeSessionID) {
        return {
          success: false,
          message: "No Stripe session found for this order",
        };
      }

      // Expire the checkout session
      await stripe.checkout.sessions.expire(order.stripeSessionID);

      return {
        success: true,
        provider: "stripe",
        message: "Stripe session expired successfully",
      };
    } catch (error) {
      // Session might already be expired or completed
      if (error.code === "resource_missing" || error.code === "checkout_session_already_expired") {
        return {
          success: true,
          provider: "stripe",
          message: "Session already expired or completed",
        };
      }

      console.error("StripeService.expireSession Error:", error);
      return {
        success: false,
        message: error.message,
      };
    }
  }

  /**
   * Capture a manual payment (for capture_method: manual)
   * @param {Object} order - The order document
   * @param {number} amount - Amount to capture (null for full amount)
   */
  async capturePayment(order, amount = null) {
    try {
      if (!order.stripeSessionID) {
        return {
          success: false,
          message: "No Stripe session found for this order",
        };
      }

      const session = await stripe.checkout.sessions.retrieve(order.stripeSessionID);
      const paymentIntentId = session.payment_intent;

      if (!paymentIntentId) {
        return {
          success: false,
          message: "Payment intent not found for this order",
        };
      }

      // Build capture options
      const captureOptions = {};
      if (amount) {
        captureOptions.amount_to_capture = Math.round(amount * 100);
      }

      // Capture the payment
      const paymentIntent = await stripe.paymentIntents.capture(paymentIntentId, captureOptions);

      return {
        success: true,
        provider: "stripe",
        paymentIntentId: paymentIntent.id,
        status: paymentIntent.status,
        amountCaptured: paymentIntent.amount_captured / 100,
        message: "Payment captured successfully",
      };
    } catch (error) {
      console.error("StripeService.capturePayment Error:", error);
      return {
        success: false,
        message: error.message,
      };
    }
  }

  /**
   * Cancel a payment intent (for uncaptured payments)
   * @param {Object} order - The order document
   * @param {string} reason - Cancellation reason
   */
  async cancelPaymentIntent(order, reason = "requested_by_customer") {
    try {
      if (!order.stripeSessionID) {
        return {
          success: false,
          message: "No Stripe session found for this order",
        };
      }

      const session = await stripe.checkout.sessions.retrieve(order.stripeSessionID);
      const paymentIntentId = session.payment_intent;

      if (!paymentIntentId) {
        return {
          success: false,
          message: "Payment intent not found for this order",
        };
      }

      // Cancel the payment intent
      const paymentIntent = await stripe.paymentIntents.cancel(paymentIntentId, {
        cancellation_reason: reason,
      });

      return {
        success: true,
        provider: "stripe",
        paymentIntentId: paymentIntent.id,
        status: paymentIntent.status,
        message: "Payment intent cancelled successfully",
      };
    } catch (error) {
      console.error("StripeService.cancelPaymentIntent Error:", error);
      return {
        success: false,
        message: error.message,
      };
    }
  }

  /**
   * Get payment details
   * @param {string} sessionId - Stripe session ID
   */
  async getPaymentDetails(sessionId) {
    try {
      const session = await stripe.checkout.sessions.retrieve(sessionId, {
        expand: ["payment_intent", "customer"],
      });

      return {
        success: true,
        data: {
          sessionId: session.id,
          status: session.status,
          paymentStatus: session.payment_status,
          amountTotal: session.amount_total / 100,
          currency: session.currency,
          customerEmail: session.customer_details?.email,
          paymentIntentId: session.payment_intent?.id,
          paymentIntentStatus: session.payment_intent?.status,
        },
      };
    } catch (error) {
      console.error("StripeService.getPaymentDetails Error:", error);
      return {
        success: false,
        message: error.message,
      };
    }
  }

  /**
   * Handle order cancellation with auto-refund
   * @param {Object} order - The order document
   */
  async handleOrderCancellation(order) {
    const config = await this.getConfig();

    if (!order.stripeSessionID) {
      return {
        success: true,
        message: "No Stripe session to cancel",
      };
    }

    // Check payment status
    if (order.paymentStatus === "Pending") {
      // Session not completed - expire it
      return this.expireSession(order);
    } else if (order.paymentStatus === "Completed") {
      // Payment completed - refund if enabled
      if (config?.autoRefundOnCancellation) {
        const canRefund = await StripeConfig.canRefundOrder(
          order.createdAt,
          order.totalPrice,
          order.totalPrice
        );

        if (canRefund.success) {
          return this.refundPayment(order, null, "requested_by_customer");
        }
        return canRefund;
      }
    }

    return {
      success: true,
      message: "No automatic action taken - manual processing may be required",
    };
  }

  /**
   * Process webhook event
   * @param {Object} event - Stripe webhook event
   */
  async processWebhook(event) {
    try {
      switch (event.type) {
        case "checkout.session.completed": {
          const session = event.data.object;
          const orderId = session.metadata?.orderId;

          if (orderId) {
            const order = await Order.findById(orderId);
            if (order) {
              order.paymentStatus = "Completed";
              order.orderStatus = "Paid";
              order.stripePaymentIntentId = session.payment_intent;
              await order.save();
              console.log(`Order ${orderId} payment completed`);
            }
          }
          break;
        }

        case "checkout.session.expired": {
          const session = event.data.object;
          const orderId = session.metadata?.orderId;

          if (orderId) {
            const order = await Order.findById(orderId);
            if (order && order.paymentStatus === "Pending") {
              order.paymentStatus = "Failed";
              order.orderStatus = "Failed";
              await order.save();
              console.log(`Order ${orderId} session expired`);
            }
          }
          break;
        }

        case "payment_intent.payment_failed": {
          const paymentIntent = event.data.object;
          const orderId = paymentIntent.metadata?.orderId;

          if (orderId) {
            const order = await Order.findById(orderId);
            if (order) {
              order.paymentStatus = "Failed";
              order.orderStatus = "Failed";
              order.failureReason = paymentIntent.last_payment_error?.message;
              await order.save();
              console.log(`Order ${orderId} payment failed`);
            }
          }
          break;
        }

        case "charge.refunded": {
          const charge = event.data.object;
          // Handle refund confirmation if needed
          console.log(`Charge ${charge.id} refunded`);
          break;
        }

        default:
          console.log(`Unhandled event type: ${event.type}`);
      }

      return { success: true };
    } catch (error) {
      console.error("StripeService.processWebhook Error:", error);
      return {
        success: false,
        message: error.message,
      };
    }
  }
}

export default new StripeService();
