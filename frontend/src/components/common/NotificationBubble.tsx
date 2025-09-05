// frontend/src/components/common/NotificationBubble.tsx
import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { MessageCircle, X } from "lucide-react";

type Placement = "bottom-left" | "bottom-right" | "top-left" | "top-right";
type Tone = "neutral" | "brand" | "glass";

interface NotificationAction {
  label: string;
  onClick: () => void;
  variant?: "primary" | "ghost";
  ariaLabel?: string;
}

interface NotificationBubbleProps {
  message: React.ReactNode;
  title?: string;
  onDismiss?: () => void;
  className?: string;
  badgeCount?: number;
  defaultOpen?: boolean;
  persistentKey?: string;
  placement?: Placement; // default bottom-left
  tone?: Tone;           // default glass
  actions?: NotificationAction[];
  ariaLabels?: {
    open?: string;
    close?: string;
    dismiss?: string;
  };
}

export default function NotificationBubble({
  message,
  title = "Notice",
  onDismiss,
  className = "",
  badgeCount = 1,
  defaultOpen = false,
  persistentKey,
  placement = "bottom-left",
  tone = "glass",
  actions = [],
  ariaLabels = {
    open: "Open notification",
    close: "Close notification",
    dismiss: "Don't show again",
  },
}: NotificationBubbleProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  const panelId = useId();
  const titleId = useId();

  const containerRef = useRef<HTMLDivElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);

  // persistence
  useEffect(() => {
    if (!persistentKey) return;
    try {
      if (localStorage.getItem(persistentKey) === "dismissed") setIsDismissed(true);
    } catch {}
  }, [persistentKey]);

  useEffect(() => {
    if (!isDismissed && defaultOpen) setIsOpen(true);
  }, [isDismissed, defaultOpen]);

  const handleToggle = useCallback(() => setIsOpen(v => !v), []);
  const handleClose  = useCallback(() => setIsOpen(false), []);
  const persistDismissal = useCallback(() => {
    if (!persistentKey) return;
    try { localStorage.setItem(persistentKey, "dismissed"); } catch {}
  }, [persistentKey]);
  const handleDismiss = useCallback(() => {
    setIsDismissed(true);
    persistDismissal();
    onDismiss?.();
  }, [onDismiss, persistDismissal]);

  // ESC to close
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setIsOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [isOpen]);

  // outside click
  useEffect(() => {
    if (!isOpen) return;
    const onDocClick = (e: MouseEvent) => {
      const t = e.target as Node;
      const launcher = containerRef.current?.querySelector("[data-role='nb-launcher']");
      if (panelRef.current?.contains(t)) return;
      if (launcher && launcher.contains(t)) return;
      setIsOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [isOpen]);

  // placement (more breathing room + safe-area)
  const placementClass = useMemo(() => {
    const base = [
      "fixed z-50",
      // a bit farther from edges + respect notches
      "pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)] pt-[env(safe-area-inset-top)]",
    ].join(" ");
    switch (placement) {
      case "bottom-left":  return `${base} bottom-8 left-8 lg:bottom-10 lg:left-10`;
      case "bottom-right": return `${base} bottom-8 right-8 lg:bottom-10 lg:right-10`;
      case "top-left":     return `${base} top-8 left-8 lg:top-10 lg:left-10`;
      case "top-right":    return `${base} top-8 right-8 lg:top-10 lg:right-10`;
    }
  }, [placement]);

  // tone presets
  const tonePanel = useMemo(() => {
    switch (tone) {
      case "neutral":
        return "bg-white border border-neutral/30 text-neutral-800 shadow-lg";
      case "brand":
        return "bg-neutral-50 border border-neutral/20 text-neutral-900 shadow-lg";
      case "glass":
      default:
        return "backdrop-blur-md bg-white/80 border border-neutral/20 text-neutral-900 shadow-lg";
    }
  }, [tone]);

  const toneLauncher = useMemo(() => {
    switch (tone) {
      case "neutral":
        return "bg-neutral-800 text-white hover:bg-neutral-700";
      case "brand":
        return "bg-neutral-900 text-white hover:bg-neutral-800";
      case "glass":
      default:
        return "bg-neutral-900/90 text-white hover:bg-neutral-900";
    }
  }, [tone]);

  if (isDismissed) return null;

  // Align the panel to the same side as the placement so it doesn't "push" the launcher.
  const panelAlign =
    placement.endsWith("left") ? "left-0" :
    placement.endsWith("right") ? "right-0" : "left-0";

  return (
    <div ref={containerRef} className={`${placementClass} ${className}`}>
      <div className="relative w-fit">
        {/* PANEL */}
        {isOpen && (
          <div
            ref={panelRef}
            id={panelId}
            role="dialog"
            aria-labelledby={titleId}
            aria-modal="false"
            className={[
              "absolute bottom-full mb-3", // sit above the button
              panelAlign,
              "w-[22em] max-w-[90vw] rounded-xl",
              "p-[1em] motion-safe:transition-all motion-safe:duration-200",
              tonePanel,
            ].join(" ")}
            style={{ animation: "nb-slide-in 140ms ease-out both" }}
          >
            <style>{`
              @keyframes nb-slide-in {
                from { opacity: 0; transform: translateY(0.25rem) scale(0.98); }
                to { opacity: 1; transform: translateY(0) scale(1); }
              }
            `}</style>

            <div className="flex items-start justify-between gap-[0.75em] mb-[0.5em]">
              <h3 id={titleId} className="font-semibold text-[1em] leading-6">
                {title}
              </h3>
              <button
                onClick={handleClose}
                className="text-neutral-500 hover:text-neutral-800 p-[0.35em] rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400/60"
                aria-label={ariaLabels.close}
                type="button"
              >
                <X className="w-[1.1em] h-[1.1em]" aria-hidden="true" />
              </button>
            </div>

            <div className="text-[0.95em] leading-relaxed mb-[0.9em]">
              {message}
            </div>

            {(actions.length > 0 || persistentKey) && (
              <div className="flex items-center justify-between gap-[0.75em]">
                <div className="flex items-center gap-[0.5em]">
                  {actions.map(({ label, onClick, variant = "primary", ariaLabel }, i) => (
                    <button
                      key={i}
                      onClick={onClick}
                      type="button"
                      aria-label={ariaLabel ?? label}
                      className={[
                        "rounded-lg text-[0.9em] px-[0.85em] py-[0.5em] transition-colors",
                        "focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400/60",
                        variant === "primary"
                          ? "bg-neutral-900 text-white hover:bg-neutral-800"
                          : "bg-transparent text-neutral-700 hover:text-neutral-900 underline underline-offset-4",
                      ].join(" ")}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                {persistentKey && (
                  <button
                    onClick={handleDismiss}
                    className="text-[0.85em] text-neutral-600 hover:text-neutral-900 underline underline-offset-4 focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400/60"
                    type="button"
                    aria-label={ariaLabels.dismiss}
                  >
                    Don’t show again
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* LAUNCHER */}
        <button
          data-role="nb-launcher"
          onClick={handleToggle}
          className={[
            "relative rounded-full shadow-lg p-[0.7em]",
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400/60",
            "transition-all duration-150 hover:shadow-xl hover:scale-105",
            toneLauncher,
          ].join(" ")}
          aria-label={ariaLabels.open}
          aria-expanded={isOpen}
          aria-controls={panelId}
          type="button"
        >
          <MessageCircle className="w-[2em] h-[2em]" aria-hidden="true" />

          {/* BADGE */}
          {!!badgeCount && badgeCount > 0 && (
            <span
              className={[
                "absolute top-0 right-0 translate-x-1/4 -translate-y-1/4",
                "rounded-full bg-red text-white font-semibold",
                "w-[1.5em] h-[1.5em] text-[0.8em]",
                "flex items-center justify-center",
                "select-none",
              ].join(" ")}
              aria-hidden="true"
            >
              {badgeCount > 9 ? "9+" : badgeCount}
            </span>
          )}
        </button>
      </div>
    </div>
  );
}
