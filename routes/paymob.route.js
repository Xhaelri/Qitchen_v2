// routes/paymob.route.js
import express from "express";
import PaymobService from "../services/paymob.service.js";
import { verifyPaymobHMAC } from "../utils/paymob.utils.js";

const router = express.Router();

// GET /paymob-webhook - Health check
router.get("/paymob-webhook", (req, res) => {
  console.log('Paymob webhook health check');
  return res.status(200).json({ 
    success: true, 
    message: 'Paymob webhook endpoint is active' 
  });
});

// POST /paymob-webhook - Handle Paymob webhook
router.post("/paymob-webhook", async (req, res) => {
  try {
    const webhookData = req.body;
    
    console.log('Webhook received:', JSON.stringify(webhookData, null, 2));

    if (webhookData.hmac) {
      const isValid = verifyPaymobHMAC(webhookData.obj);
      if (!isValid) {
        console.error('Invalid webhook HMAC');
        return res.status(400).json({ 
          success: false, 
          message: 'Invalid HMAC' 
        });
      }
    }

    // Process webhook
    const result = await PaymobService.processWebhookPayment(webhookData);

    if (!result.success) {
      return res.status(404).json({
        success: false,
        message: result.message,
      });
    }

    return res.json({ success: true });

  } catch (error) {
    console.error('Webhook processing error:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Webhook processing failed' 
    });
  }
});

// GET /order/:orderId/payment-status - Check payment status
router.get("/order/:orderId/payment-status", async (req, res) => {
  try {
    const { orderId } = req.params;
    
    const order = await Order.findById(orderId)
      .select('paymentStatus orderStatus uniquePaymentId qrCodeImage');

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found',
      });
    }

    return res.json({
      success: true,
      order: {
        id: order._id,
        uniquePaymentId: order.uniquePaymentId,
        paymentStatus: order.paymentStatus,
        orderStatus: order.orderStatus,
        qrCodeImage: order.qrCodeImage,
      },
    });
  } catch (error) {
    console.error('Error checking payment status:', error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

export { router };