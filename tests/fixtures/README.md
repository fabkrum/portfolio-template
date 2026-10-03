# Test fixtures

All data here is fake. Phone numbers are zeros, addresses are invented
placeholders; never put real ones in, this repo is public.

- `invalid-content/` – content files the schema must reject.
- `broken-sites/` – one folder per broken site for the Check. Each holds only
  the files that differ from the sample site in `site/`, plus a `fixture.json`:
  `expect` names the one Check item that must need attention, `finding` is
  text its report must contain, `remove` lists sample files to delete. The
  tests lay the folder over a copy of `site/`.
- `clean-sites/` – the same, for sites with tricky but harmless content (dates,
  ISBNs, "Corso di Laurea") that must pass every item.
