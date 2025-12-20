import Order from "../models/order.model.js";
import QRCode from 'qrcode';
import { 
  generateUniqueId, 
  generateHMAC, 
  createPaymobIntention,
  getBaseUrl 
} from "../utils/paymob.utils.js";

class PaymobService {
  /**
   * Create Paymob payment for order
   * @param {Object} order - The order document
   * @param {Object} req - Express request object
   * @param {String} paymentMethodName - Payment method name ("Paymob-Card" or "Paymob-Wallet")
   */
  async createPaymentForOrder(order, req, paymentMethodName) {
    try {
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
      
      // ✅ FIX: Use integration NAME instead of ID
      const integrationName = paymentMethodName === "Paymob-Card"
        ? "card"  // Use the name from your dashboard
        : "wallet";  // Use the name from your dashboard

      console.log(`Payment Method: ${paymentMethodName}, Integration Name: ${integrationName}`);

      // Get user details
      const user = await order.populate('buyer');
      
      // Create line items from order products
      await order.populate('products.product');
      const items = order.products.map(item => ({
        name: item.product.name,
        amount: Math.round(item.product.price * 100),
        description: item.product.description?.substring(0, 50) || '',
        quantity: item.quantity
      }));

      // Add delivery fee if applicable
      if (order.deliveryFee > 0) {
        items.push({
          name: "Delivery Fee",
          amount: Math.round(order.deliveryFee * 100),
          description: `Delivery to ${order.deliveryLocation?.city || 'location'}`,
          quantity: 1
        });
      }

      // Create Paymob intention
      const result = await createPaymobIntention({
        amount: order.totalPrice,
        integrationName,  // ✅ Pass integration name instead of ID
        userDetails: {
          name: user.buyer.name,
          email: user.buyer.email,
          phoneNumber: user.buyer.phoneNumber,
        },
        uniqueId: uniquePaymentId,
        baseUrl,
        items,
      });

      if (!result.success) {
        throw new Error(result.error);
      }

      // Update order with Paymob data
      order.paymobData = {
        intentionId: result.data.id,
        clientSecret: result.data.client_secret,
        paymentMethods: result.data.payment_methods,
        intentionResponse: result.data
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
      console.error('PaymobService.createPaymentForOrder Error:', error);
      throw error;
    }
  }

  /**
   * Generate QR code for order
   */
  async generateOrderQRCode(order) {
    try {
      const qrPayload = `${order.uniquePaymentId}:${generateHMAC(order.uniquePaymentId)}`;
      const qrCodeImage = await QRCode.toDataURL(qrPayload);
      
      order.qrCodeData = qrPayload;
      order.qrCodeImage = qrCodeImage;
      await order.save();
      
      return qrCodeImage;
    } catch (error) {
      console.error('PaymobService.generateOrderQRCode Error:', error);
      throw error;
    }
  }

  /**
   * Process webhook payment confirmation
   */
  async processWebhookPayment(webhookData) {
    try {
      console.log('Processing webhook:', JSON.stringify(webhookData, null, 2));

      // Find order by unique payment ID
      let order = null;
      let transactionSuccess = false;

      if (webhookData.obj) {
        transactionSuccess = (
          webhookData.obj.success === true ||
          webhookData.obj.success === 'true' ||
          webhookData.obj.pending === false ||
          webhookData.obj.response_code === 200 ||
          webhookData.obj.response_code === '200' ||
          (webhookData.obj.id && !webhookData.obj.error)
        );
      }

      // Try to find by merchant_order_id (special_reference)
      if (webhookData.obj?.merchant_order_id) {
        order = await Order.findOne({ 
          uniquePaymentId: webhookData.obj.merchant_order_id 
        });
        console.log(`Looking for order by merchant_order_id: ${webhookData.obj.merchant_order_id}`);
      }

      // Try to find by extras.ee
      if (!order && webhookData.obj?.payment_key_claims?.extra?.ee) {
        order = await Order.findOne({ 
          uniquePaymentId: webhookData.obj.payment_key_claims.extra.ee 
        });
        console.log(`Looking for order by extras.ee: ${webhookData.obj.payment_key_claims.extra.ee}`);
      }

      if (!order) {
        console.error('Order not found in webhook');
        return { success: false, message: 'Order not found' };
      }

      // Update order based on transaction status
      if (transactionSuccess && webhookData.type === 'TRANSACTION') {
        console.log(`Order found: ${order.uniquePaymentId}, updating to completed`);

        order.paymentStatus = 'Completed';
        order.orderStatus = 'Paid';
        order.paymobData = webhookData;

        // Generate QR code if not exists
        if (!order.qrCodeImage) {
          await this.generateOrderQRCode(order);
        }

        await order.save();
        console.log('Payment completed:', order.uniquePaymentId);

      } else if (!transactionSuccess && webhookData.obj) {
        console.log(`Payment failed: ${order.uniquePaymentId}`);
        order.paymentStatus = 'Failed';
        order.orderStatus = 'Failed';
        order.paymobData = webhookData;
        await order.save();
      }

      return { success: true, order };
    } catch (error) {
      console.error('PaymobService.processWebhookPayment Error:', error);
      throw error;
    }
  }
}

export default new PaymobService();