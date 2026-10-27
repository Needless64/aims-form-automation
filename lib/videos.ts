/**
 * Videos published about AIMS and the Arundathi Hospital, Dundigal. Each entry
 * is a YouTube video that is publicly embeddable; durations are taken from the
 * videos themselves. Thumbnails are stored locally in /public/images/videos.
 */
export interface Video {
  id: string;
  title: string;
  source: string;
  duration: string;
}

export const VIDEOS: readonly Video[] = [
  {
    id: "UmqXB4K0QdU",
    title: "MBBS admission 2026 — fees, cutoff & counselling",
    source: "Admission Today",
    duration: "4:38",
  },
  {
    id: "gU26HOKj-ZM",
    title: "Closing ranks, fees, courses & facilities",
    source: "Edu9 Career Guidance",
    duration: "9:18",
  },
  {
    id: "0H5OlGSFYlg",
    title: "Inside Arundathi Hospital, Dundigal",
    source: "Sathya Talkies",
    duration: "11:37",
  },
  {
    id: "nztWgq0ORUM",
    title: "Free treatment for everyone",
    source: "Telangana Today",
    duration: "10:03",
  },
] as const;
