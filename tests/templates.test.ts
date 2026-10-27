import { describe, expect, it } from "vitest";
import { buildStudentConfirmation } from "@/lib/email/templates/student-confirmation";
import { buildAdmissionsNotification } from "@/lib/email/templates/admissions-notification";
import { formatSubmissionTime } from "@/lib/reference";
import { validEnquiry } from "./fixtures";

const submittedAt = new Date("2026-10-27T13:12:00Z");
const referenceId = "AIMS-26-AB7K9Q";
const logoUrl = "https://www.aims.ac.in/assets/logo-white.png";

const studentEmail = buildStudentConfirmation({
  enquiry: validEnquiry,
  referenceId,
  submittedAt,
  logoUrl,
});

const admissionsEmail = buildAdmissionsNotification({
  enquiry: validEnquiry,
  referenceId,
  submittedAt,
  logoUrl,
});

describe("student confirmation email", () => {
  it("uses the required personalized subject", () => {
    expect(studentEmail.subject).toBe(
      "Your AIMS Admissions Enquiry Has Been Received — Ananya Rao",
    );
  });

  it("greets the student and includes every supplied response", () => {
    expect(studentEmail.html).toContain("Welcome, Ananya Rao!");
    expect(studentEmail.html).toContain("ananya.rao@example.com");
    expect(studentEmail.html).toContain("+91 98765 43210");
    expect(studentEmail.html).toContain(
      "MBBS — Bachelor of Medicine and Bachelor of Surgery",
    );
    expect(studentEmail.html).toContain("Hyderabad");
    expect(studentEmail.html).toContain("Narayana Junior College");
    expect(studentEmail.html).toContain("95.2%");
    expect(studentEmail.html).toContain("640");
    expect(studentEmail.html).toContain("Clinical practice, Medical research");
    expect(studentEmail.html).toContain("serve rural communities");
    expect(studentEmail.html).toContain(referenceId);
  });

  it("omits the NEET score when the candidate has not appeared", () => {
    const minimal = buildStudentConfirmation({
      enquiry: {
        ...validEnquiry,
        neetStatus: "Not appeared",
        neetScore: undefined,
      },
      referenceId,
      submittedAt,
      logoUrl,
    });

    expect(minimal.html).not.toContain("NEET-UG score");
    expect(minimal.html).toContain("Not appeared");
    expect(minimal.html).not.toContain("undefined");
    expect(minimal.html).not.toContain("null");
    expect(minimal.text).not.toContain("undefined");
    expect(minimal.text).not.toContain("null");
  });

  it("escapes user content instead of rendering markup", () => {
    const injected = buildStudentConfirmation({
      enquiry: {
        ...validEnquiry,
        fullName: `<img src=x onerror=alert(1)> Ravi & "Co"`,
        goals: `<script>alert("xss")</script>`,
        city: "<b>Hyderabad</b>",
      },
      referenceId,
      submittedAt,
      logoUrl,
    });

    expect(injected.html).not.toContain("<script>");
    expect(injected.html).not.toContain("<img src=x");
    expect(injected.html).toContain("&lt;script&gt;");
    expect(injected.html).toContain("&lt;img src=x");
    expect(injected.html).toContain("&amp;");
  });

  it("strips newlines from header values to prevent header injection", () => {
    const injected = buildStudentConfirmation({
      enquiry: {
        ...validEnquiry,
        fullName: "Ravi\r\nBcc: attacker@example.com",
      },
      referenceId,
      submittedAt,
      logoUrl,
    });
    expect(injected.subject).not.toMatch(/[\r\n]/);
    expect(injected.subject).toContain("Bcc: attacker@example.com");
  });

  it("includes institutional details, virtual tour and official link", () => {
    expect(studentEmail.html).toContain("Established");
    expect(studentEmail.html).toContain("KNRUHS");
    expect(studentEmail.html).toContain("NMC Approved");
    expect(studentEmail.html).toContain("AIMD");
    expect(studentEmail.html).toContain(
      "https://www.aims.ac.in/virtual-tour",
    );
    expect(studentEmail.html).toContain("https://www.aims.ac.in/");
    expect(studentEmail.html).toContain("The AIMS Admissions Team");
  });
});

describe("internal admissions notification", () => {
  it("uses the required subject with student name and reference", () => {
    expect(admissionsEmail.subject).toBe(
      `New AIMS Admissions Enquiry — Ananya Rao — ${referenceId}`,
    );
  });

  it("contains the submitted details, reference, timezone and consent", () => {
    expect(admissionsEmail.html).toContain("NEW ADMISSIONS ENQUIRY");
    expect(admissionsEmail.html).toContain(referenceId);
    expect(admissionsEmail.html).toContain(
      formatSubmissionTime(submittedAt),
    );
    expect(admissionsEmail.html).toContain("IST");
    expect(admissionsEmail.html).toContain("Ananya Rao");
    expect(admissionsEmail.html).toContain("ananya.rao@example.com");
    expect(admissionsEmail.html).toContain("+91 98765 43210");
    expect(admissionsEmail.html).toContain(
      "MBBS — Bachelor of Medicine and Bachelor of Surgery",
    );
    expect(admissionsEmail.html).toContain("Hyderabad");
    expect(admissionsEmail.html).toContain("95.2%");
    expect(admissionsEmail.html).toContain("Clinical practice");
    expect(admissionsEmail.html).toContain("serve rural communities");
    expect(admissionsEmail.html).toContain("Suresh Rao");
    expect(admissionsEmail.html).toContain(
      "Consent to be contacted:</strong> recorded",
    );
  });

  it("makes student contact details actionable", () => {
    expect(admissionsEmail.html).toContain("mailto:ananya.rao@example.com");
    expect(admissionsEmail.html).toContain("tel:+919876543210");
    expect(admissionsEmail.html).toContain("Reply directly to this email");
  });

  it("escapes user content in the administrative template", () => {
    const injected = buildAdmissionsNotification({
      enquiry: {
        ...validEnquiry,
        fullName: `<svg onload=alert(1)>`,
        currentCollege: `<iframe src="https://evil.example"></iframe>`,
        goals: `Research & "teaching"`,
      },
      referenceId,
      submittedAt,
      logoUrl,
    });

    expect(injected.html).not.toContain("<svg");
    expect(injected.html).not.toContain("<iframe");
    expect(injected.html).toContain("&lt;svg");
    expect(injected.html).toContain("&lt;iframe");
    expect(injected.html).toContain("Research &amp; &quot;teaching&quot;");
  });

  it("shares the same reference ID as the student email", () => {
    expect(studentEmail.html).toContain(referenceId);
    expect(admissionsEmail.html).toContain(referenceId);
    expect(admissionsEmail.text).toContain(referenceId);
  });
});

describe("email template structure", () => {
  for (const [name, built] of [
    ["student", studentEmail],
    ["internal", admissionsEmail],
  ] as const) {
    it(`${name} email is a table-based, responsive HTML document`, () => {
      expect(built.html).toContain("<!DOCTYPE html>");
      expect(built.html).toContain('role="presentation"');
      expect(built.html).toContain("<table");
      expect(built.html).toContain("max-width:640px");
      expect(built.html).toContain("@media only screen and (max-width:620px)");
      expect(built.html).toContain("max-width:100%");
      expect(built.html).not.toContain("<link");
      expect(built.html).not.toContain("display:flex");
      expect(built.html).not.toContain("display:grid");
      expect(built.html).not.toContain("javascript:");
    });

    it(`${name} email has a plain-text alternative`, () => {
      expect(built.text.length).toBeGreaterThan(200);
      expect(built.text.toLowerCase()).toContain(
        "arundathi institute of medical sciences",
      );
      expect(built.text).toContain("AIMD");
      expect(built.text).toContain(referenceId);
    });
  }

  it("stacks submission details on narrow screens", () => {
    expect(studentEmail.html).toContain(".stack-value");
    expect(studentEmail.html).toContain(
      "display:block !important; width:100% !important",
    );
  });
});
