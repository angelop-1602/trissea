'use client';

import packageJson from '@/package.json';
import { PASSENGER_APP_NAME } from '@/lib/brand';
import { PassengerAppShell } from '@/components/passenger/passenger-app-shell';
import { AccountSection, AccountValueRow } from '@/components/passenger/account-section';

const faqs = [
  {
    question: 'Where can I see my current ride or reservation?',
    answer: 'Open Home for your live state first, or go to Activity for your full trip and reservation record.',
  },
  {
    question: 'How do TODA reservations work?',
    answer: 'Reservations are separate from on-demand rides. You choose a terminal, join its queue, and watch the queue state from TODA or Activity.',
  },
  {
    question: 'Can I change my phone number here?',
    answer: 'Not yet. Your phone is currently tied to OTP sign-in, so it stays read-only in the current account flow.',
  },
];

export default function PassengerHelpPage() {
  return (
    <PassengerAppShell
      title="Help & Support"
      subtitle="Quick answers, product context, and support boundaries for the current passenger app."
      backHref="/passenger/account"
      topContext="Account"
      headerVariant="compact"
      headerSurface="minimal"
    >
      <AccountSection
        title="Frequently asked questions"
        description="This app does not include live chat or an in-app support desk yet, so help stays simple and explicit."
      >
        {faqs.map((item, index) => (
          <div key={item.question} className={index > 0 ? 'border-t border-border/60 px-4 py-4' : 'px-4 py-4'}>
            <p className="text-sm font-medium">{item.question}</p>
            <p className="mt-1 text-sm text-muted-foreground">{item.answer}</p>
          </div>
        ))}
      </AccountSection>

      <AccountSection
        title="Support notes"
        description="These are the real support boundaries available in the passenger app today."
      >
        <AccountValueRow label="Support" value="No in-app live chat is available yet." />
        <div className="border-t border-border/60">
          <AccountValueRow
            label="Unavailable features"
            value="No wallet, payment, or saved places support is available in this account area yet."
          />
        </div>
        <div className="border-t border-border/60">
          <AccountValueRow
            label="Troubleshooting"
            value="If ride or reservation status looks wrong, check Home, TODA, or Activity first to review the latest live state."
          />
        </div>
      </AccountSection>

      <AccountSection title="App version" description="Useful for support and issue reporting.">
        <AccountValueRow label="Version" value={`${PASSENGER_APP_NAME} ${packageJson.version}`} />
      </AccountSection>
    </PassengerAppShell>
  );
}
