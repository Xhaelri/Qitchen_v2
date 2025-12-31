// stripeWebhook.controller.js
import Stripe from "stripe";
import express from "express";
import Order from "../models/order.model.js";
import Cart from "../models/cart.model.js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

const fulfillCheckout = async (sessionId) => {
  console.log(`Fulfilling Checkout Session ${sessionId}`);

  try {
    const checkoutSession = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ["line_items"],
    });

    console.log(`Session retrieved:`, {
      id: sessionId,
      payment_status: checkoutSession.payment_status,
      metadata: checkoutSession.metadata,
    });

    const orderId = checkoutSession.metadata?.orderId;

    if (!orderId) {
      console.log(
        "ERROR: No orderId found in session metadata",
        checkoutSession.metadata
      );
      throw new Error("No orderId found in session metadata");
    }

    console.log(`Processing order: ${orderId}`);

    const order = await Order.findById(orderId);
    if (!order) {
      console.log(`ERROR: Order ${orderId} not found in database`);
      throw new Error(`Order ${orderId} not found`);
    }

    console.log(`Current order status:`, {
      orderId: order._id,
      paymentStatus: order.paymentStatus,
      orderStatus: order.orderStatus,
      sessionPaymentStatus: checkoutSession.payment_status,
    });

    if (
      order.paymentStatus === "Completed" ||
      order.paymentStatus === "Failed"
    ) {
      console.log(
        `Order ${orderId} already processed (${order.paymentStatus}), skipping`
      );
      return;
    }

    if (checkoutSession.payment_status === "paid") {
      // Update order status
      order.paymentStatus = "Completed";
      order.orderStatus = "Paid";
      order.stripeSessionID = sessionId;
      order.stripePaymentIntentId = checkoutSession.payment_intent;
      await order.save();

      console.log(`Order ${orderId} updated:`, {
        paymentStatus: order.paymentStatus,
        orderStatus: order.orderStatus,
      });

      // ✅ FIXED: Find cart by user, not by cartId
      try {
        const cart = await Cart.findOne({ owner: order.buyer });
        if (cart && cart.products.length > 0) {
          cart.products = [];
          cart.totalPrice = 0;
          cart.totalQuantity = 0;
          await cart.save();
          console.log(`Cart cleared for user ${order.buyer} after Stripe payment`);
        } else {
          console.log(`No cart found or cart already empty for user ${order.buyer}`);
        }
      } catch (cartError) {
        console.error(`Error clearing cart for user ${order.buyer}:`, cartError);
        // Don't throw - order is already paid, cart clearing is secondary
      }

      console.log(`Order ${orderId} payment completed successfully`);

    } else if (checkoutSession.payment_status === "unpaid") {
      order.paymentStatus = "Failed";
      order.orderStatus = "Failed";
      order.stripeSessionID = sessionId;
      await order.save();

      console.log(`Order ${orderId} marked as failed due to unpaid status`, {
        paymentStatus: order.paymentStatus,
        orderStatus: order.orderStatus,
      });

    } else {
      order.paymentStatus = "Failed";
      order.orderStatus = "Failed";
      order.stripeSessionID = sessionId;
      await order.save();

      console.log(
        `Order ${orderId} marked as failed due to payment status: ${checkoutSession.payment_status}`,
        {
          paymentStatus: order.paymentStatus,
          orderStatus: order.orderStatus,
        }
      );
    }
  } catch (error) {
    console.error("Error in fulfillCheckout:", error);
    throw error;
  }
};

export const webhook = async (request, response) => {
  let event = request.body;

  if (endpointSecret) {
    const signature = request.headers["stripe-signature"];

    try {
      event = stripe.webhooks.constructEvent(
        request.body,
        signature,
        endpointSecret
      );
      console.log(`Webhook signature verified for event: ${event.type}`);
    } catch (err) {
      console.log(`Webhook signature verification failed:`, err.message);
      return response.status(400).send(`Webhook Error: ${err.message}`);
    }
  }

  console.log(`Received webhook event: ${event.type}`);

  try {
    switch (event.type) {
      case "checkout.session.completed":
        await fulfillCheckout(event.data.object.id);
        break;

      case "checkout.session.async_payment_succeeded":
        await fulfillCheckout(event.data.object.id);
        break;

      case "checkout.session.async_payment_failed":
        const failedSession = event.data.object;
        const failedOrderId = failedSession.metadata?.orderId;

        if (failedOrderId) {
          const order = await Order.findById(failedOrderId);
          if (order) {
            order.paymentStatus = "Failed";
            order.orderStatus = "Failed";
            order.stripeSessionID = failedSession.id;
            await order.save();
            console.log(`Order ${failedOrderId} marked as failed`);
          }
        } else {
          console.log("No orderId found in failed session metadata");
        }
        break;

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    response.status(200).json({ received: true });
  } catch (error) {
    console.error("Error processing webhook:", error);
    response.status(500).json({
      error: "Webhook processing failed",
      message: error.message,
    });
  }
};

export const webhookMiddleware = express.raw({ type: "application/json" });