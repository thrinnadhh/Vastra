# Codex prompt pack — Sprints 9 to 11 Wardrobe and Style Together

Use the master contract. Implement Wardrobe before Couple, and Couple before Groups. Execute one roadmap ticket at a time.

# Sprint 9 — Digital Wardrobe

## Objective

Create a private personal dressing-room experience that can reuse purchased or uploaded clothing and support later explicit sharing.

## Privacy rules

- Every new item is private by default.
- No partner or group sees an item without explicit sharing.
- Visibility changes must be understandable and reversible.
- Disconnecting/leaving a context removes access according to backend rules.
- Do not expose private storage URLs or metadata.

## Item flows

Support only repository-backed methods:

- add from a Vastra purchase;
- upload an owned item;
- manual metadata correction.

Validate image size/type and use the approved storage path. Do not infer sensitive attributes from images.

## Metadata

Use supported fields such as category, subcategory, dominant colour, pattern, season, occasion, fit/style tags and ownership state. Do not add schema fields inside a UI ticket.

## Suggestions

- Start with deterministic rules or existing recommendation endpoints.
- Explain why an outfit is suggested when possible.
- Reuse owned items before promoting missing products.
- Clearly separate wardrobe-owned items from nearby shop products.

## Required tests

- private default;
- upload/add purchased item;
- metadata edit;
- visibility change/revoke;
- empty wardrobe;
- image failure;
- suggestion state;
- authorization/privacy E2E.

# Sprint 10 — Vastra Couple

## Objective

Implement a private, mutual, exactly-two-person outfit-planning feature. It is not a dating, matching or stranger-discovery feature.

## Connection contract

- one active Couple connection per user for MVP;
- invitation through approved private mechanisms;
- recipient must accept;
- either person may decline or disconnect;
- existing connection must be resolved before a new one becomes active;
- do not reveal a full wardrobe after connection.

## Plan flow

1. create occasion plan;
2. both users select items they explicitly share for that plan or connection;
3. show waiting/readiness state;
4. generate matching, complementary or same-theme suggestions;
5. allow item replacement and reactions;
6. allow each owner to approve their own look;
7. show missing nearby products;
8. present a final coordinated look.

## UI mode

- CoupleIntro and CoupleFinalLook: Brand.
- CoupleHome: Hybrid.
- invite, consent, planning, wardrobe sharing and purchase: Commerce.

Do not use swipe cards, public profiles, compatibility scores, nearby people or unsolicited messaging.

## Security and privacy tests

- cannot view before acceptance;
- cannot view unshared item;
- cannot act for partner;
- stale/revoked invitation;
- one-active-connection race;
- disconnect removes access;
- block/report entry where supported;
- adult/age policy presentation where required.

## E2E

Invite -> accept -> create plan -> share selected items -> suggestions -> approve -> nearby product -> disconnect/revoke.

# Sprint 11 — Vastra Groups

## Objective

Implement invitation-based multi-person outfit coordination for families, friends, weddings, trips and events, separately from Couple.

## Membership rules

- group owner and approved member roles only;
- invitations must be accepted;
- users may belong to multiple groups;
- leaving a group is independent of Couple;
- group deletion is owner-authorized and confirmed;
- member private wardrobes are not globally visible.

## Event flow

1. create group;
2. invite members;
3. create event;
4. set occasion, dress code and colour palette;
5. members explicitly share/submit items or looks for that event;
6. show group gallery and coordination feedback;
7. support voting/change requests where backend capability exists;
8. display readiness;
9. generate group shopping list from missing items;
10. present final event look.

## UI mode

- GroupsIntro and GroupFinalLook: Brand.
- GroupsHome, GroupHome and gallery: Hybrid.
- membership, event forms, sharing, voting and readiness: Commerce.

## Group recommendation rules

- preserve individual style;
- do not force identical outfits unless the event explicitly requests a uniform;
- use palette/dress-code compliance, occasion fit and variation;
- never fabricate readiness or votes.

## Required tests

- role permissions;
- invitation acceptance/expiry;
- join/leave/delete;
- event-scoped sharing;
- unauthorized wardrobe access;
- submit/update own look only;
- voting/change-request permissions;
- readiness calculation rendering;
- multi-member E2E.

## Shared implementation boundary

Wardrobe primitives may be shared. These domain models must remain separate:

- Couple connection and consent;
- Group membership and roles;
- Couple plan approval;
- Group event voting/readiness.

Do not create a generic relationship model that weakens these differences merely to reduce code.

## Out of scope

- stranger discovery;
- dating profiles;
- public social feed;
- continuous location sharing;
- automatic access to all wardrobe items;
- advanced generative virtual try-on;
- changing domain schemas without an approved backend ticket.
