import React from 'react';
import { ShieldCheck, Sparkles, BookOpen, Clock, Tag } from 'lucide-react';

interface ReferenceBadgeProps {
  referenceId: string;
  type?: 'primary' | 'subtle';
}

export const ReferenceBadge: React.FC<ReferenceBadgeProps> = ({ referenceId, type = 'primary' }) => {
  return (
    <span
      id={`badge-ref-${referenceId}`}
      className={`inline-flex items-center gap-1 font-mono text-xs px-2.5 py-1 rounded-md border font-semibold ${
        type === 'primary'
          ? 'bg-amber-50 text-amber-900 border-amber-300 shadow-xs'
          : 'bg-stone-100 text-stone-700 border-stone-300'
      }`}
      title="Immutable original family source identifier"
    >
      <ShieldCheck className="w-3.5 h-3.5 text-amber-700" />
      <span>{referenceId}</span>
    </span>
  );
};

interface AIContentBadgeProps {
  label?: string;
}

export const AIContentBadge: React.FC<AIContentBadgeProps> = ({ label = 'AI-generated summary' }) => {
  return (
    <span
      id="badge-ai-provenance"
      className="inline-flex items-center gap-1.5 font-medium text-xs px-2.5 py-1 rounded-md bg-indigo-50 text-indigo-800 border border-indigo-200"
    >
      <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
      <span>{label}</span>
    </span>
  );
};

interface OriginalContentBadgeProps {
  sourceType?: string;
}

export const OriginalContentBadge: React.FC<OriginalContentBadgeProps> = ({ sourceType = 'Original Elder Content' }) => {
  return (
    <span
      id="badge-original-elder"
      className="inline-flex items-center gap-1.5 font-medium text-xs px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200"
    >
      <BookOpen className="w-3.5 h-3.5 text-emerald-700" />
      <span className="capitalize">{sourceType}</span>
    </span>
  );
};
