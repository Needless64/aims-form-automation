import Image from "next/image";
import Link from "next/link";
import { INSTITUTION } from "@/lib/institution";

interface SiteHeaderProps {
  variant?: "home" | "enquiry";
}

function ArrowLeftIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M19.5 12h-14m5-5-5 5 5 5"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function GlobeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="8.25" stroke="currentColor" strokeWidth="1.6" />
      <path
        d="M3.75 12h16.5M12 3.75c2.1 2.2 3.15 4.95 3.15 8.25S14.1 18.05 12 20.25C9.9 18.05 8.85 15.3 8.85 12S9.9 5.95 12 3.75Z"
        stroke="currentColor"
        strokeWidth="1.4"
      />
    </svg>
  );
}

export function SiteHeader({ variant = "home" }: SiteHeaderProps) {
  const isEnquiry = variant === "enquiry";

  return (
    <header className="site-header">
      <div className="container site-header__inner">
        <Link className="brand" href="/" aria-label="AIMS home">
          <span className="brand__mark">
            {/* The crested emblem, cropped to the ink with a transparent
                background so it sits on this tile and any other surface. */}
            <Image
              src="/images/aims-emblem.png"
              alt=""
              width={90}
              height={79}
              unoptimized
              priority
            />
          </span>
          <span className="brand__copy">
            <strong className="brand__name">
              Arundathi Institute of Medical Sciences
            </strong>
            <strong className="brand__short" aria-hidden="true">
              AIMS
            </strong>
            <span className="brand__meta">
              <span className="brand__meta-detail">Dundigal · Estd. 2023</span>
              <span className="brand__meta-compact">Dundigal</span>
            </span>
          </span>
        </Link>

        <div className="header__actions">
          <a
            className="pill pill--site"
            href={INSTITUTION.website}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Official AIMS website"
          >
            <GlobeIcon />
            <span className="pill__label">aims.ac.in</span>
          </a>

          {isEnquiry ? (
            <Link className="pill pill--code" href="/">
              <ArrowLeftIcon />
              Home
            </Link>
          ) : (
            <Link
              className="pill pill--code"
              href="/enquire"
              aria-label="Begin an admissions enquiry"
            >
              <span className="pill__dot" aria-hidden="true" />
              AIMD
              <span className="pill__divider" aria-hidden="true" />
              2026–27
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
