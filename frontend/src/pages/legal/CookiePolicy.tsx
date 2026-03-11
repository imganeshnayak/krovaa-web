import React from "react";
import LegalLayout from "./LegalLayout";

const CookiePolicy = () => {
  return (
    <LegalLayout title="Cookie Policy" lastUpdated="March 10, 2026">
      <p>
        Krovaa uses cookies and similar technologies to improve platform functionality and user experience.
      </p>

      <h2>1. Cookies</h2>
      <p>
        Cookies are small data files stored on a user’s device that help websites function efficiently.
      </p>

      <h2>2. Purpose</h2>
      <p>
        Cookies may be used to maintain sessions, remember preferences, and analyze platform performance.
      </p>

      <h2>3. Types of Cookies</h2>
      <p>
        Essential cookies may be required for core platform functionality. Analytical cookies may help improve services.
      </p>

      <h2>4. Managing Cookies</h2>
      <p>
        Users may control or disable cookies through their browser settings.
      </p>

      <h2>5. Policy Updates</h2>
      <p>
        This Cookie Policy may be updated periodically.
      </p>

      <h2>6. Contact</h2>
      <p>
        For questions regarding our cookie usage, contact:<br />
        <a href="mailto:support@krovaa.com" className="text-blue-400 hover:text-blue-300">support@krovaa.com</a>
      </p>
    </LegalLayout>
  );
};

export default CookiePolicy;
