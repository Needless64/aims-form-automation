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
  instagram: "https://www.instagram.com/aimsmedicalcollege/",
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
 * Departments of the college and its teaching hospital, in the order the
 * institution publishes them. A candidate may name more than one, because
 * applicants often decide between two specialities.
 */
export const DEPARTMENTS = [
  "General Medicine",
  "Dermatology",
  "Paediatrics",
  "Respiratory Medicine",
  "General Surgery",
  "Orthopaedics",
  "Obstetric & Gynaecology",
  "Ophthalmology",
  "Oto – Rhinolaryngology / ENT",
  "Radiology",
  "Anaesthesia",
  "Biochemistry",
  "Pathology",
] as const;

export type Department = (typeof DEPARTMENTS)[number];
