//Newsletter.tsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Mail, Search, Link, Lock, FileText } from "lucide-react";
import { getEnrichedNewsletterCampaigns } from "../../api/newsletter";
import type { NewsletterCampaign } from "../../types";
import { logger } from "../../utils/logger";

export default function Newsletter({ listId }: { listId?: string }) {
  const [campaigns, setCampaigns] = useState<NewsletterCampaign[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  // UI state
  const [query, setQuery] = useState("");
  const [year, setYear] = useState<string>("all");
  const [sort, setSort] = useState<"newest" | "oldest">("newest");
  const [view, setView] = useState<"grid" | "list">("grid");
  const [openId, setOpenId] = useState<string | null>(null);

  const limit = 10;
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  // ------- Data Fetch -------
  const fetchCampaigns = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await getEnrichedNewsletterCampaigns(listId, 1, limit);
      
      // after fetching the first page
      setCampaigns((prev) => {
        const map = new Map(prev.map(x => [x.id, x]));
        for (const it of data.campaigns) if (!map.has(it.id)) map.set(it.id, it);
        return Array.from(map.values());
      });
      setHasMore(data.hasMore);
      setPage(1);
    } catch (err) {
      setError(
        "We couldn't load newsletters right now. Please try again shortly."
      );
      logger.error("❌ Error fetching newsletter campaigns:", err);
    } finally {
      setIsLoading(false);
    }
  }, [listId, limit]);

  useEffect(() => {
    fetchCampaigns();
  }, [fetchCampaigns]);

  const loadMore = useCallback(async () => {
    if (isLoadingMore || !hasMore) return;
    try {
      setIsLoadingMore(true);
      const nextPage = page + 1;
      const data = await getEnrichedNewsletterCampaigns(listId, nextPage, limit);
      
      setCampaigns((prev) => {
        const map = new Map(prev.map(x => [x.id, x]));
        for (const it of data.campaigns) if (!map.has(it.id)) map.set(it.id, it);
        return Array.from(map.values());
      });
      
      setHasMore(data.hasMore);
      setPage(nextPage);
    } catch (err) {
      logger.error("❌ Error loading more campaigns:", err);
    } finally {
      setIsLoadingMore(false);
    }
  }, [isLoadingMore, hasMore, page, listId, limit]);

  // Infinite scroll (progressive enhancement)
  useEffect(() => {
    if (!hasMore) return;
    const node = sentinelRef.current;
    if (!node) return;

    const obs = new IntersectionObserver(
      (entries) => {
        const first = entries[0];
        if (first.isIntersecting) {
          loadMore();
        }
      },
      { rootMargin: "800px 0px" }
    );

    obs.observe(node);
    return () => obs.disconnect();
  }, [hasMore, page, loadMore]);

  // Handle escape key to close modal
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && openId) {
        setOpenId(null);
      }
    };

    if (openId) {
      document.addEventListener('keydown', handleEscape);
      return () => document.removeEventListener('keydown', handleEscape);
    }
  }, [openId]);

  // ------- Derived UI -------
  const formatDate = (dateString?: string) => {
    if (!dateString) return "Draft";
    const d = new Date(dateString);
    if (Number.isNaN(d.getTime())) return "Draft";
    return d.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const allYears = useMemo(() => {
    const years = new Set<string>();
    campaigns.forEach((c) => {
      const raw = c.sentAt || c.createdAt;
      if (!raw) return;
      const y = new Date(raw).getFullYear();
      if (!Number.isNaN(y) && y >= 2025) years.add(String(y));
    });
    return ["all", ...Array.from(years).sort((a, b) => Number(b) - Number(a))];
  }, [campaigns]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = campaigns.filter((c) => !!c.sentAt); // only sent

    // Filter to only show newsletters sent after August 27, 2025
    const cutoffDate = new Date('2025-08-27');
    list = list.filter((c) => {
      const sentDate = c.sentAt ? new Date(c.sentAt) : null;
      if (!sentDate) return false;
      return sentDate > cutoffDate;
    });

    if (year !== "all") {
      list = list.filter((c) => {
        const raw = c.sentAt || c.createdAt;
        if (!raw) return false;
        return new Date(raw).getFullYear() === Number(year);
      });
    }

    if (q) {
      list = list.filter((c) => {
        const hay = `${c.name} ${c.subject}`.toLowerCase();
        return hay.includes(q);
      });
    }

    list.sort((a, b) => {
      const da = new Date(a.sentAt || a.createdAt).getTime();
      const db = new Date(b.sentAt || b.createdAt).getTime();
      return sort === "newest" ? db - da : da - db;
    });

    return list;
  }, [campaigns, query, year, sort]);

  // ------- UI -------
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero */}
      <header className="pt-4 bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="text-center">
            <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-gray-900">
              GAPI Newsletter
            </h1>
            <p className="mt-3 text-lg text-gray-600 max-w-2xl mx-auto">
              The latest news, events, and announcements from the Georgia
              Association of Physicians of Indian Heritage.
            </p>

            <div className="mt-8">
              <a
                href="/newsletter/subscribe"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-red text-white font-semibold shadow-sm hover:bg-red/90 focus:outline-none focus:ring-2 focus:ring-red focus:ring-offset-2"
              >
                <Mail className="w-5 h-5" />
                Subscribe to updates
              </a>
            </div>
          </div>

          {/* Controls */}
          <div className="mt-10 grid grid-cols-1 md:grid-cols-12 gap-3 md:gap-4">
            <div className="md:col-span-6">
              <label className="sr-only" htmlFor="nl-search">
                Search newsletters
              </label>
              <div className="relative">
                <input
                  id="nl-search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search by title or subject…"
                  className="w-full rounded-xl border border-gray-300 bg-white px-4 py-2.5 pr-10 text-gray-900 placeholder:text-gray-400 focus:border-red focus:ring-2 focus:ring-red/20"
                />
                <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center">
                  <Search className="w-5 h-5 text-gray-400" />
                </div>
              </div>
            </div>

            <div className="md:col-span-4 flex gap-3">
              <div className="flex-1">
                <label className="sr-only" htmlFor="nl-year">
                  Filter by year
                </label>
                <select
                  id="nl-year"
                  value={year}
                  onChange={(e) => setYear(e.target.value)}
                  className="w-full rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-gray-900 focus:border-red focus:ring-2 focus:ring-red/20"
                >
                  {allYears.map((y) => (
                    <option key={y} value={y}>
                      {y === "all" ? "All years" : y}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex-1">
                <label className="sr-only" htmlFor="nl-sort">
                  Sort
                </label>
                <select
                  id="nl-sort"
                  value={sort}
                  onChange={(e) => setSort(e.target.value as any)}
                  className="w-full rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-gray-900 focus:border-red focus:ring-2 focus:ring-red/20"
                >
                  <option value="newest">Newest first</option>
                  <option value="oldest">Oldest first</option>
                </select>
              </div>
            </div>

            <div className="md:col-span-2 flex justify-center">
              <div className="flex rounded-xl border border-gray-300 overflow-hidden">
                <button
                  type="button"
                  onClick={() => setView("grid")}
                  className={`px-4 py-2.5 text-sm font-medium transition-colors ${
                    view === "grid" ? "bg-gray-100 text-gray-900" : "bg-white text-gray-600 hover:bg-gray-50"
                  }`}
                  aria-pressed={view === "grid"}
                >
                  Grid
                </button>
                <button
                  type="button"
                  onClick={() => setView("list")}
                  className={`px-4 py-2.5 text-sm font-medium transition-colors ${
                    view === "list" ? "bg-gray-100 text-gray-900" : "bg-white text-gray-600 hover:bg-gray-50"
                  }`}
                  aria-pressed={view === "list"}
                >
                  List
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {/* Error state */}
        {error && (
          <section className="py-24 text-center">
            <div className="mx-auto h-16 w-16 text-red-500 mb-4">
              <Mail className="w-full h-full" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              Something went wrong
            </h3>
            <p className="text-gray-600 max-w-md mx-auto mb-6">
              {error}
            </p>
            <button
              onClick={() => window.location.reload()}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl border-2 border-red text-red font-semibold hover:bg-red hover:text-white transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Try again
            </button>
          </section>
        )}

        {/* Empty state */}
        {!error && !isLoading && filtered.length === 0 && (
          <section className="py-24 text-center">
            <div className="mx-auto h-16 w-16 text-gray-300 mb-4">
              <Mail className="w-full h-full" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">
              No newsletters available
            </h3>
            <p className="text-gray-600 max-w-md mx-auto">
              No newsletters match your current filters. Try adjusting your search or year selection.
            </p>
          </section>
        )}

        {/* Skeletons */}
        {isLoading && (
          <CampaignSkeletons view={view} />
        )}

        {/* Results */}
        {!error && !isLoading && filtered.length > 0 && (
          <section aria-live="polite">
            {view === "grid" ? (
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {filtered.map((c) => (
                  <CampaignCard key={c.id} c={c} formatDate={formatDate} setOpenId={setOpenId} />)
                )}
              </div>
            ) : (
              <ul className="divide-y divide-gray-200 bg-white rounded-xl border border-gray-200">
                {filtered.map((c) => (
                  <li key={c.id} className="p-5">
                    <CampaignRow c={c} formatDate={formatDate} setOpenId={setOpenId} />
                  </li>
                ))}
              </ul>
            )}

            {/* Load More (fallback for users without IntersectionObserver or when reaching the end) */}
            {hasMore && (
              <div className="text-center mt-10">
                <button
                  onClick={loadMore}
                  disabled={isLoadingMore}
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-xl border-2 border-red text-red font-semibold disabled:border-gray-300 disabled:text-gray-400 disabled:cursor-not-allowed"
                >
                  {isLoadingMore && (
                    <span className="animate-spin h-5 w-5 border-b-2 border-current rounded-full" />
                  )}
                  {isLoadingMore ? "Loading more…" : "Load more"}
                </button>
              </div>
            )}

            {/* Sentinel for auto-load */}
            {hasMore && <div ref={sentinelRef} className="h-1" />}
          </section>
        )}
      </main>

      {/* Newsletter Reader Modal */}
      {openId && (
        <div 
          className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
          onClick={(e) => {
            // Close modal when clicking outside the content
            if (e.target === e.currentTarget) {
              setOpenId(null);
            }
          }}
        >
          <div className="bg-white w-full max-w-7xl h-[90vh] rounded-xl overflow-hidden relative">
            <button
              onClick={() => setOpenId(null)}
              className="absolute top-3 right-3 p-2 rounded-md border bg-white shadow-sm hover:bg-gray-50 z-10"
            >
              <span className="sr-only">Close</span>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <iframe
              title="Newsletter Content"
              className="w-full h-full border-0"
              // Content is sanitized on the backend to remove all scripts and dangerous elements
              sandbox="allow-same-origin allow-forms allow-popups allow-top-navigation"
              src={(() => {
                // Use full backend URL so Vite proxy can intercept /api requests
                const campaign = campaigns.find(x => x.id === openId);
                if (!campaign?.absoluteViewUrl) return undefined;
                return campaign.absoluteViewUrl;
              })()}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ---- Subcomponents ----

function CampaignCard({
  c,
  formatDate,
  setOpenId,
}: {
  c: NewsletterCampaign;
  formatDate: (d?: string) => string;
  setOpenId: (id: string) => void;
}) {
  const [copySuccess, setCopySuccess] = useState(false);
  const dateStr = formatDate(c.sentAt || c.createdAt);

  return (
    <article className="group relative overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm transition hover:shadow-md focus-within:shadow-md">
      {/* Thumb */}
      <div className="aspect-[16/10] w-full bg-gray-100 overflow-hidden">
        {c.previewImageUrl ? (
          <img
            src={c.previewImageUrl}
            alt=""
            className="h-full w-full object-cover"
            loading="lazy"

          />
        ) : (
          <div className="flex h-full items-center justify-center text-gray-300">
            <FileText className="h-12 w-12" />
          </div>
        )}
      </div>

      {/* Body */}
      <div className="p-5 flex flex-col gap-2">
        <h3 className="text-base font-semibold leading-tight text-gray-900 line-clamp-2">
          {c.name}
        </h3>
        {c.subject && (
          <p className="text-sm text-gray-600 line-clamp-2">{c.subject}</p>
        )}
        {c.previewSnippet && (
          <p className="text-sm text-gray-600 line-clamp-2">{c.previewSnippet}</p>
        )}
        <p className="mt-1 text-sm text-gray-500">{dateStr}</p>

        <div className="mt-3 flex items-center gap-2">
          {c.absoluteViewUrl ? (
            <button
              onClick={() => setOpenId(c.id)}
              className="inline-flex items-center gap-2 rounded-lg bg-red px-3 py-2 text-sm font-semibold text-white hover:bg-red/90"
            >
              <FileText className="h-4 w-4" /> Read
            </button>
          ) : (
            <span className="inline-flex items-center gap-2 rounded-lg bg-gray-100 px-3 py-2 text-sm font-medium text-gray-500">
              <Lock className="h-4 w-4" /> Unavailable
            </span>
          )}

          {c.absoluteViewUrl && (
            <button
              type="button"
              onClick={async () => {
                const success = await copyLink(c.absoluteViewUrl);
                if (success) {
                  setCopySuccess(true);
                  setTimeout(() => setCopySuccess(false), 2000); // Reset after 2 seconds
                }
              }}
              className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                copySuccess
                  ? 'border-green-500 bg-green-50 text-green-700'
                  : 'border-gray-300 text-gray-700 hover:bg-gray-50'
              }`}
            >
              {copySuccess ? (
                <>
                  <svg className="h-4 w-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Copied!
                </>
              ) : (
                <>
                  <Link className="h-4 w-4" />
                  Copy link
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </article>
  );
}

function CampaignRow({
  c,
  formatDate,
  setOpenId,
}: {
  c: NewsletterCampaign;
  formatDate: (d?: string) => string;
  setOpenId: (id: string) => void;
}) {
  const [copySuccess, setCopySuccess] = useState(false);
  const dateStr = formatDate(c.sentAt || c.createdAt);
  return (
    <div className="flex items-start gap-4">
      <div className="hidden sm:block h-16 w-24 flex-shrink-0 overflow-hidden rounded-lg bg-gray-100">
        {c.previewImageUrl ? (
          <img 
            src={c.previewImageUrl} 
            alt="" 
            className="h-full w-full object-cover" 
            loading="lazy" 
          />
        ) : (
          <div className="flex h-full items-center justify-center text-gray-300">
            <FileText className="h-8 w-8" />
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <h3 className="text-base font-semibold text-gray-900 leading-tight">
          {c.name}
        </h3>
        {c.subject && (
          <p className="mt-0.5 text-sm text-gray-600">{c.subject}</p>
        )}
        {c.previewSnippet && (
          <p className="mt-0.5 text-sm text-gray-600 line-clamp-2">{c.previewSnippet}</p>
        )}
        <p className="mt-1 text-sm text-gray-500">{dateStr}</p>
      </div>
      <div className="flex items-center gap-2">
        {c.absoluteViewUrl ? (
          <button
            onClick={() => setOpenId(c.id)}
            className="inline-flex items-center gap-2 rounded-lg bg-red px-3 py-2 text-sm font-semibold text-white hover:bg-red/90"
          >
            <FileText className="h-4 w-4" /> Read
          </button>
        ) : (
          <span className="inline-flex items-center gap-2 rounded-lg bg-gray-100 px-3 py-2 text-sm font-medium text-gray-500">
            <Lock className="h-4 w-4" /> Unavailable
          </span>
        )}
        {c.absoluteViewUrl && (
          <button
            type="button"
            onClick={async () => {
              const success = await copyLink(c.absoluteViewUrl);
              if (success) {
                setCopySuccess(true);
                setTimeout(() => setCopySuccess(false), 2000); // Reset after 2 seconds
              }
            }}
            className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
              copySuccess
                ? 'border-green-500 bg-green-50 text-green-700'
                : 'border-gray-300 text-gray-700 hover:bg-gray-50'
            }`}
          >
            {copySuccess ? (
              <>
                <svg className="h-4 w-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Copied!
              </>
            ) : (
              <>
                <Link className="h-4 w-4" />
                Copy link
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
}

function CampaignSkeletons({ view }: { view: "grid" | "list" }) {
  if (view === "list") {
    return (
      <ul className="divide-y divide-gray-200 bg-white rounded-xl border border-gray-200">
        {Array.from({ length: 6 }).map((_, i) => (
          <li key={i} className="p-5">
            <div className="flex items-start gap-4 animate-pulse">
              <div className="hidden sm:block h-16 w-24 rounded-lg bg-gray-200" />
              <div className="min-w-0 flex-1 space-y-2">
                <div className="h-4 w-3/5 rounded bg-gray-200" />
                <div className="h-3 w-4/5 rounded bg-gray-200" />
                <div className="h-3 w-2/5 rounded bg-gray-200" />
              </div>
              <div className="h-9 w-28 rounded-lg bg-gray-200" />
            </div>
          </li>
        ))}
      </ul>
    );
  }
  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 9 }).map((_, i) => (
        <div key={i} className="overflow-hidden rounded-2xl border border-gray-200 bg-white animate-pulse">
          <div className="aspect-[16/10] bg-gray-200" />
          <div className="p-5 space-y-2">
            <div className="h-4 w-3/5 rounded bg-gray-200" />
            <div className="h-3 w-4/5 rounded bg-gray-200" />
            <div className="h-3 w-2/5 rounded bg-gray-200" />
            <div className="mt-3 h-9 w-28 rounded-lg bg-gray-200" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ---- utilities ----
async function copyLink(url: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(url);
    return true; // Success
  } catch (e) {
    logger.warn("Clipboard copy failed", e);
    return false; // Failed
  }
}