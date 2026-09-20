'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Newspaper, RefreshCw, Radio, Sparkles, AlertCircle, ArrowUpCircle } from 'lucide-react';
import { NewsItem } from '@/lib/types';
import { useRiverStore } from '@/lib/store';
import { apiClient } from '@/lib/apiClient';
import { STATIONS, getLiveReading } from '@/lib/mockData';
import NewsCard from '@/components/news/NewsCard';
import StationDataStrip from '@/components/news/StationDataStrip';
import NewsFilterChips, { FilterCategory } from '@/components/news/NewsFilterChips';

export default function NewsPage() {
  const { stations, latestReadings, setAllReadings } = useRiverStore();

  const [articles, setArticles] = useState<NewsItem[]>([]);
  const [pendingStories, setPendingStories] = useState<NewsItem[]>([]);
  const [newlyInsertedIds, setNewlyInsertedIds] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [selectedCategory, setSelectedCategory] = useState<FilterCategory>('all');
  const [selectedStationId, setSelectedStationId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [lastPolledTime, setLastPolledTime] = useState<Date>(new Date());
  const [secondsUntilNextPoll, setSecondsUntilNextPoll] = useState<number>(60);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const displayedArticleIdsRef = useRef<Set<string>>(new Set());

  // Keep ref of displayed IDs updated
  useEffect(() => {
    displayedArticleIdsRef.current = new Set(articles.map((a) => a.id));
  }, [articles]);

  // Ensure telemetry readings are populated in store
  useEffect(() => {
    if (Object.keys(latestReadings).length === 0) {
      // First try backend, otherwise seed from mockData
      apiClient.getLatestReadings().catch(() => {
        const seeded = STATIONS.map((s) => getLiveReading(s.id));
        setAllReadings(seeded);
      });
    }
  }, [latestReadings, setAllReadings]);

  /**
   * Fetch latest news from backend.
   * On initial load (isInitial = true), immediately populate articles.
   * On subsequent polls (isInitial = false), queue new stories in pendingStories
   * so the page NEVER reflows under the user.
   */
  const fetchNews = useCallback(async (isInitial = false) => {
    if (isInitial) {
      setIsLoading(true);
    } else {
      setIsRefreshing(true);
    }
    setErrorMsg(null);

    try {
      const fetched = await apiClient.getNews();

      if (isInitial) {
        setArticles(fetched);
        setPendingStories([]);
        displayedArticleIdsRef.current = new Set(fetched.map((a) => a.id));
      } else {
        // Detect stories that are not currently displayed and not already in pending
        const currentIds = displayedArticleIdsRef.current;
        const newItems = fetched.filter((item) => !currentIds.has(item.id));

        if (newItems.length > 0) {
          setPendingStories((prev) => {
            const existingPendingIds = new Set(prev.map((p) => p.id));
            const fresh = newItems.filter((item) => !existingPendingIds.has(item.id));
            return [...fresh, ...prev];
          });
        }
      }

      setLastPolledTime(new Date());
      setSecondsUntilNextPoll(60);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unable to connect to news service';
      console.error('[News] Fetch failed:', msg);
      setErrorMsg(msg);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    fetchNews(true);
  }, [fetchNews]);

  // 60-second polling interval + 1-second countdown ticker
  useEffect(() => {
    const countdownTimer = setInterval(() => {
      setSecondsUntilNextPoll((prev) => {
        if (prev <= 1) {
          fetchNews(false);
          return 60;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(countdownTimer);
  }, [fetchNews]);

  /**
   * Handle user clicking the floating pill to insert pending stories
   */
  const handleLoadPendingStories = () => {
    if (pendingStories.length === 0) return;

    const newIds = new Set(pendingStories.map((p) => p.id));
    setArticles((prev) => [...pendingStories, ...prev]);
    setNewlyInsertedIds(newIds);
    setPendingStories([]);

    // Clear the cyan glow highlight after 4 seconds
    setTimeout(() => {
      setNewlyInsertedIds(new Set());
    }, 4000);

    // Smooth scroll to top of feed
    window.scrollTo({ top: 120, behavior: 'smooth' });
  };

  /**
   * Optional manual simulator for testing the floating pill in demo/dev mode
   */
  const handleSimulateNewStory = () => {
    const randomId = `news-live-sim-${Date.now()}`;
    const simStory: NewsItem = {
      id: randomId,
      title: `URGENT: Water Quality Monitoring Team Dispatches Rapid Response to Chikhali Bridge Outfall`,
      summary: `Automated telemetry sensors flagged sharp conductivity and turbidity spikes near Station S4. Field inspection teams and local river watchers are currently sampling on-site.`,
      source: 'Indrayani Sentinel Alert',
      url: 'https://mpcb.gov.in',
      imageUrl: 'https://images.unsplash.com/photo-1544816155-12df9643f363?auto=format&fit=crop&w=800&q=80',
      publishedAt: new Date().toISOString(),
      category: 'pollution',
      relatedStations: ['S4'],
    };

    setPendingStories((prev) => [simStory, ...prev]);
  };

  // Filter articles based on category, station, and search text
  const filteredArticles = useMemo(() => {
    return articles.filter((article) => {
      // Category filter
      if (selectedCategory !== 'all' && article.category !== selectedCategory) {
        return false;
      }

      // Station filter
      if (
        selectedStationId &&
        (!article.relatedStations || !article.relatedStations.includes(selectedStationId))
      ) {
        return false;
      }

      // Search query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = article.title.toLowerCase().includes(q);
        const matchSummary = article.summary.toLowerCase().includes(q);
        const matchSource = article.source.toLowerCase().includes(q);
        if (!matchTitle && !matchSummary && !matchSource) return false;
      }

      return true;
    });
  }, [articles, selectedCategory, selectedStationId, searchQuery]);

  // Compute category counts for chips
  const categoryCounts = useMemo(() => {
    const counts: Record<FilterCategory, number> = {
      all: articles.length,
      pollution: 0,
      government: 0,
      legal: 0,
      local: 0,
      general: 0,
    };

    for (const a of articles) {
      if (counts[a.category] !== undefined) {
        counts[a.category]++;
      }
    }

    return counts;
  }, [articles]);

  return (
    <div className="min-h-screen bg-[#0B1220] pb-20 pt-6">
      {/* Floating Pill: "X new stories — click to load" */}
      {pendingStories.length > 0 && (
        <div className="fixed top-20 left-0 right-0 z-40 flex justify-center px-4 pointer-events-none">
          <button
            onClick={handleLoadPendingStories}
            className="pointer-events-auto group flex items-center gap-3 rounded-full border border-[#22D3EE] bg-[#121C2E]/95 px-5 py-2.5 text-xs sm:text-sm font-semibold text-[#22D3EE] shadow-[0_0_25px_rgba(34,211,238,0.35)] backdrop-blur-md transition-all duration-300 hover:scale-105 hover:bg-[#22D3EE]/15 active:scale-95 animate-bounce"
          >
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#22D3EE] opacity-75"></span>
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-[#22D3EE]"></span>
            </span>
            <Sparkles className="h-4 w-4 text-[#22D3EE]" />
            <span>
              {pendingStories.length} new {pendingStories.length === 1 ? 'story' : 'stories'} — click to load
            </span>
            <ArrowUpCircle className="h-4 w-4 text-[#22D3EE] transition-transform group-hover:-translate-y-0.5" />
          </button>
        </div>
      )}

      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 space-y-6">
        {/* Page Header */}
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 border-b border-[#1E2C42] pb-6">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-[#22D3EE]/30 bg-[#22D3EE]/10 px-3 py-1 text-xs font-mono font-medium text-[#22D3EE]">
              <Radio className="h-3 w-3 animate-pulse" />
              RIVER BASIN INTELLIGENCE & NEWS
            </div>
            <h1 className="mt-3 text-2xl sm:text-3xl font-bold tracking-tight text-[#E6EDF7]">
              Indrayani River News Feed
            </h1>
            <p className="mt-1 text-sm text-[#8A9BB4] max-w-2xl">
              Live tracking of water pollution incidents, MPCB enforcement, municipal sewage infrastructure,
              and community advocacy along the Indrayani corridor.
            </p>
          </div>

          {/* Sync & Refresh Meta Controls */}
          <div className="flex items-center gap-3 self-start md:self-auto">
            {/* Countdown pill */}
            <div className="flex flex-col items-end text-right">
              <span className="text-[11px] font-mono text-[#8A9BB4] tabular-nums">
                Next poll in: <strong className="text-[#22D3EE]">{secondsUntilNextPoll}s</strong>
              </span>
              <span className="text-[10px] text-[#8A9BB4]/60">
                Last checked: {lastPolledTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>

            {/* Manual Refresh Button */}
            <button
              onClick={() => fetchNews(false)}
              disabled={isRefreshing || isLoading}
              title="Poll for new stories immediately"
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#1E2C42] bg-[#121C2E] text-[#8A9BB4] transition-colors hover:border-[#22D3EE]/50 hover:text-[#22D3EE] disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin text-[#22D3EE]' : ''}`} />
            </button>

            {/* Test Simulation Button (for interactive verification) */}
            <button
              onClick={handleSimulateNewStory}
              title="Simulate incoming real-time news story (to demonstrate floating pill with zero reflow)"
              className="hidden sm:inline-flex items-center gap-1.5 rounded-lg border border-[#1E2C42] bg-[#121C2E] px-3 py-1.5 text-xs font-medium text-[#CBD5E1] transition-all hover:border-[#22D3EE]/40 hover:text-[#22D3EE]"
            >
              <Sparkles className="h-3 w-3 text-[#22D3EE]" />
              Simulate Story
            </button>
          </div>
        </div>

        {/* Error notice if API fails */}
        {errorMsg && (
          <div className="flex items-center justify-between gap-3 rounded-lg border border-[#EF4444]/30 bg-[#EF4444]/10 p-3 text-xs text-[#FCA5A5]">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0 text-[#EF4444]" />
              <span>Notice: {errorMsg}. Displaying cached regional basin stories.</span>
            </div>
            <button
              onClick={() => fetchNews(true)}
              className="inline-flex items-center gap-1.5 rounded-md border border-[#EF4444]/40 bg-[#EF4444]/15 px-3 py-1.5 text-xs font-semibold text-[#FCA5A5] hover:bg-[#EF4444]/25 hover:border-[#EF4444] transition-colors"
            >
              <RefreshCw className="h-3 w-3" />
              Retry fetch
            </button>
          </div>
        )}

        {/* "Related to your data" top strip */}
        <StationDataStrip
          stations={stations}
          readings={latestReadings}
          articles={articles}
          selectedStationId={selectedStationId}
          onSelectStation={(stId) => setSelectedStationId(stId)}
        />

        {/* Filter Chips & Search Bar */}
        <NewsFilterChips
          selectedCategory={selectedCategory}
          onSelectCategory={(cat) => setSelectedCategory(cat)}
          categoryCounts={categoryCounts}
          searchQuery={searchQuery}
          onSearchChange={(q) => setSearchQuery(q)}
        />

        {/* Active Filter Indicator if station is selected */}
        {selectedStationId && (
          <div className="flex items-center justify-between rounded-lg border border-[#22D3EE]/30 bg-[#22D3EE]/10 px-4 py-2 text-xs text-[#22D3EE]">
            <span>
              Filtering stories mentioning station <strong>{selectedStationId}</strong> (
              {stations.find((s) => s.id === selectedStationId)?.name})
            </span>
            <button
              onClick={() => setSelectedStationId(null)}
              className="font-semibold underline hover:text-[#E6EDF7]"
            >
              Show all stations
            </button>
          </div>
        )}

        {/* Main Grid: Articles or Skeletons */}
        {isLoading ? (
          /* Initial Load Skeletons */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="flex flex-col overflow-hidden rounded-xl border border-[#1E2C42] bg-[#121C2E] p-0 animate-pulse"
              >
                <div className="h-44 w-full bg-[#1E2C42]/60" />
                <div className="p-5 space-y-3">
                  <div className="h-4 w-3/4 rounded bg-[#1E2C42]" />
                  <div className="h-4 w-1/2 rounded bg-[#1E2C42]" />
                  <div className="space-y-1.5 pt-2">
                    <div className="h-3 w-full rounded bg-[#1E2C42]/70" />
                    <div className="h-3 w-5/6 rounded bg-[#1E2C42]/70" />
                  </div>
                  <div className="h-6 w-1/3 rounded-full bg-[#1E2C42] pt-2" />
                </div>
              </div>
            ))}
          </div>
        ) : filteredArticles.length === 0 ? (
          /* Empty State */
          <div className="flex flex-col items-center justify-center rounded-2xl border border-[#1E2C42] bg-[#121C2E]/40 py-16 text-center">
            <Newspaper className="h-12 w-12 text-[#8A9BB4]/40" />
            <h3 className="mt-4 text-base font-semibold text-[#E6EDF7]">
              No articles match current filters
            </h3>
            <p className="mt-1 text-xs text-[#8A9BB4] max-w-sm">
              Try adjusting your category selection, station filter, or search query to find relevant stories.
            </p>
            <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
              <button
                onClick={() => fetchNews(true)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[#1E2C42] bg-[#121C2E] px-4 py-2 text-xs font-semibold text-[#CBD5E1] hover:border-[#22D3EE]/50 hover:text-[#22D3EE] transition-colors"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Refresh articles
              </button>
              <button
                onClick={() => {
                  setSelectedCategory('all');
                  setSelectedStationId(null);
                  setSearchQuery('');
                }}
                className="rounded-lg border border-[#22D3EE]/40 bg-[#22D3EE]/10 px-4 py-2 text-xs font-semibold text-[#22D3EE] hover:bg-[#22D3EE]/20 transition-colors"
              >
                Reset all filters
              </button>
            </div>
          </div>
        ) : (
          /* Articles Grid */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredArticles.map((article) => (
              <NewsCard
                key={article.id}
                article={article}
                isNew={newlyInsertedIds.has(article.id)}
                stations={stations}
                readings={latestReadings}
                onStationClick={(stId) => setSelectedStationId(stId)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
