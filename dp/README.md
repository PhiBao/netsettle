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
- A **`Governance.Rules` contract created by the party itself**, with both members
  in the party set and `threshold: 2` on the ledger.
- **A governed action submitted by one host is refused by that Daml contract**:

  ```
  AssertionFailed (error category 9):
  The requirement 'Enough confirmations to execute action' was not met.
  ```

  The same action executes once the second host confirms, and the on-ledger
  `GovernanceExecutionResult` names both confirmers. This is the point worth
  having: the refusal is a *ledger* property, so it survives an operator who
  controls the application code. An application-level check would not.

Not done yet (what a full BitSafe submission would still need):

- **Running NetSettle's own `Execute` as the party.** Right now the 2-of-2 rule
  governs the operator's governance contract; the settlement path in
  `packages/canton-gateway` still submits as a single participant. Wiring the
  app's `Execute` through the DP is the remaining piece, and it is the only step
  that would touch the verified settlement code.

## Run it

```bash
bash dp/up-localnet.sh          # LocalNet (Keycloak auth) + 2 DM nodes, ~10 min first run
bash dp/onboard-operator.sh     # create the 2-of-2 operator party
bash dp/verify-operator.sh      # assert threshold 2 + two owners on the ledger
bash dp/deploy-governance.sh    # deploy GovernanceRules as the party
bash dp/prove-two-of-two.sh     # the test: one host is refused, both succeed
```

`prove-two-of-two.sh` exits non-zero if a single host is ever allowed through, so
it is safe to wire into CI rather than trusting one green run.

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

## Credentials

Nothing here hardcodes a credential. `dp/lib-localnet.sh` reads the LocalNet
client secrets from the Keycloak realm files `canton builder start` writes, and
honours `PROV_SECRET` / `USER_SECRET` if you point these scripts at your own IdP.

Those LocalNet secrets are fixtures of the public Canton Builder Tool rather than
credentials of ours, so there is nothing to rotate - but they still stay out of
git: a repository that trips a secret scanner on every commit teaches reviewers
to wave alerts through, which is how a real leak gets missed.

## Notes that cost time

- `canton builder start` reads stdin for a `/etc/hosts` prompt and aborts under
  `set -e` if stdin is closed: pipe answers in (`printf 'n\n' |`).
- DM ports must not collide with anything already listening (8080 was taken).
- `POST /network-config` takes a **bare JSON array**, not `{peers: [...]}`.
- `POST /onboarding` `peer_ids` are **participant ids** (`participant::1220…`),
  not member parties (`app_user_…`) - passing parties fails the mesh check.
- The DM validates the issuer Keycloak advertises, so the nodes need
  `--add-host keycloak.localhost:127.0.0.1` and `DECPM_KEYCLOAK_URL` pointing at
  `http://keycloak.localhost:8082` even when reached over `127.0.0.1`.
- A decentralized party is a **new namespace**, so no participant can act as it
  until `POST /auth/grant-rights` is called on every node. Without that the
  contracts workflow dies with a bare "caller does not have permission".
- The contracts workflow also needs `PUT /party-config` for the **DP itself**,
  not just for each node's own participant party, or it fails with
  "No credentials configured for party".
- `proposal` and `action` have **different schemas**: the proposal is what gets
  voted on (`generic_vote`, `transfer`, …) while the action says which domain
  operation the vote authorises (`governance_set_threshold`, …). Passing a
  `generic_vote` as the action is rejected at deserialisation.
