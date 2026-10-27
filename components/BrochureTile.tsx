"use client";

import { useEffect, useState } from "react";
import { BROCHURE } from "@/lib/institution";

function ArrowUpRight() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M7 17 17 7M8 7h9v9"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 4v11m0 0 4-4m-4 4-4-4M5 19h14"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function BrochureIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M5 4.75h6.5a2.5 2.5 0 0 1 2.5 2.5V20a2 2 0 0 0-2-2H5V4.75Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path
        d="M19 4.75h-6.5A2.5 2.5 0 0 0 10 7.25V20a2 2 0 0 1 2-2h7V4.75Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * A phone cannot show a PDF inside a page reliably, so the tile opens the
 * brochure straight in the browser viewer on pointer devices and hands the file
 * to the device's download manager on phones and tablets.
 */
function prefersDownload() {
  if (typeof navigator === "undefined" || typeof window === "undefined") {
    return false;
  }

  const ua = navigator.userAgent;
  if (/Android|iPhone|iPad|iPod|IEMobile|Opera Mini|Mobile|Tablet/i.test(ua)) {
    return true;
  }

  // iPadOS 13+ reports itself as a Macintosh but exposes touch points.
  if (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1) {
    return true;
  }

  return window.matchMedia("(hover: none) and (pointer: coarse)").matches;
}

export function BrochureTile() {
  const [downloadMode, setDownloadMode] = useState(false);
  const [started, setStarted] = useState(false);

  useEffect(() => {
    setDownloadMode(prefersDownload());
  }, []);

  useEffect(() => {
    if (!started) return;
    const timer = window.setTimeout(() => setStarted(false), 5000);
    return () => window.clearTimeout(timer);
  }, [started]);

  const details = `PDF · ${BROCHURE.pages} pages · ${BROCHURE.sizeLabel}`;

  const content = (
    <>
      <span className="quick__icon">
        <BrochureIcon />
      </span>
      <div>
        <span className="quick__eyebrow">Brochure</span>
        <h3>The AIMS brochure</h3>
        <span className="quick__meta">{details}</span>
        <span className="quick__action" aria-live="polite">
          {downloadMode
            ? started
              ? "Starting your download…"
              : "Download the brochure"
            : "Open the brochure"}
          {downloadMode ? <DownloadIcon /> : <ArrowUpRight />}
        </span>
      </div>
    </>
  );

  if (downloadMode) {
    return (
      <a
        className="quick quick--gold quick--brochure"
        href={BROCHURE.href}
        download={BROCHURE.fileName}
        onClick={() => setStarted(true)}
        aria-label={`Download the AIMS brochure, a ${BROCHURE.sizeLabel} PDF, ${BROCHURE.pages} pages`}
      >
        {content}
      </a>
    );
  }

  return (
    <a
      className="quick quick--gold quick--brochure"
      href={BROCHURE.href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`Open the AIMS brochure, a ${BROCHURE.sizeLabel} PDF, ${BROCHURE.pages} pages, in a new tab`}
    >
      {content}
    </a>
  );
}
