# NetSettle operator as a Decentralized Party

The netting operator in NetSettle is the one party that sees the whole
obligation graph and the one whose signature commits a settlement. That makes it
the exact party you do *not* want a single host to control: today one process
holds the keys that authorise `Execute`.

This directory makes that operator a **Canton Decentralized Party** hosted by two
participants with **threshold 2** — so no single host, operator or cloud account
can settle a cycle on its own. Both must confirm.

It is deliberately isolated from the product: nothing in `apps/`, `packages/` or
`daml/` changes, and the sandbox demo keeps running exactly as before.

## What this proves (and what it does not)

Proven, reproducible on this machine:

- A **Canton LocalNet** (three participants, synchronizer, wallets, Keycloak)
  booted with one command.
- The **Decentralization Manager** (`decman` v1.12.0, DLC-link) attached to real
  participant **Admin APIs**, generated Noise identities, and formed a peer mesh.
- A **decentralized party `netsettle-operator` created on-ledger** with
  `threshold: 2` and two distinct participant owner keys.
- Both peers complete the onboarding workflow: invite → accept → P2P proposal
  signed by both → topology confirmed.

Not done yet (the remaining work to a full BitSafe submission):

- Uploading the NetSettle DAR to the LocalNet participants.
- Granting the DP `actAs` rights and deploying `GovernanceRules`.
- Exercising `Execute` **as the DP** so the settlement itself runs under the
  2-of-2 rule. This is the part that touches product code, and it is the part
  worth doing carefully.

## Run it

```bash
bash dp/up-localnet.sh          # LocalNet (Keycloak auth) + 2 DM nodes, ~10 min first run
bash dp/onboard-operator.sh     # create the 2-of-2 operator party
bash dp/verify-operator.sh      # assert threshold 2 + two owners on the ledger
```

Teardown: `canton builder stop && docker rm -f dm-provider dm-user`.

## The shape of it

```
                    ┌──────────────────────────────┐
                    │  LocalNet (canton builder)   │
                    │  synchronizer + 3 parties    │
                    └───┬──────────────────────┬───┘
        admin 3902 ┌───┴────┐            ┌────┴───┐ admin 2902
                    │ app-   │            │ app-   │
                    │provider│            │  user  │
                    └───┬────┘            └────┬───┘
       Noise :9151   DM node (coordinator)  DM node :9152
                    └───────────┬──────────────┘
                     Noise mesh, 1 ms, v1.12.0
                                │
                  netsettle-operator::1220c096…  threshold 2
                  owner A 122082411ae4b…  (app-provider)
                  owner B 122087cfe4a4e…  (app-user)
```

Each DM node holds **one half** of the party's signing authority. The threshold
rule lives in the party namespace on Canton, not in either process: that is what
makes "no single host can settle" a ledger property rather than a promise.

## Why two hosts, not three

`canton builder` ships Keycloak realms for `AppProvider` and `AppUser` only —
the `sv` participant has no OAuth realm, so it cannot obtain a ledger token and
cannot be a DM member. Two members with threshold 2 gives the property we care
about (unanimous: neither host alone can act). A third host is a deployment
detail, not a different security property.

## Notes that cost time

- `canton builder start` reads stdin for a `/etc/hosts` prompt and aborts under
  `set -e` if stdin is closed: pipe answers in (`printf 'n\n' |`).
- DM ports must not collide with anything already listening (8080 was taken).
- `POST /network-config` takes a **bare JSON array**, not `{peers: [...]}`.
- `POST /onboarding` `peer_ids` are **participant ids** (`participant::1220…`),
  not member parties (`app_user_…`) — passing parties fails the mesh check.
- The DM validates the issuer Keycloak advertises, so the nodes need
  `--add-host keycloak.localhost:127.0.0.1` and `DECPM_KEYCLOAK_URL` pointing at
  `http://keycloak.localhost:8082` even when reached over `127.0.0.1`.