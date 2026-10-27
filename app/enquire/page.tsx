import type { Metadata } from "next";
import Link from "next/link";
import { EnquiryForm } from "@/components/EnquiryForm";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { INSTITUTION } from "@/lib/institution";

export const metadata: Metadata = {
  title: "Admissions Enquiry",
  description:
    "Submit an admissions enquiry for Arundathi Institute of Medical Sciences, Dundigal. Admissions 2026–27, counselling code AIMD.",
};

function ArrowLeft() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M19.5 12h-14m5-5-5 5 5 5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function EnquirePage() {
  return (
    <>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <SiteHeader variant="enquiry" />

      <main id="main">
        <section className="enquire-stage">
          <div className="enquire-stage__bg" aria-hidden="true" />
          <div className="container enquire-stage__inner">
            <div className="enquiry-hero">
              <Link className="back-link" href="/">
                <ArrowLeft />
                Back to AIMS
              </Link>
              <div style={{ marginTop: 18 }}>
                <span className="welcome">
                  <span className="welcome__dot" aria-hidden="true" />
                  Admissions {INSTITUTION.academicYear}
                </span>
              </div>
              <h1>Tell us about you.</h1>
              <p>
                Share your details and our admissions team will review your
                enquiry and contact you using the information you provide. Every
                field is required.
              </p>
            </div>

            <div className="enquiry-layout">
              <aside
                className="enquiry-aside"
                aria-label="Admissions contact details"
              >
                <div className="aside-card">
                  <h2>Admissions</h2>
                  <dl className="contact-list">
                    <div className="contact-row">
                      <dt>Helpline</dt>
                      <dd>
                        <a href={`tel:${INSTITUTION.phoneHref}`}>
                          {INSTITUTION.phone}
                        </a>
                      </dd>
                    </div>
                    <div className="contact-row">
                      <dt>Email</dt>
                      <dd>
                        <a href={`mailto:${INSTITUTION.admissionsEmail}`}>
                          {INSTITUTION.admissionsEmail}
                        </a>
                      </dd>
                    </div>
                    <div className="contact-row">
                      <dt>Code</dt>
                      <dd>AIMD</dd>
                    </div>
                    <div className="contact-row">
                      <dt>Year</dt>
                      <dd>{INSTITUTION.academicYear}</dd>
                    </div>
                  </dl>
                </div>

                <div className="aside-card">
                  <h2>What happens next</h2>
                  <ol className="steps">
                    <li>
                      <span>1</span>
                      Submit your enquiry and receive a confirmation by email.
                    </li>
                    <li>
                      <span>2</span>
                      The admissions team reviews the details you shared.
                    </li>
                    <li>
                      <span>3</span>
                      We contact you using your phone number or email address.
                    </li>
                  </ol>
                </div>
              </aside>

              <EnquiryForm />
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </>
  );
}
