# Vastra product-document authority

Use product documents in the following precedence order:

1. [`commercial-launch-contract.md`](./commercial-launch-contract.md) — controlling founder contract for full commercial launch, multi-city operations, merchant branches, cloud shops, local/postal fulfilment, city configuration, scoped administration, and commercial activation.
2. [`product-requirements.md`](./product-requirements.md) — frozen historical MVP transaction and feature requirements that remain valid only where they do not conflict with the commercial launch contract.
3. Design, sprint, implementation, prompt, pilot, fixture, and test documents — implementation evidence and lower-authority detail. They MUST NOT silently override either product contract.

## Superseded MVP assumptions

The commercial launch contract supersedes these former MVP boundaries:

- one limited Tirupati zone as the permanent architecture boundary;
- one merchant login owning only one shop;
- multiple merchant branches being a non-goal;
- full multi-city operations being a non-goal;
- city activation requiring a source-code release;
- local captain delivery being the only fulfilment mode.

Tirupati remains the first commercial city. Bengaluru and Chittoor are the next approved cities. All new architecture MUST be configurable for additional cities without city-specific source-code changes.

## Change control

A contributor or agent changing a commercial rule must update the versioned commercial launch contract, identify all affected applications and data contracts, and add or update acceptance evidence. Obsolete pilot fixtures or prompts are not product authority.