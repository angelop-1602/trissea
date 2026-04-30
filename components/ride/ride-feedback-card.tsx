'use client';

import { useEffect, useMemo, useState } from 'react';
import { MessageSquareText, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import type { RideFeedbackSummary } from '@/lib/dashboard/client';

interface RideFeedbackCardProps {
  title: string;
  subjectLabel: string;
  subjectName?: string | null;
  existingFeedback?: RideFeedbackSummary | null;
  onSubmit: (input: { rating: number; note?: string }) => Promise<void>;
  className?: string;
  autoFocus?: boolean;
  hideHeader?: boolean;
}

export function RideFeedbackCard({
  title,
  subjectLabel,
  subjectName,
  existingFeedback,
  onSubmit,
  className,
  autoFocus = false,
  hideHeader = false,
}: RideFeedbackCardProps) {
  const [rating, setRating] = useState(existingFeedback?.rating ?? 0);
  const [note, setNote] = useState(existingFeedback?.note ?? '');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);

  useEffect(() => {
    setRating(existingFeedback?.rating ?? 0);
    setNote(existingFeedback?.note ?? '');
    setSavedMessage(null);
    setError(null);
  }, [existingFeedback?.id, existingFeedback?.note, existingFeedback?.rating]);

  const heading = useMemo(() => {
    if (!subjectName) {
      return subjectLabel;
    }

    return `${subjectLabel}: ${subjectName}`;
  }, [subjectLabel, subjectName]);

  async function handleSubmit() {
    if (rating < 1 || rating > 5) {
      setError(`Choose a star rating for this ${subjectLabel.toLowerCase()}.`);
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      await onSubmit({
        rating,
        note: note.trim() ? note.trim() : undefined,
      });
      setSavedMessage(existingFeedback ? 'Feedback updated.' : 'Feedback saved.');
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Failed to save feedback.');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className={cn('rounded-[1.6rem] border border-border/60 bg-background/72 p-4', className)}>
      {hideHeader ? null : (
        <div className="space-y-1">
          <p className="text-sm font-semibold text-foreground">{title}</p>
          <p className="text-sm text-muted-foreground">{heading}</p>
        </div>
      )}

      <div className={cn('flex items-center gap-2', hideHeader ? 'mt-0' : 'mt-4')}>
        {Array.from({ length: 5 }).map((_, index) => {
          const starValue = index + 1;
          const active = starValue <= rating;

          return (
            <button
              key={starValue}
              type="button"
              className={cn(
                'flex h-11 w-11 items-center justify-center rounded-full border transition',
                active
                  ? 'border-primary/30 bg-primary/10 text-primary'
                  : 'border-border/55 bg-background text-muted-foreground hover:border-primary/20 hover:text-primary'
              )}
              onClick={() => {
                setRating(starValue);
                setSavedMessage(null);
              }}
              aria-label={`${starValue} star${starValue === 1 ? '' : 's'}`}
              autoFocus={autoFocus && starValue === Math.max(1, rating)}
            >
              <Star className={cn('h-5 w-5', active ? 'fill-current' : '')} />
            </button>
          );
        })}
      </div>

      <div className="mt-4 space-y-2">
        <label className="inline-flex items-center gap-2 text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
          <MessageSquareText className="h-3.5 w-3.5" />
          Additional note
        </label>
        <Textarea
          value={note}
          onChange={(event) => {
            setNote(event.target.value);
            setSavedMessage(null);
          }}
          rows={4}
          maxLength={400}
          placeholder={`Share a quick note about this ${subjectLabel.toLowerCase()}.`}
          className="min-h-[7rem] rounded-[1.2rem] border-border/60 bg-background/70"
        />
        <p className="text-xs text-muted-foreground">{note.trim().length}/400</p>
      </div>

      {error ? <p className="mt-3 text-sm text-destructive">{error}</p> : null}
      {savedMessage ? <p className="mt-3 text-sm text-primary">{savedMessage}</p> : null}

      <Button className="mt-4 h-11 w-full rounded-full" onClick={() => void handleSubmit()} disabled={isSaving}>
        {isSaving ? 'Saving feedback...' : existingFeedback ? 'Update Feedback' : 'Submit Feedback'}
      </Button>
    </div>
  );
}
