/**
 * Single source of truth for institutional details used on the website and in
 * both email templates. Values are limited to information published by AIMS.
 */
export const INSTITUTION = {
  name: "Arundathi Institute of Medical Sciences",
  shortName: "AIMS",
  academicYear: "2026–27",
  established: 2023,
  affiliation: "Kaloji Narayana Rao University of Health Sciences (KNRUHS)",
  affiliationShort: "KNRUHS",
  approval: "National Medical Commission (NMC)",
  approvalShort: "NMC Approved",
  counsellingCode: "AIMD",
  address:
    "Beside MLRIT, Dundigal, Gandi Maisamma, Medchal-Malkajgiri District, Telangana 500043",
  phone: "9000994842",
  phoneHref: "+919000994842",
  admissionsEmail: "admissions@aims.ac.in",
  website: "https://www.aims.ac.in/",
  virtualTour: "https://www.aims.ac.in/virtual-tour",
  /**
   * Google's own share link for the campus, so a visitor lands on the verified
   * place — pin, photos, directions — instead of a hand-built address query.
   */
  maps: "https://share.google/himIwovlDdETYmOuc",
  linkedin:
    "https://www.linkedin.com/company/arundathi-institute-of-medical-sciences/home/",
} as const;

/**
 * Institute brochure served from /public. Keep pages/sizeLabel in step with the
 * file at BROCHURE.href — they are shown to visitors before they download it.
 */
export const BROCHURE = {
  href: "/documents/aims-brochure.pdf",
  fileName: "AIMS-Brochure.pdf",
  pages: 16,
  sizeLabel: "4.1 MB",
} as const;

/**
 * Programme names exactly as listed in the official AIMS "Programs Offered"
 * navigation. MBBS is the primary undergraduate programme.
 */
export const COURSES = [
  "MBBS",
  "Nursing & Allied Health",
  "Paramedical Diplomas",
] as const;

export type Course = (typeof COURSES)[number];

export const COURSE_LABELS: Record<Course, string> = {
  MBBS: "MBBS — Bachelor of Medicine and Bachelor of Surgery",
  "Nursing & Allied Health": "Nursing & Allied Health",
  "Paramedical Diplomas": "Paramedical Diplomas",
};

export const QUALIFICATIONS = [
  "12th / Intermediate — completed",
  "12th / Intermediate — pursuing",
  "Bachelor's degree",
  "Other",
] as const;

export type Qualification = (typeof QUALIFICATIONS)[number];

export const NEET_STATUSES = [
  "Appeared",
  "Not appeared",
  "Planning to appear",
] as const;

export type NeetStatus = (typeof NEET_STATUSES)[number];

export const INTERESTS = [
  "Clinical practice",
  "Medical research",
  "Community health",
  "Medical education",
  "Hospital administration",
] as const;

export type Interest = (typeof INTERESTS)[number];
