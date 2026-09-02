# Review automation

DealScout treats human review as an exception path.

- Verified, in-stock deals with a valid 15%+ price drop and product image publish automatically.
- Clearly invalid, unavailable, unverified, or sub-15% deals are rejected before entering the review queue.
- Suspiciously extreme discounts (80%+) and missing-image deals require human review.
- Random editorial sampling is disabled by default. `EDITORIAL_HOLDBACK_PERCENT` can opt into sampling later if desired.
- Admin reviewers can Publish Normally, Publish as Pick, Reject, or Save for Later.

This keeps the queue small while preserving human oversight for data that actually looks unusual.
