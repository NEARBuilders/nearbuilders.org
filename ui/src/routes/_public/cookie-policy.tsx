import { createFileRoute } from "@tanstack/react-router";
import { LegalDocument } from "@/components/legal-document";
import { pageHead } from "@/lib/page-meta";

const CONTENT = `This Cookie Policy explains how NEAR Foundation ("we", "us", "our") uses cookies and similar technologies when you visit NEAR Builders. It explains what these technologies are and why we use them, as well as your rights to control our use of them.

This policy applies in addition to our [Privacy Policy](/privacy-policy). For NEAR's general cookie practices, see the [NEAR Cookie Policy](https://near.org/cookie-policy).

## 1. What Are Cookies?

Cookies are small text files that are downloaded onto your computer or mobile device when you visit a website. They enable websites to store information or facilitate access to information stored on your device to enable certain features and distinguish you from other visitors.

Cookies set by the website operator are called "first-party cookies" and cookies set by parties other than the website operator are called "third-party cookies."

## 2. What Cookies We Use

### Strictly Necessary Cookies

These cookies are essential for the platform to function and cannot be switched off. They are set in response to actions made by you, such as signing in.

**Session Cookie**

- Purpose: Authentication and session management
- Duration: Session duration as configured by the platform
- Type: First-party, HttpOnly, Secure

### Wallet Connection State

When you connect a NEAR wallet, the wallet connector keeps connection state in your browser (such as your wallet type and connected account) so your connection can be restored. This data stays on your device.

### Functional Storage (localStorage)

We use browser localStorage to remember your preferences and provide functionality. This data stays on your device and is not transmitted to our servers, except where a feature explicitly sends data to the platform.

**Banner preferences**

- Purpose: Remember that you dismissed a banner (such as the hackathon or build banners)
- Data stored: A dismissal flag

**Builder directory layout**

- Purpose: Remember your preferred layout for the builders directory
- Data stored: Layout preference

**Project kind preference**

- Purpose: Remember the last project kind you created
- Data stored: "project" or related kind

**Drafts**

- Purpose: Keep unsent drafts of projects and ideas so you do not lose work
- Data stored: The draft content you typed

**Nostr session keys**

- Purpose: Let you interact with Nostr-powered features without re-authorizing
- Data stored: Session keys for the Nostr features, stored per NEAR account on your device and never transmitted to our servers

## 3. Third-Party Services

We do not use advertising or cross-site tracking cookies. When you connect a wallet, your wallet provider may have its own cookie and privacy practices. We encourage you to review their respective policies.

## 4. How to Manage Cookies

You can control and manage cookies through your browser settings. Most browsers allow you to:

- View what cookies are stored and delete them individually
- Block cookies from specific sites
- Block all cookies
- Delete all cookies when you close your browser

Please note that if you disable cookies, some features of the platform may not function properly. For example, you may not be able to stay signed in.

To clear localStorage data, you can use your browser's developer tools or clear all site data through your browser settings.

## 5. Updates to This Policy

We may update this Cookie Policy from time to time to reflect changes in our practices or for other operational, legal, or regulatory reasons. Please revisit this page periodically to stay informed.

---

For questions about this Cookie Policy, contact us at privacy@near.org. For privacy-related inquiries, see our [Privacy Policy](/privacy-policy).
`;

export const Route = createFileRoute("/_public/cookie-policy")({
  head: () => ({
    meta: pageHead({
      title: "Cookie Policy | NEAR Builders",
      description: "How NEAR Builders uses cookies and browser storage.",
    }),
  }),
  component: CookiePolicy,
});

function CookiePolicy() {
  return (
    <LegalDocument
      title="Cookie Policy"
      updated="October 31, 2026"
      content={CONTENT}
      seeAlsoLabel="NEAR Cookie Policy"
      seeAlsoHref="https://near.org/cookie-policy"
    />
  );
}
