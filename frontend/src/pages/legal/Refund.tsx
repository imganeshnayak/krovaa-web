import React from "react";
import LegalLayout from "./LegalLayout";

const Refund = () => {
  return (
    <LegalLayout title="Refund Policy" lastUpdated="March 10, 2026">
      <p>
        This Refund Policy governs refund requests on the Krovaa platform.
      </p>

      <h2>1. General Policy</h2>
      <p>
        Transactions conducted through Krovaa may be eligible for refunds depending on the circumstances.
      </p>

      <h2>2. Eligible Cases</h2>
      <p>
        Refunds may be considered in cases of failed transactions, duplicate payments, or technical errors.
      </p>

      <h2>3. Wallet Transactions</h2>
      <p>
        Users may maintain a wallet balance on the platform. Wallet funds may be used for transactions between users.
      </p>

      <h2>4. Withdrawal Requests</h2>
      <p>
        Users may request withdrawal of available wallet balances. Approved withdrawals will be processed within a reasonable timeframe.
      </p>

      <h2>5. Non-Refundable Situations</h2>
      <p>
        Refunds may not be issued for completed transactions or services already delivered.
      </p>

      <h2>6. Processing Time</h2>
      <p>
        Refund processing time may vary depending on payment providers and banking systems.
      </p>

      <h2>7. Contact</h2>
      <p>
        For refund-related inquiries:<br />
        <a href="mailto:support@krovaa.com" className="text-blue-400 hover:text-blue-300">support@krovaa.com</a>
      </p>
    </LegalLayout>
  );
};

export default Refund;
