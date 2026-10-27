import type { Enquiry } from "@/lib/validation";

export const validEnquiry: Enquiry = {
  fullName: "Ananya Rao",
  email: "ananya.rao@example.com",
  phone: "9876543210",
  course: "MBBS",
  city: "Hyderabad",
  currentCollege: "Narayana Junior College",
  qualification: "12th / Intermediate — completed",
  marks: "95.2%",
  neetStatus: "Appeared",
  neetScore: "640",
  interests: ["Clinical practice", "Medical research"],
  goals: "Become a physician and serve rural communities.",
  parentName: "Suresh Rao",
  consent: true,
};

export const validRequestBody = {
  fullName: "  Ananya   Rao ",
  email: "  Ananya.Rao@Example.COM ",
  phone: "+91 98765 43210",
  course: "MBBS",
  city: " Hyderabad ",
  currentCollege: "Narayana Junior College",
  qualification: "12th / Intermediate — completed",
  marks: "95.2%",
  neetStatus: "Appeared",
  neetScore: "640",
  interests: ["Clinical practice", "Medical research"],
  goals: "Become a physician.",
  parentName: "Suresh Rao",
  consent: true,
  companyWebsite: "",
};

/** A complete, valid submission; individual fields can be overridden or removed. */
export function minimalRequestBody(overrides: Record<string, unknown> = {}) {
  return {
    fullName: "Ananya Rao",
    email: "ananya.rao@example.com",
    phone: "9876543210",
    course: "MBBS",
    city: "Hyderabad",
    currentCollege: "Narayana Junior College",
    qualification: "12th / Intermediate — completed",
    marks: "95.2%",
    neetStatus: "Appeared",
    neetScore: "640",
    interests: ["Clinical practice"],
    goals: "Become a physician and serve rural communities.",
    parentName: "Suresh Rao",
    consent: true,
    ...overrides,
  };
}
