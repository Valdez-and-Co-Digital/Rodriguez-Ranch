const React = require('react');
const {
  Html, Head, Body, Container, Section, Row, Column, Text, Img, Hr, Link, Preview
} = require('@react-email/components');

function ReceiptEmail({
  customerName = "Valued Customer",
  orderId = "RR-1001",
  orderItems = [{ description: "12-Pack Fresh Farm Eggs", price: 6.00 }],
  totalAmount = 6.00,
  pickupDate = "Tomorrow",
  pickupTime = "10:00 AM",
  pickupAddress = "Castroville, TX 78009",
  pickupDetails = "Please have Cash, Venmo, or Credit Card ready at pickup.",
  businessLogoUrl = "https://rodriguezranch.netlify.app/assets/ranch_logo.png"
}) {
  return (
    <Html>
      <Head />
      <Preview>Receipt for Order #{orderId} - Rodriguez Ranch</Preview>
      <Body style={styles.body}>
        <Container style={styles.container}>
          {/* Header & Logo */}
          <Section style={styles.headerSection}>
            {businessLogoUrl ? (
              <Img src={businessLogoUrl} width="120" height="auto" alt="Rodriguez Ranch Logo" style={styles.logo} />
            ) : null}
            <Text style={styles.headerTitle}>RODRIGUEZ RANCH</Text>
            <Text style={styles.headerSubtitle}>Receipt & Order Confirmation</Text>
          </Section>

          {/* Greeting */}
          <Section style={styles.contentSection}>
            <Text style={styles.greeting}>Hi {customerName},</Text>
            <Text style={styles.paragraph}>
              Thank you for your reservation! Here is your official receipt and pickup instructions for your order <strong>#{orderId}</strong>.
            </Text>
          </Section>

          <Hr style={styles.divider} />

          {/* Receipt Items Table */}
          <Section style={styles.tableSection}>
            <Text style={styles.tableTitle}>Order Summary</Text>
            {orderItems.map((item, index) => (
              <Row key={index} style={styles.itemRow}>
                <Column style={styles.itemDescription}>
                  <Text style={styles.itemText}>{item.description}</Text>
                </Column>
                <Column style={styles.itemPrice}>
                  <Text style={styles.itemPriceText}>${Number(item.price).toFixed(2)}</Text>
                </Column>
              </Row>
            ))}

            <Hr style={styles.subDivider} />

            <Row style={styles.totalRow}>
              <Column style={styles.itemDescription}>
                <Text style={styles.totalLabel}>Total Due at Pickup</Text>
              </Column>
              <Column style={styles.itemPrice}>
                <Text style={styles.totalAmount}>${Number(totalAmount).toFixed(2)}</Text>
              </Column>
            </Row>
          </Section>

          <Hr style={styles.divider} />

          {/* Pickup Details */}
          <Section style={styles.pickupSection}>
            <Text style={styles.tableTitle}>Pickup Details & Instructions</Text>
            <Text style={styles.pickupDetailText}>📅 <strong>Date:</strong> {pickupDate}</Text>
            <Text style={styles.pickupDetailText}>🕒 <strong>Time Window:</strong> {pickupTime}</Text>
            <Text style={styles.pickupDetailText}>📍 <strong>Pickup Address:</strong></Text>
            <Section style={styles.addressBox}>
              <Text style={styles.addressText}>{pickupAddress}</Text>
            </Section>
            <Section style={styles.noteBox}>
              <Text style={styles.noteText}>💡 <strong>Instructions:</strong> {pickupDetails}</Text>
            </Section>
          </Section>

          <Hr style={styles.divider} />

          {/* Footer */}
          <Section style={styles.footerSection}>
            <Text style={styles.footerText}>
              Questions? Reply directly to this email or contact us at <Link href="mailto:morganmv145@gmail.com" style={styles.link}>morganmv145@gmail.com</Link>.
            </Text>
            <Text style={styles.footerCopyright}>
              © {new Date().getFullYear()} Rodriguez Ranch. Established 1856. All rights reserved.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

const styles = {
  body: {
    backgroundColor: '#F4F4F5',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
    padding: '40px 0',
    margin: '0',
  },
  container: {
    backgroundColor: '#FFFFFF',
    borderRadius: '12px',
    maxWidth: '560px',
    margin: '0 auto',
    padding: '40px 32px',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.05)',
  },
  headerSection: {
    textAlign: 'center',
    marginBottom: '24px',
  },
  logo: {
    margin: '0 auto 16px auto',
  },
  headerTitle: {
    fontSize: '22px',
    fontWeight: '700',
    letterSpacing: '1px',
    color: '#1C1917',
    margin: '0 0 4px 0',
  },
  headerSubtitle: {
    fontSize: '13px',
    color: '#D97706',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    margin: '0',
  },
  contentSection: {
    marginBottom: '16px',
  },
  greeting: {
    fontSize: '16px',
    fontWeight: '600',
    color: '#18181B',
    margin: '0 0 8px 0',
  },
  paragraph: {
    fontSize: '14px',
    color: '#52525B',
    lineHeight: '1.5',
    margin: '0',
  },
  divider: {
    borderColor: '#E4E4E7',
    margin: '24px 0',
  },
  subDivider: {
    borderColor: '#F4F4F5',
    margin: '12px 0',
  },
  tableSection: {
    marginBottom: '16px',
  },
  tableTitle: {
    fontSize: '14px',
    fontWeight: '700',
    color: '#18181B',
    margin: '0 0 12px 0',
  },
  itemRow: {
    padding: '6px 0',
  },
  itemDescription: {
    textAlign: 'left',
  },
  itemText: {
    fontSize: '14px',
    color: '#3F3F46',
    margin: '0',
  },
  itemPrice: {
    textAlign: 'right',
    width: '100px',
  },
  itemPriceText: {
    fontSize: '14px',
    color: '#18181B',
    fontWeight: '500',
    margin: '0',
  },
  totalRow: {
    paddingTop: '8px',
  },
  totalLabel: {
    fontSize: '15px',
    fontWeight: '700',
    color: '#18181B',
    margin: '0',
  },
  totalAmount: {
    fontSize: '18px',
    fontWeight: '700',
    color: '#15803D',
    margin: '0',
  },
  pickupSection: {
    marginBottom: '16px',
  },
  pickupDetailText: {
    fontSize: '14px',
    color: '#3F3F46',
    margin: '4px 0',
  },
  addressBox: {
    backgroundColor: '#FAF7F2',
    border: '1px solid #E7E1D5',
    borderRadius: '8px',
    padding: '12px 16px',
    margin: '8px 0 16px 0',
  },
  addressText: {
    fontSize: '13px',
    fontFamily: 'monospace',
    color: '#292524',
    margin: '0',
  },
  noteBox: {
    backgroundColor: '#FFFBEB',
    borderLeft: '4px solid #D97706',
    borderRadius: '4px',
    padding: '12px 16px',
  },
  noteText: {
    fontSize: '13px',
    color: '#78350F',
    margin: '0',
    lineHeight: '1.4',
  },
  footerSection: {
    textAlign: 'center',
  },
  footerText: {
    fontSize: '12px',
    color: '#71717A',
    margin: '0 0 8px 0',
  },
  footerCopyright: {
    fontSize: '11px',
    color: '#A1A1AA',
    margin: '0',
  },
  link: {
    color: '#D97706',
    textDecoration: 'underline',
  },
};

module.exports = ReceiptEmail;
