import { createFileRoute } from "@tanstack/react-router";
import { LegalDocument } from "@/components/legal-document";
import { pageHead } from "@/lib/page-meta";

const CONTENT = `These Terms of Service ("Terms") govern your use of NEAR Builders operated by NEAR Foundation ("we", "us", "our"). By using the platform, you agree to these Terms.

These Terms apply specifically to NEAR Builders. For NEAR's general terms, please also review the [NEAR Terms of Use](https://near.org/terms-of-use).

## 1. Acceptance of Terms

By accessing or using NEAR Builders, you agree to be bound by these Terms and our [Privacy Policy](/privacy-policy). If you do not agree to these Terms, you must not use the platform.

You must be at least 18 years old to use this platform.

## 2. The Platform

NEAR Builders is a platform where builders can create a public builder profile, publish projects and ideas, submit proposals, collaborate, and claim NEAR AI Cloud API credits during offer windows. Features may be added, changed, or removed over time.

## 3. Builder Profiles and Review

Builder profile submissions and proposals are reviewed by platform administrators. We may approve, reject, or remove any profile, proposal, or piece of content at our discretion. You are responsible for the accuracy of the information you submit.

## 4. API Credit Claims

During an offer window, approved builders may claim NEAR AI Cloud API credits, subject to the following:

- Credits are limited to one claim per builder.
- You may not use multiple accounts, wallets, or identities to claim credits more than once.
- We may store your IP address with your claim and use it, together with linked account information, to detect and prevent duplicate or fraudulent claims.
- We may revoke keys and refuse or cancel claims, including claims we reasonably believe to be duplicate, fraudulent, or abusive.
- Issued API keys are provided through NEAR AI Cloud. Your use of NEAR AI Cloud is governed by the terms applicable there, and we do not control its availability or pricing.

## 5. Wallet Connection

You may connect a NEAR wallet to access certain features. You are responsible for maintaining the security of your wallet and any transactions made using it. We are not responsible for any loss or damage arising from unauthorized access to your wallet.

## 6. User Contributions

Content you submit — including profiles, projects, ideas, and proposals — must comply with our content standards: no unlawful, defamatory, abusive, deceptive, or infringing material. You represent and warrant that you have the rights to the content you submit and grant us the right to display it on the platform.

We may remove any content and suspend or terminate any account for violations of these Terms.

## 7. Prohibited Uses

You agree not to:

- Use the platform for any unlawful purpose
- Create or use multiple accounts or identities to circumvent platform limits, including credit claim limits
- Attempt to gain unauthorized access to our systems
- Interfere with or disrupt the platform's operation
- Use automated systems to access the platform without permission
- Provide false or misleading information
- Impersonate any person or misrepresent your affiliation with any person or organization

## 8. Intellectual Property

All content on the platform, including designs, logos, text, and images, is the property of NEAR Foundation or its licensors and is protected by intellectual property laws. You may not reproduce, distribute, or create derivative works without our express written permission.

## 9. Disclaimer of Warranties

THE PLATFORM IS PROVIDED "AS IS" WITHOUT WARRANTIES OF ANY KIND, EXPRESS OR IMPLIED. WE DISCLAIM ALL WARRANTIES, INCLUDING IMPLIED WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT.

We do not warrant that the platform will be uninterrupted, error-free, or secure.

## 10. Limitation of Liability

TO THE MAXIMUM EXTENT PERMITTED BY LAW, NEAR FOUNDATION SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES ARISING FROM YOUR USE OF THE PLATFORM.

## 11. Indemnification

You agree to indemnify and hold harmless NEAR Foundation and its affiliates, officers, directors, employees, and agents from any claims, damages, losses, or expenses arising from your use of the platform or violation of these Terms.

## 12. Governing Law

These Terms shall be governed by and construed in accordance with the laws of Switzerland, without regard to its conflict of law provisions.

## 13. Changes to Terms

We may modify these Terms at any time. Changes will be effective when posted on this page with an updated "Last updated" date. Your continued use of the platform after changes constitutes acceptance of the modified Terms.

## 14. Contact

For questions about these Terms, contact us at:

- General inquiries: privacy@near.org
- Legal inquiries: privacy@near.org
`;

export const Route = createFileRoute("/_public/terms-of-service")({
  head: () => ({
    meta: pageHead({
      title: "Terms of Service | NEAR Builders",
      description: "The terms that govern your use of NEAR Builders.",
    }),
  }),
  component: TermsOfService,
});

function TermsOfService() {
  return (
    <LegalDocument
      title="Terms of Service"
      updated="October 31, 2026"
      content={CONTENT}
      seeAlsoLabel="NEAR Terms of Use"
      seeAlsoHref="https://near.org/terms-of-use"
    />
  );
}
