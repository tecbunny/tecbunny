import type { EmailTemplate, EmailTemplateData } from './types';

const DEFAULT_COMPANY_DATA = {
  companyName: 'TecBunny',
  companyLogo: 'https://fbcsagupcxheyiusjfak.supabase.co/storage/v1/object/public/TecBunny%20Solution/TECBUNNY_SOLUTIONS_PVT_LTD-removebg-preview.png',
  companyEmail: 'support@tecbunny.com',
  companyPhone: '+91 98765 43210',
  companyAddress: '123 Tech Street, Digital City, Tech State 560001',
  websiteUrl: 'https://tecbunny.com'
};

// Common email styles
const EMAIL_STYLES = `
<style>
  body {
    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
    line-height: 1.6;
    color: #333333;
    background-color: #f8fafc;
    margin: 0;
    padding: 0;
  }
  .container {
    max-width: 600px;
    margin: 0 auto;
    background-color: #ffffff;
    border-radius: 12px;
    overflow: hidden;
    box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  }
  .header {
    background: linear-gradient(135deg, #16a34a 0%, #2563eb 100%);
    color: white;
    padding: 30px 40px;
    text-align: center;
  }
  .header h1 {
    margin: 0;
    font-size: 28px;
    font-weight: 700;
  }
  .content {
    padding: 40px;
  }
  .otp-box {
    background: linear-gradient(135deg, #f0f9ff 0%, #ecfdf5 100%);
    border: 2px dashed #16a34a;
    border-radius: 8px;
    padding: 20px;
    text-align: center;
    margin: 20px 0;
  }
  .otp-code {
    font-size: 32px;
    font-weight: bold;
    color: #16a34a;
    letter-spacing: 8px;
    margin: 10px 0;
    font-family: 'Courier New', monospace;
  }
  .button {
    display: inline-block;
    background: linear-gradient(135deg, #16a34a 0%, #2563eb 100%);
    color: white;
    padding: 12px 30px;
    text-decoration: none;
    border-radius: 8px;
    font-weight: 600;
    margin: 20px 0;
  }
  .order-summary {
    background-color: #f8fafc;
    border-radius: 8px;
    padding: 20px;
    margin: 20px 0;
  }
  .order-item {
    display: flex;
    justify-content: space-between;
    padding: 10px 0;
    border-bottom: 1px solid #e2e8f0;
  }
  .order-item:last-child {
    border-bottom: none;
    font-weight: bold;
    padding-top: 15px;
  }
  .footer {
    background-color: #f1f5f9;
    padding: 30px 40px;
    text-align: center;
    color: #64748b;
    font-size: 14px;
  }
  .warning {
    background-color: #fef3c7;
    border-left: 4px solid #f59e0b;
    padding: 15px;
    margin: 20px 0;
    border-radius: 0 8px 8px 0;
  }
  .success {
    background-color: #d1fae5;
    border-left: 4px solid #10b981;
    padding: 15px;
    margin: 20px 0;
    border-radius: 0 8px 8px 0;
  }
  .pickup-code {
    background: linear-gradient(135deg, #7c3aed 0%, #ec4899 100%);
    color: white;
    padding: 20px;
    border-radius: 8px;
    text-align: center;
    margin: 20px 0;
  }
  .pickup-code-text {
    font-size: 24px;
    font-weight: bold;
    letter-spacing: 4px;
    font-family: 'Courier New', monospace;
  }
</style>
`;

export function generateEmailTemplate(templateType: string, data: EmailTemplateData): EmailTemplate {
  const companyData = { ...DEFAULT_COMPANY_DATA, ...data };
  
  switch (templateType) {
    case 'email_otp_verification':
      return {
        subject: `Verify Your Email - OTP: ${data.otp}`,
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Email Verification</title>
            ${EMAIL_STYLES}
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>🔐 Email Verification</h1>
              </div>
              <div class="content">
                <h2>Hello ${data.userName || 'User'}!</h2>
                <p>Welcome to <strong>${companyData.companyName}</strong>! Please verify your email address to complete your registration.</p>
                
                <div class="otp-box">
                  <p><strong>Your verification code is:</strong></p>
                  <div class="otp-code">${data.otp}</div>
                  <p>This code will expire in ${data.otpExpiryMinutes || 10} minutes.</p>
                </div>
                
                <div class="warning">
                  <strong>Security Notice:</strong> Never share this code with anyone. Our team will never ask for your verification code.
                </div>
                
                <p>If you didn't request this verification, please ignore this email.</p>
                
                <p>Best regards,<br>
                The ${companyData.companyName} Team</p>
              </div>
              <div class="footer">
                <p>${companyData.companyName} | ${companyData.companyEmail} | ${companyData.companyPhone}</p>
                <p>${companyData.companyAddress}</p>
              </div>
            </div>
          </body>
          </html>
        `,
        text: `Email Verification - ${companyData.companyName}\n\nHello ${data.userName || 'User'}!\n\nYour verification code is: ${data.otp}\n\nThis code will expire in ${data.otpExpiryMinutes || 10} minutes.\n\nIf you didn't request this verification, please ignore this email.\n\nBest regards,\nThe ${companyData.companyName} Team`
      };

    case 'welcome_email':
      return {
        subject: `Welcome to ${companyData.companyName}! 🎉`,
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Welcome</title>
            ${EMAIL_STYLES}
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>🎉 Welcome to ${companyData.companyName}!</h1>
              </div>
              <div class="content">
                <h2>Hello ${data.userName || 'User'}!</h2>
                <p>Congratulations! Your email has been successfully verified and your account is now active.</p>
                
                <div class="success">
                  <strong>Account Successfully Created!</strong><br>
                  You can now enjoy all the benefits of being a ${companyData.companyName} member.
                </div>
                
                <h3>What's Next?</h3>
                <ul>
                  <li>🛍️ Browse our latest products and exclusive deals</li>
                  <li>💰 Enjoy member-only discounts and early access</li>
                  <li>📦 Track your orders in real-time</li>
                  <li>💬 Get priority customer support</li>
                </ul>
                
                <a href="${companyData.websiteUrl}/products" class="button">Start Shopping Now</a>
                
                <p>If you have any questions, our support team is here to help!</p>
                
                <p>Happy shopping!<br>
                The ${companyData.companyName} Team</p>
              </div>
              <div class="footer">
                <p>${companyData.companyName} | ${companyData.companyEmail} | ${companyData.companyPhone}</p>
                <p>${companyData.companyAddress}</p>
              </div>
            </div>
          </body>
          </html>
        `,
        text: `Welcome to ${companyData.companyName}!\n\nHello ${data.userName || 'User'}!\n\nCongratulations! Your email has been successfully verified and your account is now active.\n\nYou can now browse our products, enjoy member discounts, and track your orders.\n\nStart shopping: ${companyData.websiteUrl}/products\n\nHappy shopping!\nThe ${companyData.companyName} Team`
      };

    case 'order_placed':
      return {
        subject: `Order Confirmation #${data.orderId} - Thank You!`,
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Order Confirmation</title>
            ${EMAIL_STYLES}
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>📦 Order Confirmed!</h1>
              </div>
              <div class="content">
                <h2>Thank you, ${data.userName || 'Valued Customer'}!</h2>
                <p>Your order has been successfully placed and we're preparing it for you.</p>
                
                <div class="success">
                  <strong>Order #${data.orderId}</strong><br>
                  Placed on ${data.orderDate || new Date().toLocaleDateString()}
                </div>
                
                <div class="order-summary">
                  <h3>Order Summary</h3>
                  ${data.orderItems?.map(item => `
                    <div class="order-item">
                      <span>${item.name} (×${item.quantity})</span>
                      <span>₹${(item.price * item.quantity).toFixed(2)}</span>
                    </div>
                  `).join('') || ''}
                  <div class="order-item">
                    <span><strong>Total Amount</strong></span>
                    <span><strong>₹${data.orderTotal?.toFixed(2) || '0.00'}</strong></span>
                  </div>
                </div>
                
                ${data.deliveryAddress ? `
                  <h3>Delivery Address</h3>
                  <p>${data.deliveryAddress}</p>
                ` : ''}
                
                <h3>What's Next?</h3>
                <ul>
                  <li>📧 You'll receive a payment confirmation email shortly</li>
                  <li>📦 We'll notify you when your order ships</li>
                  <li>🔍 Track your order anytime on our website</li>
                </ul>
                
                <a href="${companyData.websiteUrl}/orders/${data.orderId}" class="button">Track Your Order</a>
                
                <p>Thank you for choosing ${companyData.companyName}!</p>
                
                <p>Best regards,<br>
                The ${companyData.companyName} Team</p>
              </div>
              <div class="footer">
                <p>${companyData.companyName} | ${companyData.companyEmail} | ${companyData.companyPhone}</p>
                <p>${companyData.companyAddress}</p>
              </div>
            </div>
          </body>
          </html>
        `,
        text: `Order Confirmation #${data.orderId}\n\nThank you, ${data.userName || 'Valued Customer'}!\n\nYour order has been successfully placed.\n\nOrder Details:\n${data.orderItems?.map(item => `${item.name} (×${item.quantity}) - ₹${(item.price * item.quantity).toFixed(2)}`).join('\n') || ''}\n\nTotal: ₹${data.orderTotal?.toFixed(2) || '0.00'}\n\nTrack your order: ${companyData.websiteUrl}/orders/${data.orderId}\n\nThank you for choosing ${companyData.companyName}!`
      };

    case 'payment_confirmed':
      return {
        subject: `Payment Confirmed for Order #${data.orderId}`,
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Payment Confirmed</title>
            ${EMAIL_STYLES}
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>💳 Payment Confirmed!</h1>
              </div>
              <div class="content">
                <h2>Great news, ${data.userName || 'Valued Customer'}!</h2>
                <p>Your payment has been successfully processed and confirmed.</p>
                
                <div class="success">
                  <strong>Payment Successful</strong><br>
                  Order #${data.orderId} | ₹${data.orderTotal?.toFixed(2) || '0.00'}
                </div>
                
                <h3>Payment Details</h3>
                <ul>
                  <li><strong>Payment Method:</strong> ${data.paymentMethod || 'Not specified'}</li>
                  <li><strong>Transaction ID:</strong> ${data.transactionId || 'N/A'}</li>
                  <li><strong>Amount:</strong> ₹${data.orderTotal?.toFixed(2) || '0.00'}</li>
                  <li><strong>Status:</strong> Confirmed ✅</li>
                </ul>
                
                <h3>What's Next?</h3>
                <ul>
                  <li>📦 Your order is now being processed</li>
                  <li>🚚 You'll receive shipping updates soon</li>
                  <li>📱 Track your order in real-time</li>
                </ul>
                
                <a href="${companyData.websiteUrl}/orders/${data.orderId}" class="button">Track Your Order</a>
                
                <p>Thank you for your business!</p>
                
                <p>Best regards,<br>
                The ${companyData.companyName} Team</p>
              </div>
              <div class="footer">
                <p>${companyData.companyName} | ${companyData.companyEmail} | ${companyData.companyPhone}</p>
                <p>${companyData.companyAddress}</p>
              </div>
            </div>
          </body>
          </html>
        `,
        text: `Payment Confirmed - Order #${data.orderId}\n\nGreat news, ${data.userName || 'Valued Customer'}!\n\nYour payment of ₹${data.orderTotal?.toFixed(2) || '0.00'} has been successfully processed.\n\nPayment Method: ${data.paymentMethod || 'Not specified'}\nTransaction ID: ${data.transactionId || 'N/A'}\n\nYour order is now being processed.\n\nTrack your order: ${companyData.websiteUrl}/orders/${data.orderId}\n\nThank you!`
      };

    case 'payment_failed':
      return {
        subject: `Payment Failed for Order #${data.orderId} - Action Required`,
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Payment Failed</title>
            ${EMAIL_STYLES}
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>❌ Payment Failed</h1>
              </div>
              <div class="content">
                <h2>Hello ${data.userName || 'Customer'},</h2>
                <p>We attempted to process your payment for order <strong>#${data.orderId}</strong> but it failed.</p>
                <div class="warning">
                  Please retry your payment to avoid cancellation. If you were charged, it will be automatically reversed by your bank.
                </div>
                <ul>
                  <li><strong>Payment Method:</strong> ${data.paymentMethod || 'Not specified'}</li>
                  <li><strong>Transaction ID:</strong> ${data.transactionId || 'N/A'}</li>
                  <li><strong>Amount:</strong> ₹${data.orderTotal?.toFixed(2) || '0.00'}</li>
                  <li><strong>Status:</strong> Failed ❌</li>
                </ul>
                <a href="${companyData.websiteUrl}/orders/${data.orderId}/pay" class="button">Retry Payment</a>
                <p>If the issue persists, please contact support.</p>
                <p>Regards,<br>The ${companyData.companyName} Team</p>
              </div>
              <div class="footer">
                <p>${companyData.companyName} | ${companyData.companyEmail} | ${companyData.companyPhone}</p>
                <p>${companyData.companyAddress}</p>
              </div>
            </div>
          </body>
          </html>
        `,
        text: `Payment Failed - Order #${data.orderId}\n\nHello ${data.userName || 'Customer'},\n\nYour payment failed. Amount: ₹${data.orderTotal?.toFixed(2) || '0.00'}.\nRetry: ${companyData.websiteUrl}/orders/${data.orderId}/pay\n\nSupport: ${companyData.companyEmail}`
      };

    case 'payment_pending':
      return {
        subject: `Payment Under Process for Order #${data.orderId}`,
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Payment Pending</title>
            ${EMAIL_STYLES}
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>⏳ Payment Under Process</h1>
              </div>
              <div class="content">
                <h2>Hello ${data.userName || 'Customer'},</h2>
                <p>Your payment for order <strong>#${data.orderId}</strong> is currently being processed.</p>
                <div class="warning">
                  Most banks confirm within a few minutes. We will notify you once it's confirmed.
                </div>
                <ul>
                  <li><strong>Payment Method:</strong> ${data.paymentMethod || 'Not specified'}</li>
                  <li><strong>Transaction ID:</strong> ${data.transactionId || 'N/A'}</li>
                  <li><strong>Amount:</strong> ₹${data.orderTotal?.toFixed(2) || '0.00'}</li>
                  <li><strong>Status:</strong> Pending ⏳</li>
                </ul>
                <a href="${companyData.websiteUrl}/orders/${data.orderId}" class="button">View Order Status</a>
                <p>Thank you for your patience.</p>
                <p>Regards,<br>The ${companyData.companyName} Team</p>
              </div>
              <div class="footer">
                <p>${companyData.companyName} | ${companyData.companyEmail} | ${companyData.companyPhone}</p>
                <p>${companyData.companyAddress}</p>
              </div>
            </div>
          </body>
          </html>
        `,
        text: `Payment Pending - Order #${data.orderId}\n\nHello ${data.userName || 'Customer'},\n\nYour payment is under process. We'll update you shortly.\nOrder: #${data.orderId} Amount: ₹${data.orderTotal?.toFixed(2) || '0.00'}\nTrack: ${companyData.websiteUrl}/orders/${data.orderId}`
      };

    case 'shipping_notification':
      return {
        subject: `📦 Your Order #${data.orderId} Has Shipped!`,
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Order Shipped</title>
            ${EMAIL_STYLES}
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>🚚 Your Order Has Shipped!</h1>
              </div>
              <div class="content">
                <h2>Exciting news, ${data.userName || 'Valued Customer'}!</h2>
                <p>Your order is on its way to you!</p>
                
                <div class="success">
                  <strong>Order #${data.orderId} - In Transit</strong><br>
                  Estimated delivery: ${data.estimatedDelivery || 'Soon'}
                </div>
                
                <h3>Shipping Details</h3>
                <ul>
                  <li><strong>Tracking Number:</strong> ${data.trackingNumber || 'Available soon'}</li>
                  <li><strong>Carrier:</strong> Premium Express</li>
                  <li><strong>Estimated Delivery:</strong> ${data.estimatedDelivery || 'Soon'}</li>
                  <li><strong>Delivery Address:</strong><br>${data.deliveryAddress || 'On file'}</li>
                </ul>
                
                <h3>Track Your Package</h3>
                <p>Stay updated with real-time tracking information:</p>
                
                <a href="${companyData.websiteUrl}/track/${data.trackingNumber}" class="button">Track Package</a>
                
                <div class="warning">
                  <strong>Delivery Tips:</strong><br>
                  • Please ensure someone is available to receive the package<br>
                  • Keep your phone accessible for delivery updates<br>
                  • Have a valid ID ready for verification
                </div>
                
                <p>We're excited for you to receive your order!</p>
                
                <p>Best regards,<br>
                The ${companyData.companyName} Team</p>
              </div>
              <div class="footer">
                <p>${companyData.companyName} | ${companyData.companyEmail} | ${companyData.companyPhone}</p>
                <p>${companyData.companyAddress}</p>
              </div>
            </div>
          </body>
          </html>
        `,
        text: `Your Order #${data.orderId} Has Shipped!\n\nExciting news, ${data.userName || 'Valued Customer'}!\n\nYour order is on its way!\n\nTracking Number: ${data.trackingNumber || 'Available soon'}\nEstimated Delivery: ${data.estimatedDelivery || 'Soon'}\n\nTrack your package: ${companyData.websiteUrl}/track/${data.trackingNumber}\n\nThank you!`
      };

    case 'ready_for_pickup':
      return {
        subject: `🏪 Order #${data.orderId} Ready for Pickup!`,
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Ready for Pickup</title>
            ${EMAIL_STYLES}
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>🏪 Ready for Pickup!</h1>
              </div>
              <div class="content">
                <h2>Good news, ${data.userName || 'Valued Customer'}!</h2>
                <p>Your order is ready for pickup at our store!</p>
                
                <div class="pickup-code">
                  <p><strong>Your Pickup Code:</strong></p>
                  <div class="pickup-code-text">${data.pickupCode || 'PICKUP123'}</div>
                  <p>Show this code at the store</p>
                </div>
                
                <div class="success">
                  <strong>Order #${data.orderId}</strong><br>
                  Ready for pickup since ${new Date().toLocaleDateString()}
                </div>
                
                <h3>Pickup Information</h3>
                <ul>
                  <li><strong>Store Address:</strong><br>${companyData.companyAddress}</li>
                  <li><strong>Store Hours:</strong> Mon-Sat: 10:00 AM - 8:00 PM</li>
                  <li><strong>Contact:</strong> ${companyData.companyPhone}</li>
                  <li><strong>Pickup Code:</strong> ${data.pickupCode || 'PICKUP123'}</li>
                </ul>
                
                <h3>What to Bring</h3>
                <ul>
                  <li>📱 This email with your pickup code</li>
                  <li>🆔 Valid government-issued photo ID</li>
                  <li>💳 Credit card used for payment (if applicable)</li>
                </ul>
                
                <div class="warning">
                  <strong>Important:</strong><br>
                  • Orders are held for 7 days from notification<br>
                  • Please bring valid ID for verification<br>
                  • Call us if you need to arrange alternative pickup
                </div>
                
                <a href="tel:${companyData.companyPhone}" class="button">Call Store</a>
                
                <p>We look forward to seeing you!</p>
                
                <p>Best regards,<br>
                The ${companyData.companyName} Team</p>
              </div>
              <div class="footer">
                <p>${companyData.companyName} | ${companyData.companyEmail} | ${companyData.companyPhone}</p>
                <p>${companyData.companyAddress}</p>
              </div>
            </div>
          </body>
          </html>
        `,
        text: `Order #${data.orderId} Ready for Pickup!\n\nGood news, ${data.userName || 'Valued Customer'}!\n\nYour order is ready for pickup!\n\nPickup Code: ${data.pickupCode || 'PICKUP123'}\n\nStore Address: ${companyData.companyAddress}\nStore Hours: Mon-Sat: 10:00 AM - 8:00 PM\nPhone: ${companyData.companyPhone}\n\nPlease bring this pickup code and a valid ID.\n\nSee you soon!`
      };

    case 'order_delivered':
      return {
        subject: `🎉 Order #${data.orderId} Delivered - Hope You Love It!`,
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Order Delivered</title>
            ${EMAIL_STYLES}
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>📦 Delivered!</h1>
              </div>
              <div class="content">
                <h2>Hi ${data.userName || 'Customer'},</h2>
                <p>Your order <strong>#${data.orderId}</strong> has been delivered.</p>
                <div class="success">
                  We hope you enjoy your purchase. We'd love your feedback!
                </div>
                <a href="${companyData.websiteUrl}/orders/${data.orderId}/review" class="button">Leave a Review</a>
                <p>Need help? Contact us at ${companyData.companyEmail}.</p>
                <p>— ${companyData.companyName} Team</p>
              </div>
              <div class="footer">
                <p>${companyData.companyName} | ${companyData.companyEmail} | ${companyData.companyPhone}</p>
                <p>${companyData.companyAddress}</p>
              </div>
            </div>
          </body>
          </html>
        `,
        text: `Order #${data.orderId} Delivered\n\nHi ${data.userName || 'Customer'}, your order has been delivered.\nReview: ${companyData.websiteUrl}/orders/${data.orderId}/review\nSupport: ${companyData.companyEmail}`
      };

    case 'order_completed':
      return {
        subject: `✅ Order #${data.orderId} Completed - Thank You!`,
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Order Completed</title>
            ${EMAIL_STYLES}
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>✅ Order Completed!</h1>
              </div>
              <div class="content">
                <h2>Thank you, ${data.userName || 'Valued Customer'}!</h2>
                <p>Your order has been successfully completed. We hope you love your purchase!</p>
                
                <div class="success">
                  <strong>Order #${data.orderId} - Completed</strong><br>
                  Delivered/Picked up on ${new Date().toLocaleDateString()}
                </div>
                
                <h3>📝 How was your experience?</h3>
                <p>Your feedback helps us improve our service and helps other customers make informed decisions.</p>
                
                <a href="${companyData.websiteUrl}/orders/${data.orderId}/review" class="button">Leave a Review</a>
                
                <h3>🎯 What's Next?</h3>
                <ul>
                  <li>💬 Share your experience and leave a product review</li>
                  <li>🛍️ Browse our latest arrivals and exclusive deals</li>
                  <li>📧 Join our newsletter for special offers</li>
                  <li>👥 Follow us on social media for updates</li>
                </ul>
                
                <h3>💫 Exclusive Offer</h3>
                <div class="success">
                  Enjoy <strong>10% OFF</strong> your next purchase!<br>
                  Use code: <strong>LOYAL10</strong> at checkout
                </div>
                
                <a href="${companyData.websiteUrl}/products" class="button">Shop Again</a>
                
                <p>Thank you for choosing ${companyData.companyName}. We appreciate your business and look forward to serving you again!</p>
                
                <p>Best regards,<br>
                The ${companyData.companyName} Team</p>
              </div>
              <div class="footer">
                <p>${companyData.companyName} | ${companyData.companyEmail} | ${companyData.companyPhone}</p>
                <p>${companyData.companyAddress}</p>
              </div>
            </div>
          </body>
          </html>
        `,
        text: `Order #${data.orderId} Completed!\n\nThank you, ${data.userName || 'Valued Customer'}!\n\nYour order has been successfully completed.\n\nLeave a review: ${companyData.websiteUrl}/orders/${data.orderId}/review\n\nEnjoy 10% OFF your next purchase with code: LOYAL10\n\nShop again: ${companyData.websiteUrl}/products\n\nThank you for choosing ${companyData.companyName}!`
      };

    case 'password_reset_otp':
      return {
        subject: `Password Reset Code - ${data.otp}`,
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Password Reset</title>
            ${EMAIL_STYLES}
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>🔒 Password Reset</h1>
              </div>
              <div class="content">
                <h2>Hello ${data.userName || 'User'}!</h2>
                <p>We received a request to reset your password for your ${companyData.companyName} account.</p>
                
                <div class="otp-box">
                  <p><strong>Your password reset code is:</strong></p>
                  <div class="otp-code">${data.otp}</div>
                  <p>This code will expire in ${data.otpExpiryMinutes || 10} minutes.</p>
                </div>
                
                <h3>How to reset your password:</h3>
                <ol>
                  <li>Go to the password reset page</li>
                  <li>Enter the code above</li>
                  <li>Create your new password</li>
                  <li>Confirm and save</li>
                </ol>
                
                <div class="warning">
                  <strong>Security Notice:</strong><br>
                  • If you didn't request this reset, please ignore this email<br>
                  • Never share this code with anyone<br>
                  • This code expires in ${data.otpExpiryMinutes || 10} minutes<br>
                  • Contact support if you need help
                </div>
                
                <a href="${companyData.websiteUrl}/reset-password" class="button">Reset Password</a>
                
                <p>For security reasons, this link will expire soon. If you need assistance, please contact our support team.</p>
                
                <p>Best regards,<br>
                The ${companyData.companyName} Team</p>
              </div>
              <div class="footer">
                <p>${companyData.companyName} | ${companyData.companyEmail} | ${companyData.companyPhone}</p>
                <p>${companyData.companyAddress}</p>
              </div>
            </div>
          </body>
          </html>
        `,
        text: `Password Reset - ${companyData.companyName}\n\nHello ${data.userName || 'User'}!\n\nYour password reset code is: ${data.otp}\n\nThis code will expire in ${data.otpExpiryMinutes || 10} minutes.\n\nReset your password: ${companyData.websiteUrl}/reset-password\n\nIf you didn't request this reset, please ignore this email.\n\nBest regards,\nThe ${companyData.companyName} Team`
      };

    case 'email_change_otp':
      return {
        subject: `Email Change Verification - ${data.otp}`,
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Email Change Verification</title>
            ${EMAIL_STYLES}
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>📧 Email Change Verification</h1>
              </div>
              <div class="content">
                <h2>Hello ${data.userName || 'User'}!</h2>
                <p>We received a request to change the email address associated with your ${companyData.companyName} account.</p>
                
                <div class="otp-box">
                  <p><strong>Your verification code is:</strong></p>
                  <div class="otp-code">${data.otp}</div>
                  <p>This code will expire in ${data.otpExpiryMinutes || 10} minutes.</p>
                </div>
                
                <h3>To complete the email change:</h3>
                <ol>
                  <li>Return to the email change page</li>
                  <li>Enter the verification code above</li>
                  <li>Confirm your new email address</li>
                  <li>Save changes</li>
                </ol>
                
                <div class="warning">
                  <strong>Important Security Information:</strong><br>
                  • This email was sent to your current email address<br>
                  • If you didn't request this change, secure your account immediately<br>
                  • Change your password if you suspect unauthorized access<br>
                  • Contact support if you need assistance
                </div>
                
                <a href="${companyData.websiteUrl}/profile/email" class="button">Complete Email Change</a>
                
                <p>If you didn't request this email change, please contact our support team immediately.</p>
                
                <p>Best regards,<br>
                The ${companyData.companyName} Team</p>
              </div>
              <div class="footer">
                <p>${companyData.companyName} | ${companyData.companyEmail} | ${companyData.companyPhone}</p>
                <p>${companyData.companyAddress}</p>
              </div>
            </div>
          </body>
          </html>
        `,
        text: `Email Change Verification - ${companyData.companyName}\n\nHello ${data.userName || 'User'}!\n\nYour email change verification code is: ${data.otp}\n\nThis code will expire in ${data.otpExpiryMinutes || 10} minutes.\n\nComplete email change: ${companyData.websiteUrl}/profile/email\n\nIf you didn't request this change, please contact support immediately.\n\nBest regards,\nThe ${companyData.companyName} Team`
      };

    case 'marketing_campaign':
      return {
        subject: `${data.campaignTitle || 'Don\'t miss out!'} | ${companyData.companyName}`,
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Marketing Campaign</title>
            ${EMAIL_STYLES}
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>${data.campaignTitle || 'Special Offers for You'}</h1>
              </div>
              <div class="content">
                ${data.bannerImageUrl ? `<img src="${data.bannerImageUrl}" alt="Offer" style="width:100%;border-radius:8px;"/>` : ''}
                <p>${data.campaignBody || 'Discover our latest deals and new arrivals tailored for you.'}</p>
                ${data.discountCode ? `<div class="success">Use code <strong>${data.discountCode}</strong> at checkout</div>` : ''}
                ${data.ctaUrl ? `<a href="${data.ctaUrl}" class="button">${data.ctaText || 'Shop Now'}</a>` : ''}
                <p>Visit us: ${companyData.websiteUrl}</p>
              </div>
              <div class="footer">
                <p>${companyData.companyName} | ${companyData.companyEmail} | ${companyData.companyPhone}</p>
                <p>${companyData.companyAddress}</p>
              </div>
            </div>
          </body>
          </html>
        `,
        text: `${data.campaignTitle || 'Special Offers'}\n\n${data.campaignBody || ''}\n${data.ctaUrl ? `Shop: ${data.ctaUrl}` : ''}`
      };

    case 'abandoned_cart':
      return {
        subject: `You left items in your cart 🛒 | ${companyData.companyName}`,
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Abandoned Cart</title>
            ${EMAIL_STYLES}
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>Forgot something?</h1>
              </div>
              <div class="content">
                <h2>Hi ${data.userName || 'there'},</h2>
                <p>Looks like you left some great items in your cart${data.minutesSinceAbandoned ? ` ${data.minutesSinceAbandoned} minutes ago` : ''}.</p>
                <div class="order-summary">
                  <h3>Your Cart</h3>
                  ${data.cartItems?.map(item => `
                    <div class="order-item">
                      <span>${item.name} (×${item.quantity})</span>
                      <span>₹${(item.price * item.quantity).toFixed(2)}</span>
                    </div>
                  `).join('') || '<p>Your items are waiting!</p>'}
                </div>
                ${data.discountCode ? `<div class="success">Use code <strong>${data.discountCode}</strong> for a special discount!</div>` : ''}
                <a href="${data.restoreCartUrl || `${companyData.websiteUrl  }/cart`}" class="button">Return to Cart</a>
                <p>Need help? Reply to this email and we\'ll assist you.</p>
              </div>
              <div class="footer">
                <p>${companyData.companyName} | ${companyData.companyEmail} | ${companyData.companyPhone}</p>
                <p>${companyData.companyAddress}</p>
              </div>
            </div>
          </body>
          </html>
        `,
        text: `You left items in your cart\n\nReturn: ${data.restoreCartUrl || `${companyData.websiteUrl  }/cart`}`
      };

    case 'order_notification_manager':
      return {
        subject: `New Order #${data.orderId} Received`,
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>New Order</title>
            ${EMAIL_STYLES}
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>New Order Received</h1>
              </div>
              <div class="content">
                <p>Order <strong>#${data.orderId}</strong> has been placed.</p>
                <div class="order-summary">
                  ${data.orderItems?.map(item => `
                    <div class="order-item">
                      <span>${item.name} (×${item.quantity})</span>
                      <span>₹${(item.price * item.quantity).toFixed(2)}</span>
                    </div>
                  `).join('') || ''}
                  <div class="order-item">
                    <span><strong>Total</strong></span>
                    <span><strong>₹${data.orderTotal?.toFixed(2) || '0.00'}</strong></span>
                  </div>
                </div>
                <a href="${companyData.websiteUrl}/admin/orders/${data.orderId}" class="button">View in Dashboard</a>
              </div>
            </div>
          </body>
          </html>
        `,
        text: `New order #${data.orderId} received. Total: ₹${data.orderTotal?.toFixed(2) || '0.00'}`
      };

    case 'order_approved_admin':
      return {
        subject: `Order #${data.orderId} Approved`,
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Order Approved</title>
            ${EMAIL_STYLES}
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>Order Approved</h1>
              </div>
              <div class="content">
                <p>Order <strong>#${data.orderId}</strong> has been approved and is now confirmed.</p>
                <div class="order-summary">
                  <div class="order-item">
                    <span>Status</span>
                    <span><strong>Confirmed</strong></span>
                  </div>
                  ${data.userName ? `
                    <div class="order-item">
                      <span>Customer</span>
                      <span>${data.userName}</span>
                    </div>
                  ` : ''}
                  ${typeof data.orderTotal === 'number' ? `
                    <div class="order-item">
                      <span>Total Value</span>
                      <span>₹${data.orderTotal.toFixed(2)}</span>
                    </div>
                  ` : ''}
                  ${data.orderType ? `
                    <div class="order-item">
                      <span>Order Type</span>
                      <span>${data.orderType}</span>
                    </div>
                  ` : ''}
                </div>
                <a href="${companyData.websiteUrl}/orders/${data.orderId}" class="button">View Order</a>
                <p class="mt-4">This message confirms that the order has passed the approval step and is ready for the next action.</p>
              </div>
              <div class="footer">
                <p>${companyData.companyName} | ${companyData.companyEmail} | ${companyData.companyPhone}</p>
                <p>${companyData.companyAddress}</p>
              </div>
            </div>
          </body>
          </html>
        `,
  text: `Order #${data.orderId} approved and confirmed.
${data.userName ? `Customer: ${data.userName}\n` : ''}${typeof data.orderTotal === 'number' ? `Total: ₹${data.orderTotal.toFixed(2)}\n` : ''}${data.orderType ? `Type: ${data.orderType}\n` : ''}`
      };

    case 'order_notification_sales_pickup':
      return {
        subject: `Pickup Order #${data.orderId} - Action Needed`,
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Pickup Order</title>
            ${EMAIL_STYLES}
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>Pickup Order Assigned</h1>
              </div>
              <div class="content">
                <p>Order <strong>#${data.orderId}</strong> is a pickup order. Please prepare and notify the customer.</p>
                <a href="${companyData.websiteUrl}/admin/orders/${data.orderId}" class="button">View Order</a>
              </div>
            </div>
          </body>
          </html>
        `,
        text: `Pickup order #${data.orderId} assigned. Prepare and notify customer.`
      };

    case 'general_update':
      return {
        subject: `${data.updateTitle || 'Latest Update'} | ${companyData.companyName}`,
        html: `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Latest Update</title>
            ${EMAIL_STYLES}
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h1>${data.updateTitle || 'Latest Update'}</h1>
              </div>
              <div class="content">
                <h2>Hello ${data.userName || 'there'},</h2>
                <div style="background-color: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
                   ${data.updateBody ? `<p>${data.updateBody}</p>` : ''}
                </div>
                ${data.updateDate ? `<p style="font-size: 12px; color: #64748b;">Update posted on: ${data.updateDate}</p>` : ''}
                
                <a href="${companyData.websiteUrl}" class="button">Visit Dashboard</a>
                
                <p>Best regards,<br>
                The ${companyData.companyName} Team</p>
              </div>
              <div class="footer">
                <p>${companyData.companyName} | ${companyData.companyEmail} | ${companyData.companyPhone}</p>
                <p>${companyData.companyAddress}</p>
              </div>
            </div>
          </body>
          </html>
        `,
        text: `${data.updateTitle || 'Latest Update'}\n\nHello ${data.userName || 'there'},\n\n${data.updateBody || ''}\n\nVisit: ${companyData.websiteUrl}`
      };

    default:
      throw new Error(`Unknown email template type: ${templateType}`);
  }
}
