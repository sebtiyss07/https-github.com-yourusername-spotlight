import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy",
  description: "What Spotlight stores about you: one currency setting, plus anonymous visit counts.",
};

export default function PrivacyPage() {
  return (
    <article className="mx-auto max-w-2xl px-5 py-16 sm:px-8">
      <h1 className="text-[32px] font-semibold">Privacy policy</h1>
      <p className="mt-2 text-[14px] text-ink-3">Last updated 5 October 2026</p>

      <h2 className="mt-10 text-[20px] font-semibold">What we store</h2>
      <p className="mt-2 text-[16px] text-ink-2">
        One cookie, <code>spotlight-currency</code>, which remembers the currency you
        choose (for example US dollars or pounds) so prices show in it next time. It
        lasts a year and holds nothing else.
      </p>
      <p className="mt-2 text-[16px] text-ink-2">
        Games you save with &ldquo;Save&rdquo; are kept in your own browser (its local storage), with
        the price when you saved them, so My games can show how the price has moved. They never
        leave your device; clearing your browser data removes them.
      </p>

      <h2 className="mt-10 text-[20px] font-semibold">What we don&apos;t do</h2>
      <ul className="mt-2 list-disc space-y-2 pl-5 text-[16px] text-ink-2">
        <li>No accounts, no sign-up, and no forms that collect your name, email or payment details.</li>
        <li>No advertising trackers, and no cookies beyond the currency one above.</li>
        <li>We don&apos;t sell or share personal information.</li>
      </ul>

      <h2 className="mt-10 text-[20px] font-semibold">Visit counts</h2>
      <p className="mt-2 text-[16px] text-ink-2">
        We count visits with Vercel Web Analytics to see how many people use Spotlight and
        which pages they open. It uses no cookies and doesn&apos;t identify you: it records the
        page, your country and your type of device and browser, in totals only.
      </p>

      <h2 className="mt-10 text-[20px] font-semibold">Our hosting</h2>
      <p className="mt-2 text-[16px] text-ink-2">
        Spotlight is hosted by Vercel, which, like any web host, processes basic request
        information such as your IP address to deliver pages and keep the service secure.
      </p>

      <h2 className="mt-10 text-[20px] font-semibold">Links to other sites</h2>
      <p className="mt-2 text-[16px] text-ink-2">
        When you follow a link to a ticket, hotel or travel site, that site&apos;s own
        privacy policy applies. Some of these links may be affiliate links, which can tell
        the site that you came from Spotlight so it can pay us a commission. This never
        changes the price you pay.
      </p>
    </article>
  );
}
