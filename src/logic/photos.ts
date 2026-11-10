/** Profile photos in public/people, one per person id. Source and licence: "Data Generation/profile photos/README.md". */
const PHOTO_IDS = new Set(["noa", "marco", "aaliyah", "wei", "priya", "dima", "carmen", "kwame", "fatima", "shiv"]);

/** Photo URL for a person, or undefined so the initials fallback shows. */
export const photoFor = (personId: string | undefined): string | undefined =>
  personId && PHOTO_IDS.has(personId) ? `/people/${personId}.jpg` : undefined;
