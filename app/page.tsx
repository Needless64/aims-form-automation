import Image from "next/image";
import Link from "next/link";
import { BrochureTile } from "@/components/BrochureTile";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { VideoWall } from "@/components/VideoWall";
import { INSTITUTION } from "@/lib/institution";

function ArrowRight() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M4.5 12h14m-5-5 5 5-5 5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

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

function LinkedInIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M5.6 9.4h2.9v9.1H5.6V9.4Zm1.45-4.5a1.7 1.7 0 1 1 0 3.4 1.7 1.7 0 0 1 0-3.4ZM10.4 9.4h2.8v1.25h.04a3.1 3.1 0 0 1 2.78-1.53c2.36 0 2.98 1.55 2.98 3.9v5.48h-2.9v-4.86c0-1.16-.02-2.65-1.62-2.65-1.62 0-1.87 1.26-1.87 2.57v4.94h-2.9V9.4Z"
        fill="currentColor"
      />
    </svg>
  );
}

function PhoneIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M6.2 4.5h2.5l1.2 3-1.6 1.3a12 12 0 0 0 5 5l1.3-1.6 3 1.2v2.5c0 .9-.7 1.6-1.6 1.6A14.2 14.2 0 0 1 4.6 6.1c0-.9.7-1.6 1.6-1.6Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function PinIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 20s6-5.1 6-10a6 6 0 1 0-12 0c0 4.9 6 10 6 10Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="10" r="2.2" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}

interface QuickLinkProps {
  tone: "azure" | "gold" | "teal" | "stone";
  eyebrow: string;
  title: string;
  action: string;
  href: string;
  icon: React.ReactNode;
  external?: boolean;
}

function QuickLink({
  tone,
  eyebrow,
  title,
  action,
  href,
  icon,
  external = false,
}: QuickLinkProps) {
  const content = (
    <>
      <span className="quick__icon">{icon}</span>
      <div>
        <span className="quick__eyebrow">{eyebrow}</span>
        <h3>{title}</h3>
        <span className="quick__action">
          {action}
          {external ? <ArrowUpRight /> : <ArrowRight />}
        </span>
      </div>
    </>
  );

  if (external) {
    return (
      <a
        className={`quick quick--${tone}`}
        href={href}
        target="_blank"
        rel="noopener noreferrer"
      >
        {content}
      </a>
    );
  }

  return (
    <Link className={`quick quick--${tone}`} href={href}>
      {content}
    </Link>
  );
}

export default function HomePage() {
  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <SiteHeader />

      <main id="main">
        <section className="hero" aria-labelledby="hero-title">
          <div className="container hero__grid">
            <div>
              <span className="welcome">
                <span className="welcome__dot" aria-hidden="true" />
                Welcome to AIMS
              </span>
              <h1 id="hero-title">
                Your Medical Transformation <span>Begins Here.</span>
              </h1>
              <p className="hero__lead">
                Everything you need to explore admissions at Arundathi Institute
                of Medical Sciences — in one calm, simple place. A medical
                college and teaching hospital in Dundigal, Telangana.
              </p>
              <div className="hero__actions">
                <Link className="button" href="/enquire">
                  Start your admissions enquiry
                  <ArrowRight />
                </Link>
                <a
                  className="button button--ghost"
                  href={INSTITUTION.virtualTour}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Take the virtual tour
                </a>
              </div>
              <div className="hero__chips">
                <div className="chips">
                  <span className="chip-tag">NMC Approved</span>
                  <span className="chip-tag">KNRUHS Affiliated</span>
                  <span className="chip-tag">Dundigal, Hyderabad</span>
                  <span className="chip-tag">Estd. 2023</span>
                </div>
              </div>
            </div>

            <figure className="hero__visual">
              <Image
                src="/images/campus-main.webp"
                alt="The Arundathi Institute of Medical Sciences campus building in Dundigal, Telangana"
                width={2048}
                height={768}
                priority
                sizes="(max-width: 1020px) 100vw, 580px"
              />
              <figcaption className="hero__caption">
                <span>Campus · Dundigal, Hyderabad</span>
                <strong>Where care meets clinical learning.</strong>
              </figcaption>
            </figure>
          </div>
        </section>

        <section className="container quick-links" aria-label="Quick links">
          <BrochureTile />
          <QuickLink
            tone="azure"
            eyebrow="Network"
            title="LinkedIn"
            action="Follow AIMS"
            href={INSTITUTION.linkedin}
            icon={<LinkedInIcon />}
            external
          />
          <QuickLink
            tone="teal"
            eyebrow="Talk to us"
            title="Call admissions"
            action={INSTITUTION.phone}
            href={`tel:${INSTITUTION.phoneHref}`}
            icon={<PhoneIcon />}
            external
          />
          <QuickLink
            tone="stone"
            eyebrow="Find us"
            title="Visit the campus"
            action="Dundigal, Hyderabad"
            href={INSTITUTION.maps}
            icon={<PinIcon />}
            external
          />
        </section>

        <section className="section" id="discover" aria-labelledby="discover-title">
          <div className="container discover__grid">
            <div className="discover__media">
              <Image
                src="/images/campus-hospital.webp"
                alt="Arundathi Hospital entrance, the teaching hospital associated with AIMS"
                width={1600}
                height={1066}
                sizes="(max-width: 1020px) 100vw, 550px"
              />
              <span className="discover__tag">
                <PinIcon /> Dundigal, Telangana
              </span>
            </div>

            <div className="discover__copy">
              <span className="eyebrow">Discover AIMS</span>
              <h2 id="discover-title">
                A medical college built around patient care.
              </h2>
              <p>
                Arundathi Institute of Medical Sciences is a medical college and
                teaching hospital located beside MLRIT in Dundigal, Gandi
                Maisamma, Medchal-Malkajgiri District, Telangana. The institute
                was established in 2023 and is affiliated to Kaloji Narayana Rao
                University of Health Sciences.
              </p>

              <dl className="fact-grid">
                <div className="fact-item">
                  <dt>Established</dt>
                  <dd>2023</dd>
                </div>
                <div className="fact-item">
                  <dt>Affiliation</dt>
                  <dd>KNRUHS</dd>
                </div>
                <div className="fact-item">
                  <dt>Approval</dt>
                  <dd>NMC Approved</dd>
                </div>
                <div className="fact-item">
                  <dt>Counselling code</dt>
                  <dd>AIMD</dd>
                </div>
              </dl>

              <a
                className="text-link"
                href={INSTITUTION.website}
                target="_blank"
                rel="noopener noreferrer"
              >
                Explore the official AIMS website
                <ArrowUpRight />
              </a>
            </div>
          </div>
        </section>

        <section className="section" id="programme" aria-labelledby="programme-title" style={{ paddingTop: 0 }}>
          <div className="container">
            <div className="programme">
              <div>
                <span className="eyebrow">Programmes · 2026–27</span>
                <h2 id="programme-title">Begin with MBBS.</h2>
                <p>
                  The MBBS programme is the primary undergraduate medical
                  programme at AIMS. NEET-UG qualified candidates participate in
                  KNRUHS counselling and select AIMS using counselling code AIMD.
                  The official AIMS programmes pages also list Nursing &amp;
                  Allied Health and Paramedical Diplomas.
                </p>
                <div className="programme__actions">
                  <Link className="button" href="/enquire">
                    Enquire about MBBS
                    <ArrowRight />
                  </Link>
                  <p className="programme__note">
                    Have a question about eligibility or counselling? Our team
                    can guide you.
                  </p>
                </div>
              </div>

              <dl className="programme__stats">
                <div className="programme__stat">
                  <dt>Programme</dt>
                  <dd>MBBS</dd>
                </div>
                <div className="programme__stat">
                  <dt>Admission route</dt>
                  <dd>NEET-UG &amp; KNRUHS</dd>
                </div>
                <div className="programme__stat">
                  <dt>Counselling code</dt>
                  <dd>AIMD</dd>
                </div>
                <div className="programme__stat">
                  <dt>Academic year</dt>
                  <dd>{INSTITUTION.academicYear}</dd>
                </div>
              </dl>
            </div>
          </div>
        </section>

        <section className="section" id="campus" aria-labelledby="campus-title" style={{ paddingTop: 0 }}>
          <div className="container">
            <div className="campus__head">
              <div>
                <span className="eyebrow">Inside AIMS</span>
                <h2 id="campus-title">See where you&rsquo;ll learn.</h2>
              </div>
              <a
                className="text-link"
                href={INSTITUTION.virtualTour}
                target="_blank"
                rel="noopener noreferrer"
                style={{ marginTop: 0 }}
              >
                Open the virtual campus tour
                <ArrowUpRight />
              </a>
            </div>

            <div className="campus__grid">
              <figure className="campus-card">
                <div className="campus-card__img">
                  <Image
                    src="/images/campus-lab.webp"
                    alt="Laboratory work and specimen handling at AIMS"
                    width={1600}
                    height={1067}
                    sizes="(max-width: 760px) 132px, 33vw"
                  />
                </div>
                <figcaption>
                  <strong>Laboratory learning</strong>
                  <span>Practical, hands-on foundations.</span>
                </figcaption>
              </figure>
              <figure className="campus-card">
                <div className="campus-card__img">
                  <Image
                    src="/images/campus-clinical.webp"
                    alt="Clinical training in an operating theatre"
                    width={800}
                    height={517}
                    sizes="(max-width: 760px) 132px, 33vw"
                  />
                </div>
                <figcaption>
                  <strong>Clinical training</strong>
                  <span>Learning in clinical settings.</span>
                </figcaption>
              </figure>
              <figure className="campus-card">
                <div className="campus-card__img">
                  <Image
                    src="/images/campus-hospital.webp"
                    alt="Arundathi Hospital, the teaching hospital associated with AIMS"
                    width={1600}
                    height={1066}
                    sizes="(max-width: 760px) 132px, 33vw"
                  />
                </div>
                <figcaption>
                  <strong>The teaching hospital</strong>
                  <span>Care alongside clinical learning.</span>
                </figcaption>
              </figure>
            </div>
          </div>
        </section>

        <VideoWall />

        <section className="container cta" aria-label="Get started">
          <Link className="cta__card cta__card--dark" href="/enquire">
            <div>
              <span className="eyebrow">Ready to begin?</span>
              <h2>Take the first step.</h2>
              <p>
                Begin your admissions enquiry. Share your details and our team
                will contact you using the information you provide.
              </p>
            </div>
            <span className="cta__action">
              Start your enquiry
              <ArrowRight />
            </span>
          </Link>

          <a
            className="cta__card cta__card--light"
            href={INSTITUTION.website}
            target="_blank"
            rel="noopener noreferrer"
          >
            <div>
              <span className="eyebrow">Official website</span>
              <h2>aims.ac.in</h2>
              <p>
                Programmes, faculty, hospital services and everything in
                between.
              </p>
            </div>
            <span className="cta__action">
              Visit website
              <ArrowUpRight />
            </span>
          </a>
        </section>
      </main>

      <SiteFooter />
    </>
  );
}
