# Review automation

DealScout treats human review as an exception path.

- Verified, in-stock deals with a valid 15%+ price drop and product image publish automatically.
- Verified 12%–14.9% discounts may enter human review, but never auto-publish.
- Invalid, unavailable, unverified, or sub-12% deals are rejected before entering the review queue.
- Suspiciously extreme discounts (80%+) and missing-image deals require human review.
- Random editorial sampling is disabled by default. `EDITORIAL_HOLDBACK_PERCENT` can opt into sampling later if desired.
- Admin reviewers can Publish Normally, Publish as Pick, Reject, or Save for Later.
- A manual rejection is sticky on ordinary rediscovery so the same ASIN does not keep returning to the queue.

This keeps the owner workload small while preserving human oversight for genuinely unusual or merely modest deals.
