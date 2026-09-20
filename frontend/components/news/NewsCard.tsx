/* eslint-disable @next/next/no-img-element */
'use client';

import React, { useState, useEffect } from 'react';
import { ExternalLink, Clock, MapPin, Tag } from 'lucide-react';
import { NewsItem, NewsCategory, Station, Reading } from '@/lib/types';

interface NewsCardProps {
  article: NewsItem;
  isNew?: boolean;
  stations?: Station[];
  readings?: Record<string, Reading>;
  onStationClick?: (stationId: string) => void;
}

const CATEGORY_STYLES: Record<NewsCategory, { label: string; badge: string }> = {
  pollution: {
    label: 'Pollution',
    badge: 'bg-[#EF4444]/15 border-[#EF4444]/30 text-[#FCA5A5]',
  },
  government: {
    label: 'Government Action',
    badge: 'bg-[#0284C7]/15 border-[#0284C7]/30 text-[#7DD3FC]',
  },
  legal: {
    label: 'Legal & NGT',
    badge: 'bg-[#8B5CF6]/15 border-[#8B5CF6]/30 text-[#C4B5FD]',
  },
  local: {
    label: 'Local',
    badge: 'bg-[#10B981]/15 border-[#10B981]/30 text-[#6EE7B7]',
  },
  general: {
    label: 'General',
    badge: 'bg-[#64748B]/15 border-[#64748B]/30 text-[#CBD5E1]',
  },
};

const DEFAULT_THUMBNAIL = 'https://images.unsplash.com/photo-1544816155-12df9643f363?auto=format&fit=crop&w=800&q=80';

/**
 * Format relative time with auto-ticking
 */
function getRelativeTimeString(dateStr: string): string {
  const past = new Date(dateStr).getTime();
  const now = Date.now();
  const diffSec = Math.max(0, Math.floor((now - past) / 1000));

  if (diffSec < 60) return 'just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour}h ago`;
  const diffDay = Math.floor(diffHour / 24);
  if (diffDay < 30) return `${diffDay}d ago`;
  return new Date(dateStr).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function NewsCard({
  article,
  isNew = false,
  stations = [],
  readings = {},
  onStationClick,
}: NewsCardProps) {
  const [relativeTime, setRelativeTime] = useState<string>(() => getRelativeTimeString(article.publishedAt));
  const [imgError, setImgError] = useState(false);

  // Auto-tick relative time every 30 seconds
  useEffect(() => {
    setRelativeTime(getRelativeTimeString(article.publishedAt));
    const timer = setInterval(() => {
      setRelativeTime(getRelativeTimeString(article.publishedAt));
    }, 30000);
    return () => clearInterval(timer);
  }, [article.publishedAt]);

  const catStyle = CATEGORY_STYLES[article.category] || CATEGORY_STYLES.general;
  const thumbnailUrl = !imgError && article.imageUrl ? article.imageUrl : DEFAULT_THUMBNAIL;

  return (
    <article
      className={`group relative flex flex-col justify-between overflow-hidden rounded-xl border bg-[#121C2E] transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] hover:-translate-y-1 hover:border-[#22D3EE]/50 hover:shadow-[0_8px_30px_rgba(0,0,0,0.45)] ${
        isNew
          ? 'border-[#22D3EE] shadow-[0_0_20px_rgba(34,211,238,0.25)] ring-1 ring-[#22D3EE]/40 animate-pulse'
          : 'border-[#1E2C42]'
      }`}
    >
      {/* Top Banner Image with Vignette */}
      <div className="relative h-44 w-full overflow-hidden bg-gradient-to-br from-[#121C2E] to-[#1E2C42]">
        <img
          src={thumbnailUrl}
          alt={article.title}
          onError={() => setImgError(true)}
          loading="lazy"
          decoding="async"
          className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#121C2E] via-transparent to-black/30" />

        {/* Category Badge over image */}
        <div className="absolute top-3 left-3">
          <span
            className={`inline-flex items-center gap-1 rounded-md border px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider backdrop-blur-md ${catStyle.badge}`}
          >
            <Tag className="h-3 w-3" />
            {catStyle.label}
          </span>
        </div>

        {/* Source & Ticking Timestamp */}
        <div className="absolute bottom-2 left-3 right-3 flex items-center justify-between text-xs text-[#8A9BB4]">
          <span className="font-medium text-[#CBD5E1] drop-shadow-md truncate max-w-[60%]">
            {article.source}
          </span>
          <span className="inline-flex items-center gap-1 text-[11px] text-[#8A9BB4] drop-shadow-md shrink-0">
            <Clock className="h-3 w-3 text-[#22D3EE]/80" />
            {relativeTime}
          </span>
        </div>
      </div>

      {/* Content Section */}
      <div className="flex flex-1 flex-col p-4 sm:p-5">
        {/* Headline */}
        <h3 className="text-base font-semibold leading-snug text-[#E6EDF7] transition-colors group-hover:text-[#22D3EE] line-clamp-2">
          {article.title}
        </h3>

        {/* 2-line Excerpt */}
        <p className="mt-2 text-xs leading-relaxed text-[#8A9BB4] line-clamp-2">
          {article.summary}
        </p>

        {/* Related Stations Strip (Connecting News to Sensor Telemetry) */}
        {article.relatedStations && article.relatedStations.length > 0 && (
          <div className="mt-3.5 flex flex-wrap items-center gap-1.5 pt-2 border-t border-[#1E2C42]/60">
            <span className="text-[10px] uppercase tracking-wider text-[#8A9BB4]/80 flex items-center gap-1">
              <MapPin className="h-2.5 w-2.5 text-[#22D3EE]" /> Station:
            </span>
            {article.relatedStations.map((stId) => {
              const station = stations.find((s) => s.id === stId);
              const reading = readings[stId];
              const stationName = station ? station.name : stId;
              const wqi = reading ? Math.round(reading.wqi) : null;
              const status = reading?.status || 'moderate';

              return (
                <button
                  key={stId}
                  onClick={(e) => {
                    e.preventDefault();
                    if (onStationClick) onStationClick(stId);
                  }}
                  className="inline-flex items-center gap-1.5 rounded-full border border-[#1E2C42] bg-[#0B1220]/80 px-2 py-0.5 text-[11px] text-[#CBD5E1] transition-all hover:border-[#22D3EE]/50 hover:bg-[#1E2C42]"
                  title={`View news related to ${stationName} (Live WQI: ${wqi ?? 'N/A'})`}
                >
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${
                      status === 'good'
                        ? 'bg-[#22C55E]'
                        : status === 'moderate'
                        ? 'bg-[#FDE047]'
                        : status === 'poor'
                        ? 'bg-[#F97316]'
                        : 'bg-[#EF4444]'
                    }`}
                  />
                  <span className="font-mono font-medium">{stId}</span>
                  <span className="text-[#8A9BB4]">{stationName.split(' ')[0]}</span>
                  {wqi !== null && (
                    <span className="font-mono text-[10px] text-[#22D3EE]">
                      WQI {wqi}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* Card Footer: Read Full link */}
        <div className="mt-4 flex items-center justify-between pt-3 border-t border-[#1E2C42]">
          <div className="flex items-center gap-1.5">
            {article.relatedStations && article.relatedStations.length > 0 ? (
              <span className="text-[11px] text-[#8A9BB4]/90">
                Correlated to monitoring sensors
              </span>
            ) : (
              <span className="text-[11px] text-[#8A9BB4]/60">
                Basin Environmental Coverage
              </span>
            )}
          </div>

          <a
            href={article.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs font-semibold text-[#22D3EE] transition-all hover:text-[#38BDF8] hover:underline"
          >
            Read full
            <ExternalLink className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
          </a>
        </div>
      </div>
    </article>
  );
}

export default NewsCard;
