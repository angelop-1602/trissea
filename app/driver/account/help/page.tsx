'use client';

import packageJson from '@/package.json';
import { DRIVER_APP_NAME } from '@/lib/brand';
import { DriverAppShell } from '@/components/driver/driver-app-shell';
import {
  AccountSection,
  AccountValueRow,
} from '@/components/passenger/account-section';

const faqs = [
  {
    question: 'Where do my assigned rides appear?',
    answer:
      'Open Home for your live state first, then Assigned for matched work already tied to your account, and Active for the current trip flow.',
  },
  {
    question: 'Can I change my TODA, vehicle, or license details here?',
    answer:
      'Not yet. Those records affect dispatch or compliance, so they stay read-only in this driver account area for now.',
  },
  {
    question: 'Can I upload replacement documents or resubmit files?',
    answer:
      'No. The current driver app does not support document upload or resubmission yet, even if review records already exist on file.',
  },
];

export default function DriverHelpPage() {
  return (
    <DriverAppShell
      title="Help & Support"
      subtitle="Quick answers and real support boundaries for the current driver app."
      backHref="/driver/account"
      topContext="Account"
      headerVariant="compact"
      headerSurface="minimal"
    >
      <AccountSection
        title="Frequently asked questions"
        description="The driver app keeps support explicit. There is no in-app live chat in this phase."
      >
        {faqs.map((item, index) => (
          <div
            key={item.question}
            className={index > 0 ? 'border-t border-border/60 px-4 py-4' : 'px-4 py-4'}
          >
            <p className="text-sm font-medium">{item.question}</p>
            <p className="mt-1 text-sm text-muted-foreground">{item.answer}</p>
          </div>
        ))}
      </AccountSection>

      <AccountSection
        title="Support notes"
        description="These are the real support boundaries available from the driver account area today."
      >
        <AccountValueRow
          label="Support channel"
          value="No in-app live chat or ticket system is available yet."
        />
        <div className="border-t border-border/60">
          <AccountValueRow
            label="Admin-managed areas"
            value="Verification, restriction handling, TODA assignment, and compliance record changes are handled by your tenant administrator."
          />
        </div>
        <div className="border-t border-border/60">
          <AccountValueRow
            label="Unavailable here"
            value="No document upload, resubmission, payout, or settlement tools are available in the current driver account area."
          />
        </div>
        <div className="border-t border-border/60">
          <AccountValueRow
            label="Troubleshooting"
            value="If live trip state looks wrong, check Home, Assigned, Active, or TODA first to confirm the latest operational state."
          />
        </div>
      </AccountSection>

      <AccountSection
        title="App version"
        description="Useful when reporting issues or confirming the current build."
      >
        <AccountValueRow label="Version" value={`${DRIVER_APP_NAME} ${packageJson.version}`} />
      </AccountSection>
    </DriverAppShell>
  );
}
