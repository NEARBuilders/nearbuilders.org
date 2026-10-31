import { createFileRoute } from "@tanstack/react-router";
import { LegalDocument } from "@/components/legal-document";
import { pageHead } from "@/lib/page-meta";

const CONTENT = `NEAR Foundation ("we", "us", "our") is committed to protecting your privacy. This Privacy Policy describes how we collect, use, and share information when you use NEAR Builders.

This policy applies specifically to NEAR Builders. For NEAR's general privacy practices, please also review the [NEAR Privacy Policy](https://near.org/privacy).

## 1. Information We Collect

### Wallet sign-in

When you sign in with your NEAR wallet, we collect:

- NEAR account ID (wallet address)
- Public key associated with your account
- Network (mainnet/testnet)

Note: NEAR wallet addresses are public on the blockchain by nature.

### Account and platform information

When you use the platform, we store:

- Your user account, including your email address if you provide one
- The NEAR accounts you link to your user account
- Builder profile details you submit (name, bio, skills, location, links) and their review status
- Projects, ideas, proposals, votes, and other content you create on the platform
- API keys you create and their metadata

### API credit claims

When you claim NEAR AI Cloud credits, we store:

- The NEAR account that made the claim and your user ID
- Claim status, spend limit, and a key prefix (never the full key)
- Your IP address, used to detect duplicate claims and prevent abuse

### Technical information

We automatically collect certain technical information, including:

- IP address
- Session information

## 2. How We Use Your Information

We use your information to:

- Operate the platform and provide its features
- Review builder profile submissions
- Issue NEAR AI Cloud API keys to approved builders
- Detect duplicate claims and prevent fraud and abuse, including reviewing claims that share an IP address
- Provide customer support and respond to inquiries
- Comply with legal obligations
- Improve our services

## 3. Information Sharing

We share your information only as follows:

- **NEAR AI Cloud**: API keys for approved builders are issued through NEAR AI Cloud. Their handling of your API usage is governed by their terms and privacy policy.
- **Service providers**: hosting and infrastructure providers that operate the platform on our behalf.
- **Legal requirements**: when required by law, court order, or to protect the rights, property, or safety of NEAR Foundation, our users, or others, including for fraud protection.

We do not sell your personal information.

## 4. Data Storage and Retention

We retain your information for as long as necessary to operate the platform, provide support, prevent abuse, and comply with legal obligations. You may request deletion of your account by contacting us.

## 5. Your Rights

Depending on your location, you may have certain rights regarding your personal information, including:

- Access to your personal data
- Correction of inaccurate data
- Deletion of your data (subject to legal retention requirements)
- Data portability
- Objection to processing

To exercise these rights, contact us at privacy@near.org.

## 6. Cookies and Local Storage

We use cookies and browser local storage for authentication and functionality. For detailed information, see our [Cookie Policy](/cookie-policy).

## 7. Security

We implement appropriate technical and organizational measures to protect your information. However, no method of transmission over the Internet is 100% secure.

## 8. Children's Privacy

The platform is not intended for children under 18 years of age. We do not knowingly collect personal information from children under 18.

## 9. Changes to This Policy

We may update this Privacy Policy from time to time. We will notify you of any material changes by posting the new policy on this page with an updated "Last updated" date.

## 10. Contact Us

For questions about this Privacy Policy or to exercise your privacy rights, contact us at:

- General inquiries: privacy@near.org
- Legal inquiries: privacy@near.org
`;

export const Route = createFileRoute("/_public/privacy-policy")({
  head: () => ({
    meta: pageHead({
      title: "Privacy Policy | NEAR Builders",
      description: "How NEAR Builders collects, uses, and shares information.",
    }),
  }),
  component: PrivacyPolicy,
});

function PrivacyPolicy() {
  return (
    <LegalDocument
      title="Privacy Policy"
      updated="October 31, 2026"
      content={CONTENT}
      seeAlsoLabel="NEAR Privacy Policy"
      seeAlsoHref="https://near.org/privacy"
    />
  );
}
