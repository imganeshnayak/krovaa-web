import React from "react";
import LegalLayout from "./LegalLayout";
import legalContent from "../../../content/legal.json";

const Privacy = () => {
  const { privacyPolicy } = legalContent;

  return (
    <LegalLayout title="Privacy Policy" lastUpdated={privacyPolicy.lastUpdated}>
      <p>
        Krovaa values user privacy and is committed to protecting personal information.
      </p>

      {privacyPolicy.sections.map((section, index) => (
        <React.Fragment key={section.title}>
          <h2>{index + 1}. {section.title}</h2>
          <p>
            {section.title === "Contact" ? (
              <>
                For privacy inquiries, contact:<br />
                <a href={`mailto:${legalContent.footer?.email || "support@krovaa.com"}`} className="text-blue-400 hover:text-blue-300">{legalContent.footer?.email || "support@krovaa.com"}</a>
              </>
            ) : (
              section.content
            )}
          </p>
        </React.Fragment>
      ))}
    </LegalLayout>
  );
};

export default Privacy;
