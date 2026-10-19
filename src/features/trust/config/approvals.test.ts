import { describe, expect, it } from "vitest";

import { approvedTestimonials, reviewsContent } from "@/features/reviews/config/reviews-content";

import { approvedClients, networkContent } from "./network-content";

describe("clients and testimonials", () => {
  it("renders only entries with written permission", () => {
    const base = { logo: "/x.svg", width: 1, height: 1 };
    expect(
      approvedClients([
        { ...base, name: "Approvato", permission: true },
        { ...base, name: "In attesa", permission: false },
      ]).map((entry) => entry.name),
    ).toEqual(["Approvato"]);
    expect(
      approvedTestimonials([
        { quote: "…", person: "A", permission: true },
        { quote: "…", person: "B", permission: false },
      ]).map((entry) => entry.person),
    ).toEqual(["A"]);
  });

  it("publishes the six collaborators BSR supplied and no testimonial until approved", () => {
    expect(approvedClients(networkContent.partners)).toHaveLength(6);
    expect(approvedTestimonials(reviewsContent.testimonials)).toEqual([]);
  });
});
