# DNS Operations

Production DNS for `aiconverter.app` is authoritative at Porkbun.

## Current State

- Registrar nameservers:
  - `curitiba.ns.porkbun.com`
  - `fortaleza.ns.porkbun.com`
  - `maceio.ns.porkbun.com`
  - `salvador.ns.porkbun.com`
- Apex record: Porkbun `ALIAS` from `aiconverter.app` to `aiconverter-wnm.pages.dev`.
- `www` record: Porkbun `CNAME` from `www.aiconverter.app` to `aiconverter-wnm.pages.dev`.
- Cloudflare Pages project: `aiconverter`.
- Cloudflare Pages domains: `aiconverter.app` and `www.aiconverter.app`.

## Why This Is Explicit

On 2026-05-27 and again on 2026-05-30, the registrar delegated `aiconverter.app`
to Cloudflare nameservers:

- `giancarlo.ns.cloudflare.com`
- `kiki.ns.cloudflare.com`

Cloudflare's zone for `aiconverter.app` was not active for authoritative DNS and
the assigned Cloudflare nameservers returned `REFUSED`, which caused public DNS
lookups to fail. The site was restored by switching authoritative DNS back to
Porkbun, where the correct Pages records already existed.

Do not move the domain back to Cloudflare nameservers until all of these are true:

- A Cloudflare credential with DNS Write and Zone Write access is available.
- The Cloudflare zone has the required apex and `www` records.
- The Cloudflare zone activation check succeeds.
- Public DNS resolves from at least `1.1.1.1` and `8.8.8.8`.
- `https://aiconverter.app/` returns HTTP 200.

## Verification

```bash
dig @216.239.32.105 aiconverter.app NS +norecurse +noall +authority
dig @1.1.1.1 aiconverter.app A +short
dig @8.8.8.8 aiconverter.app A +short
curl -I --max-time 20 https://aiconverter.app/
curl -I --max-time 20 https://www.aiconverter.app/
```
