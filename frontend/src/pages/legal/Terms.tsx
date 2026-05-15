import React from "react";
import LegalLayout from "./LegalLayout";
import legalContent from "../../../content/legal.json";

const Terms = () => {
  const { termsAndConditions } = legalContent;

  return (
    <LegalLayout title="Terms & Conditions" lastUpdated={termsAndConditions.lastUpdated}>
      <p>
        Welcome to Krovaa. By accessing or using the Krovaa platform, you agree to these Terms and Conditions.
      </p>

      {termsAndConditions.sections.map((section, index) => (
        <React.Fragment key={section.title}>
          <h2>{index + 1}. {section.title}</h2>
          <p>
            {section.title === "Contact" ? (
              <>
                For questions regarding these Terms, contact:<br />
                <a href={`mailto:${legalContent.footer?.email}`} className="text-blue-400 hover:text-blue-300">{legalContent.footer?.email}</a>
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

export default Terms;
