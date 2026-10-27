"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { VIDEOS, type Video } from "@/lib/videos";

function PlayIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M8 5.4 19 12 8 18.6V5.4Z" fill="currentColor" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M6.5 6.5l11 11m0-11-11 11"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function VideoWall() {
  const [active, setActive] = useState<Video | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!active) return;

    const panel = panelRef.current;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setActive(null);
        return;
      }

      if (event.key !== "Tab" || !panel) return;

      const focusable = panel.querySelectorAll<HTMLElement>(
        "button, [href], iframe, [tabindex]:not([tabindex='-1'])",
      );
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
      triggerRef.current?.focus();
    };
  }, [active]);

  return (
    <section className="section video-wall" id="videos" aria-labelledby="videos-title">
      <div className="container">
        <div className="video-wall__head">
          <div>
            <span className="eyebrow">On camera</span>
            <h2 id="videos-title">Arundathi, on video.</h2>
            <p>
              A look around the campus and the hospital, plus how admissions,
              fees and counselling actually work — filmed by the people who
              visited us.
            </p>
          </div>
          <span className="video-wall__hint" aria-hidden="true">
            Swipe for more
          </span>
        </div>

        <div className="video-row">
          {VIDEOS.map((video) => (
            <button
              key={video.id}
              type="button"
              className="video-card"
              aria-haspopup="dialog"
              aria-label={`Play: ${video.title} (${video.duration}), ${video.source}`}
              onClick={(event) => {
                triggerRef.current = event.currentTarget;
                setActive(video);
              }}
            >
              <span className="video-card__thumb">
                <Image
                  src={`/images/videos/${video.id}.jpg`}
                  alt=""
                  fill
                  sizes="(max-width: 760px) 78vw, 33vw"
                />
                <span className="video-card__scrim" aria-hidden="true" />
                <span className="video-card__play" aria-hidden="true">
                  <PlayIcon />
                </span>
                <span className="video-card__time" aria-hidden="true">
                  {video.duration}
                </span>
              </span>
              <span className="video-card__body">
                <span className="video-card__source">{video.source}</span>
                <span className="video-card__title">{video.title}</span>
              </span>
            </button>
          ))}
        </div>
      </div>

      {active ? (
        <div
          className="video-modal"
          onClick={(event) => {
            if (event.target === event.currentTarget) setActive(null);
          }}
        >
          <div
            className="video-modal__panel"
            role="dialog"
            aria-modal="true"
            aria-label={active.title}
            ref={panelRef}
          >
            <div className="video-modal__frame">
              <iframe
                key={active.id}
                src={`https://www.youtube-nocookie.com/embed/${active.id}?autoplay=1&rel=0&modestbranding=1&playsinline=1&hl=en`}
                title={active.title}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
              />
            </div>

            <div className="video-modal__meta">
              <div className="video-modal__copy">
                <strong>{active.title}</strong>
                <span>
                  {active.source} · {active.duration}
                </span>
              </div>
              <a
                className="video-modal__link"
                href={`https://www.youtube.com/watch?v=${active.id}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                Watch on YouTube
              </a>
              <button
                type="button"
                className="video-modal__close"
                aria-label="Close video"
                ref={closeRef}
                onClick={() => setActive(null)}
              >
                <CloseIcon />
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
