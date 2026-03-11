import React from "react";
import LegalLayout from "./LegalLayout";

const Privacy = () => {
  return (
    <LegalLayout title="Privacy Policy" lastUpdated="March 10, 2026">
      <p>
        Krovaa values user privacy and is committed to protecting personal information.
      </p>

      <h2>1. Information Collected</h2>
      <p>
        Krovaa may collect information such as name, email address, phone number, account details, device information, and platform activity.
      </p>

      <h2>2. Use of Information</h2>
      <p>
        Information may be used to operate the platform, verify accounts, facilitate transactions, improve services, and maintain security.
      </p>

      <h2>3. Payment Information</h2>
      <p>
        Payments may be processed through third-party payment providers. Krovaa does not store sensitive payment details such as credit card numbers.
      </p>

      <h2>4. Data Protection</h2>
      <p>
        Krovaa implements reasonable security measures to protect user information.
      </p>

      <h2>5. Information Sharing</h2>
      <p>
        Krovaa does not sell user data and may share information only with service providers necessary for operating the platform.
      </p>

      <h2>6. Cookies</h2>
      <p>
        The platform may use cookies and similar technologies to enhance user experience and analyze usage.
      </p>

      <h2>7. Policy Updates</h2>
      <p>
        This Privacy Policy may be updated periodically.
      </p>

      <h2>8. Contact</h2>
      <p>
        For privacy inquiries, contact:<br />
        <a href="mailto:support@krovaa.com" className="text-blue-400 hover:text-blue-300">support@krovaa.com</a>
      </p>
    </LegalLayout>
  );
};

export default Privacy;
