const { onDocumentCreated, onDocumentUpdated } = require("firebase-functions/v2/firestore");
const { defineSecret } = require("firebase-functions/params");
const { Resend } = require("resend");
const React = require("react");
const { renderAsync } = require("@react-email/components");

// Register Babel to transpile JSX template dynamically
require("@babel/register")({
  presets: ["@babel/preset-react"],
  ignore: [/node_modules/]
});

const ReceiptEmail = require("./templates/ReceiptEmail.jsx");

// Define Firebase Secret for Resend API Key
const resendApiKey = defineSecret("RESEND_API_KEY");

exports.onOrderCreated = onDocumentCreated({
  document: "orders/{orderId}",
  secrets: [resendApiKey]
}, async (event) => {
  const snapshot = event.data;
  if (!snapshot) {
    console.log("No data associated with the event");
    return;
  }

  const order = snapshot.data();
  const orderId = event.params.orderId.substring(0, 8).toUpperCase();

  const customerEmail = order.custEmail;
  if (!customerEmail) {
    console.log(`Order ${orderId} has no customer email address.`);
    return;
  }

  try {
    // Format order items array
    const items = [
      {
        description: order.items || "Farm Reservation",
        price: order.total || 0
      }
    ];

    // Render React Email Component to HTML string
    const emailHtml = await renderAsync(
      React.createElement(ReceiptEmail, {
        customerName: order.custName || "Valued Customer",
        orderId: orderId,
        orderItems: items,
        totalAmount: order.total || 0,
        pickupDate: order.pickupDate || "Scheduled Date",
        pickupTime: order.pickupTime || "Scheduled Window",
        pickupAddress: order.pickupAddress || "Castroville, TX 78009",
        pickupDetails: "Please have Cash, Venmo, or Credit Card ready at pickup.",
        businessLogoUrl: "https://rodriguezranch.netlify.app/assets/ranch_logo.png"
      })
    );

    // Initialize Resend SDK
    const resend = new Resend(resendApiKey.value());

    // Send Email via Resend
    const response = await resend.emails.send({
      from: "Rodriguez Ranch <onboarding@resend.dev>", // Replace with your verified domain (e.g. orders@rodriguezranch.com)
      to: [customerEmail],
      subject: `Order Receipt & Pickup Instructions #${orderId} - Rodriguez Ranch`,
      html: emailHtml
    });
    console.log(`Receipt email sent successfully for Order ${orderId}:`, response);

    // Send admin alert via Resend
    try {
      await resend.emails.send({
        from: "Rodriguez Ranch <onboarding@resend.dev>",
        to: ["morganmv145@gmail.com"],
        subject: `🚨 New Order Received! #${orderId}`,
        html: `<p>A new order for ${order.items || 'items'} ($${order.total || 0}) has been placed by ${order.custName || 'a customer'}.</p>
               <p>Pickup: ${order.pickupDate} at ${order.pickupTime}</p>
               <p><a href="https://rodriguezranch.netlify.app">Log into your dashboard</a> to manage this order.</p>`
      });
      console.log(`Admin alert sent successfully for Order ${orderId}`);
    } catch (adminError) {
      console.error(`Failed to send admin alert for Order ${orderId}:`, adminError);
    }
  } catch (error) {
    console.error(`Failed to send receipt email for Order ${orderId}:`, error);
  }
});

exports.onOrderUpdated = onDocumentUpdated({
  document: "orders/{orderId}",
  secrets: [resendApiKey]
}, async (event) => {
  const change = event.data;
  if (!change) return;

  const before = change.before.data();
  const after = change.after.data();

  // Only trigger if status changed to 'Rejected'
  if (after.status === 'Rejected' && before.status !== 'Rejected') {
    const orderId = event.params.orderId.substring(0, 8).toUpperCase();
    const customerEmail = after.custEmail;
    if (!customerEmail) return;

    const resend = new Resend(resendApiKey.value());
    try {
      await resend.emails.send({
        from: "Rodriguez Ranch <onboarding@resend.dev>",
        to: [customerEmail],
        subject: `Order Cancelled #${orderId} - Rodriguez Ranch`,
        html: `
          <div style="font-family: Arial, sans-serif; color: #333; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #DC2626;">Order Cancelled</h2>
            <p>Hello ${after.custName || 'Valued Customer'},</p>
            <p>Unfortunately, we had to cancel your order <strong>#${orderId}</strong> for ${after.items || 'your items'}.</p>
            <p>If you have any questions or believe this was a mistake, please contact us at <strong>morganmv145@gmail.com</strong>.</p>
            <p>Thank you,<br>Rodriguez Ranch</p>
          </div>
        `
      });
      console.log(`Cancellation email sent for Order ${orderId}`);
    } catch (e) {
      console.error("Failed to send cancellation email", e);
    }
  }
});
