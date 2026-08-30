# Feed pull loop

The home feed is intentionally finite and quality-first.

- **Deal Drop** shows up to 8 of the strongest currently ranked verified deals for a quick visit.
- **Explore** removes those immediate duplicates, renders 16 deals initially, and automatically reveals 12 more as the shopper approaches the bottom.
- Existing local personalization signals continue to reorder quality-ranked deals: saves are strongest, opens are medium, and meaningful dwell is weaker.
- A local-only last-visit timestamp powers the “new since your last visit” return cue without sending browsing history to the server.
- When worthwhile inventory is exhausted, the feed says the shopper is caught up instead of recycling weaker inventory.

The feed should remain quality-first: personalization may reorder approved deals, but should not promote unverified or low-quality inventory merely to extend scroll depth.
