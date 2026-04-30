'use client';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { RideFeedbackSummary } from '@/lib/dashboard/client';
import { RideFeedbackCard } from '@/components/ride/ride-feedback-card';

interface RideFeedbackModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  subjectLabel: string;
  subjectName?: string | null;
  existingFeedback?: RideFeedbackSummary | null;
  onSubmit: (input: { rating: number; note?: string }) => Promise<void>;
}

export function RideFeedbackModal({
  open,
  onOpenChange,
  title,
  description,
  subjectLabel,
  subjectName,
  existingFeedback,
  onSubmit,
}: RideFeedbackModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md rounded-[1.75rem] border-border/60 p-0 shadow-2xl" showCloseButton>
        <DialogHeader className="px-5 pt-5">
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <RideFeedbackCard
          title={title}
          subjectLabel={subjectLabel}
          subjectName={subjectName}
          existingFeedback={existingFeedback}
          onSubmit={onSubmit}
          className="border-0 bg-transparent p-5 pt-0"
          autoFocus
          hideHeader
        />
      </DialogContent>
    </Dialog>
  );
}
