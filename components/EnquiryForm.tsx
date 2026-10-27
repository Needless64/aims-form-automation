"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  COURSES,
  COURSE_LABELS,
  INSTITUTION,
  INTERESTS,
  NEET_STATUSES,
  QUALIFICATIONS,
  type Interest,
} from "@/lib/institution";

interface FormValues {
  fullName: string;
  email: string;
  phone: string;
  course: string;
  city: string;
  currentCollege: string;
  qualification: string;
  marks: string;
  neetStatus: string;
  neetScore: string;
  interests: Interest[];
  goals: string;
  parentName: string;
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
  course: "",
  city: "",
  currentCollege: "",
  qualification: "",
  marks: "",
  neetStatus: "",
  neetScore: "",
  interests: [],
  goals: "",
  parentName: "",
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
 * Reject an edit that cannot become valid, keeping the longest acceptable
 * prefix instead. Typing a fourth digit into a three-digit field does nothing
 * rather than letting the value grow past what the server will accept.
 */
function longestAcceptable(
  value: string,
  isValid: (candidate: string) => boolean,
): string {
  if (isValid(value)) return value;
  for (let end = value.length - 1; end > 0; end -= 1) {
    const prefix = value.slice(0, end);
    if (isValid(prefix)) return prefix;
  }
  return "";
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

/** No more than three whole digits, an optional decimal point and two decimals. */
const MARKS_INPUT = /^\d{0,3}(\.\d{0,2})?%?$/;
const NEET_SCORE_INPUT = /^\d{0,3}$/;

const INPUT_MASKS: Partial<Record<keyof FormValues, (value: string) => string>> = {
  phone: sanitizePhoneInput,
  marks: (value) => longestAcceptable(value, (text) => MARKS_INPUT.test(text)),
  neetScore: (value) =>
    longestAcceptable(value, (text) => NEET_SCORE_INPUT.test(text)),
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
  const marks = values.marks.trim().replace(/%$/, "").trim();

  if (!isRequiredName(values.fullName)) {
    errors.fullName = "Please enter the student's full name.";
  }
  if (!EMAIL_PATTERN.test(values.email.trim())) {
    errors.email = "Please enter a valid email address.";
  }
  if (!/^[6-9]\d{9}$/.test(normalizePhone(values.phone))) {
    errors.phone = "Enter a valid 10-digit Indian mobile number.";
  }
  if (!values.course) {
    errors.course = "Please select the programme you are interested in.";
  }
  if (!isRequiredPlace(values.city, 80)) {
    errors.city = "Please enter your current city or district.";
  }
  if (!isRequiredPlace(values.currentCollege, 120)) {
    errors.currentCollege = "Please enter your current college or institution.";
  }
  if (!values.qualification) {
    errors.qualification = "Please select your academic qualification.";
  }
  if (!/^\d{1,3}(\.\d{1,2})?$/.test(marks)) {
    errors.marks = "Enter a percentage between 0 and 100, for example 92.4.";
  } else if (Number(marks) <= 0 || Number(marks) > 100) {
    errors.marks = "Percentage must be greater than 0 and at most 100.";
  }
  if (!values.neetStatus) {
    errors.neetStatus = "Please select your NEET-UG status.";
  }
  if (values.neetStatus === "Appeared") {
    if (!/^\d{1,3}$/.test(values.neetScore.trim())) {
      errors.neetScore = "Enter your NEET-UG score between 0 and 720.";
    } else if (Number(values.neetScore) > 720) {
      errors.neetScore = "NEET-UG score cannot be more than 720.";
    }
  }
  if (values.interests.length === 0) {
    errors.interests = "Select at least one area of interest.";
  }
  if (values.goals.trim().length < 10) {
    errors.goals = "Please describe your academic or career goals.";
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

  useEffect(() => {
    if (success) successHeading.current?.focus();
  }, [success]);

  function update<K extends keyof FormValues>(key: K, value: FormValues[K]) {
    const mask = INPUT_MASKS[key];
    const masked =
      mask && typeof value === "string" ? (mask(value) as FormValues[K]) : value;
    setValues((current) => {
      const next = { ...current, [key]: masked };
      // The score only applies to candidates who appeared for NEET-UG.
      if (key === "neetStatus" && value !== "Appeared") next.neetScore = "";
      return next;
    });
    setErrors((current) => {
      if (!current[key as string]) return current;
      const next = { ...current };
      delete next[key as string];
      return next;
    });
  }

  function toggleInterest(interest: Interest) {
    setValues((current) => ({
      ...current,
      interests: current.interests.includes(interest)
        ? current.interests.filter((item) => item !== interest)
        : [...current.interests, interest],
    }));
    setErrors((current) => {
      if (!current.interests) return current;
      const next = { ...current };
      delete next.interests;
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
      setErrors(nextErrors);
      setFailure({
        message: "Please check the highlighted fields and try again.",
      });
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
      course: values.course,
      city: values.city,
      currentCollege: values.currentCollege,
      qualification: values.qualification,
      marks: values.marks,
      neetStatus: values.neetStatus,
      neetScore: values.neetStatus === "Appeared" ? values.neetScore : "",
      interests: values.interests,
      goals: values.goals,
      parentName: values.parentName,
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
      requestAnimationFrame(() => alertRef.current?.focus());
    } catch {
      setFailure({
        message: `We could not reach the admissions server. Please check your connection and try again, or call ${INSTITUTION.phone}.`,
      });
      requestAnimationFrame(() => alertRef.current?.focus());
    } finally {
      setSubmitting(false);
    }
  }

  if (success) {
    return (
      <div className="form-card form-card--success">
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

  const scoreApplies = values.neetStatus === "Appeared";

  return (
    <div
      className="form-card"
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
          Every field is required. Your details are used only to respond to this
          enquiry.
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

          <div className="field">
            <label htmlFor="course">
              Programme of interest <span className="req">*</span>
            </label>
            <select
              id="course"
              name="course"
              required
              value={values.course}
              onChange={(event) => update("course", event.target.value)}
              aria-invalid={Boolean(errors.course)}
              aria-describedby={errors.course ? "course-error" : undefined}
            >
              <option value="">Select a programme</option>
              {COURSES.map((course) => (
                <option key={course} value={course}>
                  {COURSE_LABELS[course]}
                </option>
              ))}
            </select>
            {errors.course ? (
              <span className="field__error" id="course-error">
                {errors.course}
              </span>
            ) : null}
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
              placeholder="School, junior college or degree college"
            />
            {errors.currentCollege ? (
              <span className="field__error" id="currentCollege-error">
                {errors.currentCollege}
              </span>
            ) : null}
          </div>

          <div className="field">
            <label htmlFor="qualification">
              Academic qualification <span className="req">*</span>
            </label>
            <select
              id="qualification"
              name="qualification"
              required
              value={values.qualification}
              onChange={(event) =>
                update("qualification", event.target.value)
              }
              aria-invalid={Boolean(errors.qualification)}
              aria-describedby={
                errors.qualification ? "qualification-error" : undefined
              }
            >
              <option value="">Select qualification</option>
              {QUALIFICATIONS.map((qualification) => (
                <option key={qualification} value={qualification}>
                  {qualification}
                </option>
              ))}
            </select>
            {errors.qualification ? (
              <span className="field__error" id="qualification-error">
                {errors.qualification}
              </span>
            ) : null}
          </div>

          <div className="field">
            <label htmlFor="marks">
              Qualifying percentage <span className="req">*</span>
            </label>
            <input
              id="marks"
              name="marks"
              type="text"
              inputMode="decimal"
              maxLength={6}
              required
              value={values.marks}
              onChange={(event) => update("marks", event.target.value)}
              aria-invalid={Boolean(errors.marks)}
              aria-describedby={errors.marks ? "marks-error" : "marks-hint"}
              placeholder="e.g. 92.4"
            />
            {errors.marks ? (
              <span className="field__error" id="marks-error">
                {errors.marks}
              </span>
            ) : (
              <span className="field__hint" id="marks-hint">
                Number between 0 and 100. Add % if you prefer.
              </span>
            )}
          </div>

          <div className="field">
            <label htmlFor="neetStatus">
              NEET-UG status <span className="req">*</span>
            </label>
            <select
              id="neetStatus"
              name="neetStatus"
              required
              value={values.neetStatus}
              onChange={(event) => update("neetStatus", event.target.value)}
              aria-invalid={Boolean(errors.neetStatus)}
              aria-describedby={
                errors.neetStatus ? "neetStatus-error" : undefined
              }
            >
              <option value="">Select status</option>
              {NEET_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
            {errors.neetStatus ? (
              <span className="field__error" id="neetStatus-error">
                {errors.neetStatus}
              </span>
            ) : null}
          </div>

          <div className="field">
            <label htmlFor="neetScore">
              NEET-UG score{" "}
              {scoreApplies ? (
                <span className="req">*</span>
              ) : (
                <span className="field__optional">if appeared</span>
              )}
            </label>
            <input
              id="neetScore"
              name="neetScore"
              type="text"
              inputMode="numeric"
              maxLength={3}
              required={scoreApplies}
              disabled={!scoreApplies}
              value={values.neetScore}
              onChange={(event) => update("neetScore", event.target.value)}
              aria-invalid={Boolean(errors.neetScore)}
              aria-describedby={
                errors.neetScore ? "neetScore-error" : "neetScore-hint"
              }
              placeholder={scoreApplies ? "e.g. 640" : "Not applicable"}
            />
            {errors.neetScore ? (
              <span className="field__error" id="neetScore-error">
                {errors.neetScore}
              </span>
            ) : (
              <span className="field__hint" id="neetScore-hint">
                Whole number out of 720. Enabled only if you appeared.
              </span>
            )}
          </div>

          <div className="field field--full">
            <span className="field-label" id="interests-label">
              Areas of interest <span className="req">*</span>
            </span>
            <div
              className="interests"
              role="group"
              aria-labelledby="interests-label"
              aria-invalid={Boolean(errors.interests)}
              aria-describedby={
                errors.interests ? "interests-error" : undefined
              }
            >
              {INTERESTS.map((interest) => (
                <label className="chip" key={interest}>
                  <input
                    type="checkbox"
                    name="interests"
                    value={interest}
                    checked={values.interests.includes(interest)}
                    onChange={() => toggleInterest(interest)}
                  />
                  <span>{interest}</span>
                </label>
              ))}
            </div>
            {errors.interests ? (
              <span className="field__error" id="interests-error">
                {errors.interests}
              </span>
            ) : null}
          </div>

          <div className="field field--full">
            <label htmlFor="goals">
              Academic or career goals <span className="req">*</span>
            </label>
            <textarea
              id="goals"
              name="goals"
              maxLength={600}
              rows={3}
              required
              value={values.goals}
              onChange={(event) => update("goals", event.target.value)}
              aria-invalid={Boolean(errors.goals)}
              aria-describedby={errors.goals ? "goals-error" : "goals-hint"}
              placeholder="Tell us what you hope to achieve in medicine"
            />
            {errors.goals ? (
              <span className="field__error" id="goals-error">
                {errors.goals}
              </span>
            ) : (
              <span className="field__hint" id="goals-hint">
                A sentence or two is enough.
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
