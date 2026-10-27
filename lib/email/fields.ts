import type { DetailField } from "@/lib/email/components";
import { COURSE_LABELS } from "@/lib/institution";
import type { Enquiry } from "@/lib/validation";

export function formatIndianPhone(digits: string): string {
  return `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`;
}

export function studentDetailFields(
  enquiry: Enquiry,
  referenceId: string,
): DetailField[] {
  return [
    { label: "Full name", value: enquiry.fullName },
    { label: "Email address", value: enquiry.email },
    { label: "Mobile number", value: formatIndianPhone(enquiry.phone) },
    { label: "Programme of interest", value: COURSE_LABELS[enquiry.course] },
    { label: "City / district", value: enquiry.city },
    { label: "Current college / institution", value: enquiry.currentCollege },
    { label: "Academic qualification", value: enquiry.qualification },
    { label: "Marks / qualifying exam", value: enquiry.marks },
    { label: "NEET-UG status", value: enquiry.neetStatus },
    { label: "NEET-UG score", value: enquiry.neetScore },
    {
      label: "Areas of interest",
      value: enquiry.interests.length ? enquiry.interests.join(", ") : undefined,
    },
    { label: "Academic / career goals", value: enquiry.goals },
    { label: "Parent / guardian", value: enquiry.parentName },
    { label: "Enquiry reference", value: referenceId },
  ];
}
