"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  DEPARTMENTS,
  INSTITUTION,
  type Department,
} from "@/lib/institution";

/** How long the confirmation stays on screen before the visitor is taken home. */
const HOME_REDIRECT_SECONDS = 10;

interface FormValues {
  fullName: string;
  email: string;
  phone: string;
  departments: Department[];
  city: string;
  currentCollege: string;
  goals: string;
  parentName: string;
  parentPhone: string;
  consent: boolean;
  companyWebsite: string;
}

type Errors = Record<string, string>;

interface SuccessState {
  referenceId: string;
  timeLabel: string;
  email: string;
}

interface FailureState {
  message: string;
  referenceId?: string;
  partial?: boolean;
}

const INITIAL_VALUES: FormValues = {
  fullName: "",
  email: "",
  phone: "",
  departments: [],
  city: "",
  currentCollege: "",
  goals: "",
  parentName: "",
  parentPhone: "",
  consent: false,
  companyWebsite: "",
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const NAME_PATTERN = /^[\p{L}\p{M}][\p{L}\p{M} .'-]*$/u;
const PLACE_PATTERN = /^[\p{L}\p{M}\d][\p{L}\p{M}\d .,'&()/-]*$/u;

function normalizePhone(value: string): string {
  const digits = value.replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("91")) return digits.slice(2);
  if (digits.length === 11 && digits.startsWith("0")) return digits.slice(1);
  return digits;
}

/**
 * A mobile number can only ever be ten digits, or twelve with the +91 country
 * code (eleven for the old leading-zero style). Separators people type — spaces,
 * dashes, parentheses — are kept as typed; anything else never reaches the field.
 */
function sanitizePhoneInput(value: string): string {
  const withCountryCode = /^\s*\+/.test(value);
  const kept = value.replace(/[^\d\s()\-]/g, "");
  const digits = kept.replace(/\D/g, "");
  const limit = withCountryCode ? 12 : digits.startsWith("0") ? 11 : 10;

  let taken = 0;
  let output = "";
  for (const character of kept) {
    if (/\d/.test(character)) {
      if (taken === limit) break;
      taken += 1;
    }
    output += character;
  }
  return `${withCountryCode ? "+" : ""}${output.replace(/^\s+/, "")}`;
}

const INPUT_MASKS: Partial<Record<keyof FormValues, (value: string) => string>> = {
  phone: sanitizePhoneInput,
  parentPhone: sanitizePhoneInput,
};

function isRequiredName(value: string): boolean {
  const trimmed = value.trim();
  return trimmed.length >= 2 && trimmed.length <= 100 && NAME_PATTERN.test(trimmed);
}

function isRequiredPlace(value: string, max: number): boolean {
  const trimmed = value.trim();
  return trimmed.length >= 2 && trimmed.length <= max && PLACE_PATTERN.test(trimmed);
}

/** Mirrors the server schema so the same submission is rejected in both places. */
function validate(values: FormValues): Errors {
  const errors: Errors = {};

  if (!isRequiredName(values.fullName)) {
    errors.fullName = "Please enter the student's full name.";
  }
  if (!EMAIL_PATTERN.test(values.email.trim())) {
    errors.email = "Please enter a valid email address.";
  }
  if (!/^[6-9]\d{9}$/.test(normalizePhone(values.phone))) {
    errors.phone = "Enter a valid 10-digit Indian mobile number.";
  }
  if (values.departments.length === 0) {
    errors.departments = "Select at least one department.";
  }
  if (!isRequiredPlace(values.city, 80)) {
    errors.city = "Please enter your current city or district.";
  }
  if (!isRequiredPlace(values.currentCollege, 120)) {
    errors.currentCollege = "Please enter your current college or institution.";
  }
  if (
    values.parentPhone.trim() !== "" &&
    !/^[6-9]\d{9}$/.test(normalizePhone(values.parentPhone))
  ) {
    errors.parentPhone = "Enter a valid 10-digit Indian mobile number.";
  }
  if (!isRequiredName(values.parentName)) {
    errors.parentName = "Please enter your parent or guardian's name.";
  }
  if (!values.consent) {
    errors.consent = "Please consent to being contacted about your enquiry.";
  }
  return errors;
}

function Spinner({ light = false }: { light?: boolean }) {
  return (
    <span
      className={`spinner${light ? " spinner--light" : ""}`}
      aria-hidden="true"
    />
  );
}

export function EnquiryForm() {
  const [values, setValues] = useState<FormValues>(INITIAL_VALUES);
  const [errors, setErrors] = useState<Errors>({});
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState<SuccessState | null>(null);
  const [failure, setFailure] = useState<FailureState | null>(null);
  const successHeading = useRef<HTMLHeadingElement>(null);
  const alertRef = useRef<HTMLDivElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  /**
   * Brings the result of a submission into view. The visitor is at the submit
   * button at the bottom of a long form, so without this the confirmation — or
   * the reason the form was rejected — appears off-screen and the page looks
   * unchanged. `scroll-margin-top` on .form-card keeps it clear of the sticky
   * header, which would otherwise cover the heading.
   */
  function revealCard() {
    cardRef.current?.scrollIntoView({ block: "start", behavior: "smooth" });
  }

  // Once submitted, show the confirmation and then return the visitor home, on
  // a phone as well as on a desktop.
  useEffect(() => {
    if (!success) return;
    revealCard();
    successHeading.current?.focus({ preventScroll: true });
    const timer = window.setTimeout(
      () => router.push("/"),
      HOME_REDIRECT_SECONDS * 1000,
    );
    return () => window.clearTimeout(timer);
  }, [success, router]);

  function update<K extends keyof FormValues>(key: K, value: FormValues[K]) {
    const mask = INPUT_MASKS[key];
    const masked =
      mask && typeof value === "string" ? (mask(value) as FormValues[K]) : value;
    setValues((current) => ({ ...current, [key]: masked }));
    setErrors((current) => {
      if (!current[key as string]) return current;
      const next = { ...current };
      delete next[key as string];
      return next;
    });
  }

  function toggleDepartment(department: Department) {
    setValues((current) => ({
      ...current,
      departments: current.departments.includes(department)
        ? current.departments.filter((item) => item !== department)
        : [...current.departments, department],
    }));
    setErrors((current) => {
      if (!current.departments) return current;
      const next = { ...current };
      delete next.departments;
      return next;
    });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;

    // Honeypot: silently stop automated submissions.
    if (values.companyWebsite.trim() !== "") return;

    const nextErrors = validate(values);
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);            setFailure({
              message: "Please check the highlighted fields and try again.",
            });
            requestAnimationFrame(revealCard);
      const first = Object.keys(nextErrors)[0];
      requestAnimationFrame(() => document.getElementById(first)?.focus());
      return;
    }

    setErrors({});
    setFailure(null);
    setSubmitting(true);

    const payload = {
      fullName: values.fullName,
      email: values.email,
      phone: values.phone,
      departments: values.departments,
      city: values.city,
      currentCollege: values.currentCollege,
      goals: values.goals,
      parentName: values.parentName,
      parentPhone: values.parentPhone,
      consent: values.consent,
      companyWebsite: values.companyWebsite,
    };

    try {
      const response = await fetch("/api/enquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = (await response.json().catch(() => null)) as
        | (Record<string, unknown> & {
            ok?: boolean;
            referenceId?: string;
            timeLabel?: string;
            message?: string;
            partial?: boolean;
            fieldErrors?: Errors;
          })
        | null;

      if (response.ok && data?.ok && data.referenceId) {
        setSuccess({
          referenceId: data.referenceId,
          timeLabel: data.timeLabel ?? "",
          email: values.email.trim().toLowerCase(),
        });
        return;
      }

      if (data?.fieldErrors) {
        setErrors(data.fieldErrors);
        const first = Object.keys(data.fieldErrors)[0];
        if (first) {
          requestAnimationFrame(() => document.getElementById(first)?.focus());
        }
      }

      setFailure({
        message:
          data?.message ??
          "We could not submit your enquiry. Please try again, or call our admissions helpline.",
        referenceId: data?.referenceId,
        partial: Boolean(data?.partial),
      });
      requestAnimationFrame(() => {
        alertRef.current?.focus({ preventScroll: true });
        revealCard();
      });
    } catch {
      setFailure({
        message: `We could not reach the admissions server. Please check your connection and try again, or call ${INSTITUTION.phone}.`,
      });
      requestAnimationFrame(() => {
        alertRef.current?.focus({ preventScroll: true });
        revealCard();
      });
    } finally {
      setSubmitting(false);
    }
  }

  if (success) {
    return (
      <div className="form-card form-card--success" ref={cardRef}>
        <div className="success" role="status" aria-live="polite">
          <div className="success__badge" aria-hidden="true">
            <span className="success__ring" />
            <span className="success__ring success__ring--late" />
            <span className="success__icon">
              <svg width="30" height="30" viewBox="0 0 24 24" fill="none">
                <path
                  className="success__check"
                  d="M20 6L9 17l-5-5"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  pathLength="1"
                />
              </svg>
            </span>
          </div>
          <p className="success__eyebrow">Enquiry received</p>
          <h3 ref={successHeading} tabIndex={-1}>
            Thank you for your interest in Arundathi Institute of Medical
            Sciences.
          </h3>
          <p>
            Our admissions team will review your enquiry and contact you using
            the details you provided.
          </p>

          <dl className="success__ref">
            <dt>Your enquiry reference ID</dt>
            <dd>{success.referenceId}</dd>
          </dl>

          <ul className="success__meta">
            {success.timeLabel ? <li>Submitted {success.timeLabel}</li> : null}
            <li>
              A confirmation has been sent to {success.email}, and the
              admissions team has been notified. Please allow a few minutes for
              delivery and check your spam folder.
            </li>
            <li>
              Please quote your reference ID in any call or email about this
              enquiry.
            </li>
            <li>
              You will be taken back to the AIMS home page in{" "}
              {HOME_REDIRECT_SECONDS} seconds.
            </li>
          </ul>

          <div className="success__actions">
            <a className="button" href={`tel:${INSTITUTION.phoneHref}`}>
              Call {INSTITUTION.phone}
            </a>
            <a
              className="button button--ghost"
              href={INSTITUTION.website}
              target="_blank"
              rel="noopener noreferrer"
            >
              Visit aims.ac.in
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="form-card"
      ref={cardRef}
      aria-busy={submitting}
      data-submitting={submitting ? "true" : undefined}
    >
      {submitting ? (
        <div className="form-progress" role="status" aria-live="polite">
          <Spinner />
          <strong>Sending your enquiry</strong>
          <span>Please keep this page open.</span>
        </div>
      ) : null}

      <div className="form-card__head">
        <h3>Admissions enquiry</h3>
        <p>
          Fields marked * are required. Your details are used only to respond to
          this enquiry.
        </p>
      </div>

      {failure ? (
        <div
          className="alert alert--error"
          role="alert"
          tabIndex={-1}
          ref={alertRef}
        >
          <span aria-hidden="true">!</span>
          <div>
            <strong>
              {failure.partial
                ? "Your enquiry was recorded, but an email could not be completed."
                : "We couldn't submit your enquiry."}
            </strong>
            {failure.message}
            {failure.referenceId ? (
              <>
                {" "}
                Your reference ID is <strong>{failure.referenceId}</strong>.
                Please keep it and quote it if you contact the admissions team.
              </>
            ) : null}
            {failure.partial ? (
              <>
                {" "}
                Please call{" "}
                <a href={`tel:${INSTITUTION.phoneHref}`}>{INSTITUTION.phone}</a>{" "}
                so the team can complete your confirmation — do not resubmit the
                form.
              </>
            ) : null}
          </div>
        </div>
      ) : null}

      <form onSubmit={handleSubmit} noValidate>
        <div className="form-grid">
          <div className="field field--full">
            <label htmlFor="fullName">
              Student&rsquo;s full name <span className="req">*</span>
            </label>
            <input
              id="fullName"
              name="fullName"
              type="text"
              autoComplete="name"
              maxLength={100}
              required
              value={values.fullName}
              onChange={(event) => update("fullName", event.target.value)}
              aria-invalid={Boolean(errors.fullName)}
              aria-describedby={errors.fullName ? "fullName-error" : undefined}
              placeholder="As it appears on your documents"
            />
            {errors.fullName ? (
              <span className="field__error" id="fullName-error">
                {errors.fullName}
              </span>
            ) : null}
          </div>

          <div className="field">
            <label htmlFor="email">
              Email address <span className="req">*</span>
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              inputMode="email"
              maxLength={254}
              required
              value={values.email}
              onChange={(event) => update("email", event.target.value)}
              aria-invalid={Boolean(errors.email)}
              aria-describedby={errors.email ? "email-error" : undefined}
              placeholder="you@example.com"
            />
            {errors.email ? (
              <span className="field__error" id="email-error">
                {errors.email}
              </span>
            ) : null}
          </div>

          <div className="field">
            <label htmlFor="phone">
              Mobile number <span className="req">*</span>
            </label>
            <input
              id="phone"
              name="phone"
              type="tel"
              autoComplete="tel"
              inputMode="tel"
              maxLength={20}
              required
              value={values.phone}
              onChange={(event) => update("phone", event.target.value)}
              aria-invalid={Boolean(errors.phone)}
              aria-describedby={errors.phone ? "phone-error" : "phone-hint"}
              placeholder="98765 43210"
            />
            {errors.phone ? (
              <span className="field__error" id="phone-error">
                {errors.phone}
              </span>
            ) : (
              <span className="field__hint" id="phone-hint">
                10-digit Indian mobile number, with or without +91.
              </span>
            )}
          </div>

          <div className="field field--full">
            <span className="field-label" id="departments-label">
              Departments of interest <span className="req">*</span>
            </span>
            <div
              className="interests"
              id="departments"
              role="group"
              tabIndex={-1}
              aria-labelledby="departments-label"
              aria-invalid={Boolean(errors.departments)}
              aria-describedby={
                errors.departments ? "departments-error" : "departments-hint"
              }
            >
              {DEPARTMENTS.map((department) => (
                <label className="chip" key={department}>
                  <input
                    type="checkbox"
                    name="departments"
                    value={department}
                    checked={values.departments.includes(department)}
                    onChange={() => toggleDepartment(department)}
                  />
                  <span>{department}</span>
                </label>
              ))}
            </div>
            {errors.departments ? (
              <span className="field__error" id="departments-error">
                {errors.departments}
              </span>
            ) : (
              <span className="field__hint" id="departments-hint">
                Select all that apply.
              </span>
            )}
          </div>

          <div className="field">
            <label htmlFor="city">
              Current city / district <span className="req">*</span>
            </label>
            <input
              id="city"
              name="city"
              type="text"
              autoComplete="address-level2"
              maxLength={80}
              required
              value={values.city}
              onChange={(event) => update("city", event.target.value)}
              aria-invalid={Boolean(errors.city)}
              aria-describedby={errors.city ? "city-error" : undefined}
              placeholder="e.g. Hyderabad"
            />
            {errors.city ? (
              <span className="field__error" id="city-error">
                {errors.city}
              </span>
            ) : null}
          </div>

          <div className="field">
            <label htmlFor="currentCollege">
              Current college / institution <span className="req">*</span>
            </label>
            <input
              id="currentCollege"
              name="currentCollege"
              type="text"
              maxLength={120}
              required
              value={values.currentCollege}
              onChange={(event) =>
                update("currentCollege", event.target.value)
              }
              aria-invalid={Boolean(errors.currentCollege)}
              aria-describedby={
                errors.currentCollege ? "currentCollege-error" : undefined
              }
              placeholder="Your medical college or institution"
            />
            {errors.currentCollege ? (
              <span className="field__error" id="currentCollege-error">
                {errors.currentCollege}
              </span>
            ) : null}
          </div>

          <div className="field field--full">
            <label htmlFor="goals">
              Academic or career goals{" "}
              <span className="field__optional">Optional</span>
            </label>
            <textarea
              id="goals"
              name="goals"
              maxLength={600}
              rows={3}
              value={values.goals}
              onChange={(event) => update("goals", event.target.value)}
              aria-describedby={errors.goals ? "goals-error" : "goals-hint"}
              placeholder="Tell us what you hope to achieve in medicine"
            />
            {errors.goals ? (
              <span className="field__error" id="goals-error">
                {errors.goals}
              </span>
            ) : (
              <span className="field__hint" id="goals-hint">
                A sentence or two is enough. You can leave this blank.
              </span>
            )}
          </div>

          <div className="field">
            <label htmlFor="parentName">
              Parent / guardian name <span className="req">*</span>
            </label>
            <input
              id="parentName"
              name="parentName"
              type="text"
              autoComplete="off"
              maxLength={100}
              required
              value={values.parentName}
              onChange={(event) => update("parentName", event.target.value)}
              aria-invalid={Boolean(errors.parentName)}
              aria-describedby={
                errors.parentName ? "parentName-error" : undefined
              }
            />
            {errors.parentName ? (
              <span className="field__error" id="parentName-error">
                {errors.parentName}
              </span>
            ) : null}
          </div>

          <div className="field">
            <label htmlFor="parentPhone">
              Parent / guardian phone{" "}
              <span className="field__optional">Optional</span>
            </label>
            <input
              id="parentPhone"
              name="parentPhone"
              type="tel"
              autoComplete="off"
              inputMode="tel"
              maxLength={20}
              value={values.parentPhone}
              onChange={(event) => update("parentPhone", event.target.value)}
              aria-invalid={Boolean(errors.parentPhone)}
              aria-describedby={
                errors.parentPhone ? "parentPhone-error" : "parentPhone-hint"
              }
              placeholder="98765 43210"
            />
            {errors.parentPhone ? (
              <span className="field__error" id="parentPhone-error">
                {errors.parentPhone}
              </span>
            ) : (
              <span className="field__hint" id="parentPhone-hint">
                Used only if we cannot reach the student.
              </span>
            )}
          </div>

          <div className="field field--full">
            <div className="consent">
              <input
                id="consent"
                name="consent"
                type="checkbox"
                required
                checked={values.consent}
                onChange={(event) => update("consent", event.target.checked)}
                aria-invalid={Boolean(errors.consent)}
                aria-describedby={
                  errors.consent ? "consent-error" : "consent-hint"
                }
              />
              <label htmlFor="consent" id="consent-hint">
                I consent to AIMS Admissions contacting me by phone, email or
                WhatsApp about this enquiry. <span className="req">*</span>
              </label>
            </div>
            {errors.consent ? (
              <span className="field__error" id="consent-error">
                {errors.consent}
              </span>
            ) : null}
          </div>
        </div>

        <details className="privacy">
          <summary>How we use your information</summary>
          <p>
            We collect your name, contact details and academic information only
            to respond to your admissions enquiry and to share it with the AIMS
            admissions team. We do not sell your data. To update or remove your
            enquiry, write to{" "}
            <a href={`mailto:${INSTITUTION.admissionsEmail}`}>
              {INSTITUTION.admissionsEmail}
            </a>
            .
          </p>
        </details>

        <div className="honeypot" aria-hidden="true">
          <label htmlFor="companyWebsite">Company website</label>
          <input
            id="companyWebsite"
            name="companyWebsite"
            type="text"
            tabIndex={-1}
            autoComplete="off"
            value={values.companyWebsite}
            onChange={(event) => update("companyWebsite", event.target.value)}
          />
        </div>

        <div className="form-actions">
          <p>
            Your details stay on our admissions system and are never shown
            publicly.
          </p>
          <button
            className="button button--submit"
            type="submit"
            disabled={submitting}
          >
            {submitting ? (
              <>
                <Spinner light />
                Sending…
              </>
            ) : (
              "Submit enquiry"
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
