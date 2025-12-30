// controllers/paymob.controller.js
import Order from "../models/order.model.js";
import PaymobService from "../services/paymob.service.js";
import { verifyPaymobHMAC } from "../utils/paymob.utils.js";

// ==================== WEBHOOK HEALTH CHECK ====================
export const paymobWebhookHealthCheck = (req, res) => {
  console.log('Paymob webhook health check');
  return res.status(200).json({ 
    success: true, 
    message: 'Paymob webhook endpoint is active' 
  });
};

// ==================== HANDLE PAYMOB WEBHOOK ====================
export const handlePaymobWebhook = async (req, res) => {
  try {
    const webhookData = req.body;
    
    console.log('Webhook received:', JSON.stringify(webhookData, null, 2));

    // Verify HMAC if present
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

    return res.json({ 
      success: true,
      message: 'Webhook processed successfully' 
    });

  } catch (error) {
    console.error('Webhook processing error:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Webhook processing failed',
      error: error.message 
    });
  }
};

// ==================== CHECK PAYMENT STATUS ====================
export const checkPaymentStatus = async (req, res) => {
  try {
    const { orderId } = req.params;
    
    if (!orderId) {
      return res.status(400).json({
        success: false,
        message: 'Order ID is required',
      });
    }

    const order = await Order.findById(orderId)
      .select('paymentStatus orderStatus uniquePaymentId paymobIntentionId');

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
        paymobIntentionId: order.paymobIntentionId,
      },
      message: 'Payment status fetched successfully',
    });
  } catch (error) {
    console.error('Error checking payment status:', error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ==================== GET ORDER BY UNIQUE PAYMENT ID ====================
export const getOrderByUniquePaymentId = async (req, res) => {
  try {
    const { uniquePaymentId } = req.params;

    if (!uniquePaymentId) {
      return res.status(400).json({
        success: false,
        message: 'Unique Payment ID is required',
      });
    }

    const order = await Order.findOne({ uniquePaymentId })
      .populate('products.product')
      .populate('address')
      .populate('buyer', '-password -refreshToken -__v')
      .populate('table')
      .populate('paymentMethod');

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found',
      });
    }

    return res.json({
      success: true,
      order,
      message: 'Order fetched successfully',
    });
  } catch (error) {
    console.error('Error fetching order by unique payment ID:', error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};