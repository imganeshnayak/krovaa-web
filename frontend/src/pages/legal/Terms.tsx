import React from "react";
import LegalLayout from "./LegalLayout";

const Terms = () => {
  return (
    <LegalLayout title="Terms & Conditions" lastUpdated="March 10, 2026">
      <p>
        Welcome to Krovaa. By accessing or using the Krovaa platform, you agree to these Terms and Conditions.
      </p>

      <h2>1. Platform Nature</h2>
      <p>
        Krovaa operates as an online technology platform that enables users to connect, communicate, and transact with one another. Krovaa is not a party to agreements made between users.
      </p>

      <h2>2. User Accounts</h2>
      <p>
        Users must provide accurate information when creating an account and are responsible for maintaining the confidentiality of their login credentials.
      </p>

      <h2>3. Platform Usage</h2>
      <p>
        Users agree to use the platform only for lawful purposes and must not engage in fraud, abuse, harassment, unauthorized access, or any activity that disrupts the platform.
      </p>

      <h2>4. Payments and Wallet</h2>
      <p>
        Krovaa may facilitate payments through its platform and may maintain a wallet or escrow system for transactions between users. Users may add funds to their wallet and use them for transactions on the platform.
      </p>

      <h2>5. Platform Fees</h2>
      <p>
        Krovaa may charge and deduct a platform service fee or commission from transactions processed through the platform.
      </p>

      <h2>6. Withdrawals</h2>
      <p>
        Users may request withdrawal of available wallet balances. Withdrawal requests will be processed within a reasonable timeframe subject to payment provider and banking processes.
      </p>

      <h2>7. Service Disclaimer</h2>
      <p>
        Krovaa does not provide, control, or guarantee services or products exchanged between users. Krovaa is not responsible for the quality, legality, delivery, or outcome of transactions between users.
      </p>

      <h2>8. Account Suspension</h2>
      <p>
        Krovaa reserves the right to suspend or terminate accounts that violate these Terms or misuse the platform.
      </p>

      <h2>9. Limitation of Liability</h2>
      <p>
        Krovaa shall not be liable for disputes, losses, damages, or claims arising from user interactions or transactions conducted through the platform.
      </p>

      <h2>10. Changes to Terms</h2>
      <p>
        Krovaa may update these Terms at any time. Continued use of the platform constitutes acceptance of any updates.
      </p>

      <h2>11. Contact</h2>
      <p>
        For questions regarding these Terms, contact:<br />
        <a href="mailto:support@krovaa.com" className="text-blue-400 hover:text-blue-300">support@krovaa.com</a>
      </p>
    </LegalLayout>
  );
};

export default Terms;
