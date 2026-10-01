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

Proven, reproducible on this machine, and each assertion exits non-zero if it
stops holding:

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
- **NetSettle's own settlement running under that party's authority**, end to end.
- **A governed action submitted by one host is refused by that Daml contract**:

  ```
  AssertionFailed (error category 9):
  The requirement 'Enough confirmations to execute action' was not met.
  ```

  The same action executes once the second host confirms, and the on-ledger
  `GovernanceExecutionResult` names both confirmers. This is the point worth
  having: the refusal is a *ledger* property, so it survives an operator who
  controls the application code. An application-level check would not.

- **A settlement executed under the party's authority**, refused to the host that
  proposed it, with the receipts signed by the party and the obligation consumed
  atomically. See below.


## The settlement itself, wired to the party's authority

The operator is not just governed; the settlement is expressed as a
`GovernableAction`, the interface `Governance.Rules` exercises once `threshold`
members have confirmed. `GovernableAction_Execute` is declared by the interface
with `controller (view this).governanceParty`, so `executeImpl` runs *as the
party*, and the same code that refuses a single host is what settles once both
have agreed.

`dp/settle-as-decentralized-party.sh` runs the whole thing and asserts both
halves:

```
==> host A creates the obligation, the approval, and proposes the settlement
    settlement   006926ee852c0911...  proposed by one host, executable by neither

==> host A tries to execute the settlement it just proposed
    -> REFUSED. Daml named the party whose authority was required:
       ...:GovernedSettlement) requires authorizers
       netsettle-operator::1220c096..., but only
       app_provider_builder-localnet-1... were given

==> each member confirms the proposal through the Decentralization Manager
    host A confirm -> ok        confirmations: 1 of 2
    host B confirm -> ok        confirmations: 2 of 2

==> the DM executes the proposal as the operator party
    can_execute reported by the DM: True
    execute -> {"message": "Action executed successfully"}

==> did the settlement actually happen under the party?
    receipt      0042c6afaa01de55...  100000 EUR  signed by netsettle-operator::1220c096...
    obligation   006483a4e7203a41... consumed (Settle exercised, archived)

PASS: the proposing host was refused, and the operator party settled.
```

Exit code `0` only when both directions hold, so it is safe to put in CI rather
than trusting one green run. The on-ledger audit record names the parties:

```json
{ "actionLabel": "SettleGoverned",
  "executor":   "app_provider_builder-localnet-1::1220b1a5...",
  "confirmers": ["app_user_builder-localnet-1::1220d5ad...",
                 "app_provider_builder-localnet-1::1220b1a5..."] }
```

### Design points that the governance engine forces

These are not preferences; each one is a rule in `Governance.Rules`, and
violating it makes the action unexecutable at run time rather than at build time.

- **`proposer` is the proposal's sole signatory.** That is what lets one member
  file a proposal alone, and it keeps the authority `executeImpl` needs down to
  `{proposer, governanceParty}`.
- **`governanceParty` observes, it does not sign.** It is the *controller* of
  `GovernableAction_Execute`, not a signatory. So a host can propose a
  settlement, because proposing is not settling.
- **`operator` is an observer, not a signatory.** An extra signatory would make
  `executeImpl` require authority the engine will not grant it.
- **Anything `executeImpl` touches must be controllable by the party.** So
  `GovernedObligation.Settle` is controlled by `governanceParty`, not by
  `operator` - which is also why no single host can consume an obligation.
- **Receipts are signed by the party alone.** A receipt on the ledger is then
  itself evidence that the party authorised the settlement.

`dp/daml-governed` is a **separate Daml package** from `daml/`, on SDK 3.4.11 to
match the governance packages. Depending on them changes the package hash, which
would force a re-vet of the live demo's DevNet package; keeping it separate makes
the governed path purely additive.

### Getting writes to work at all

Worth recording, because each of these fails as an unhelpful `403 "A
security-sensitive error has been received"` and only the participant log or the
builder tool's env files say why:

- **Two identities, two purposes.** Package upload is a participant-admin action
  and wants the *validator* token; submitting commands wants a *user* session. A
  user token gets 403 on upload, a validator token gets 403 on writes.
- **A user session, not a service account.** Only a password grant counts. The
  `*-unsafe` clients are public and direct-grant enabled, which is why the
  password grant is the only way in.
- **`userId` must be the token's `sub` claim** - the user's UUID, not their
  username. The participant log spells it out: `Claims are only valid for userId
  '553c6754-…', actual userId is 'app-provider'`.
- **The audience must be `https://canton.network.global`** (from
  `~/.canton-builder/modules/keycloak/compose.env`).
- **Both participants must vet the package** before anything referencing it can be
  submitted, or the submission fails with `NO_SYNCHRONIZER_FOR_SUBMISSION`.
- **An interface choice belongs to the interface.** The `templateId` is
  `governance-action-v1…:Governance.Action:GovernableAction` while the
  `contractId` is the implementing contract; using the implementing template id
  gives `Invalid template … or choice:GovernableAction_Execute`.

Two versioning traps, both from the same rule - a participant refuses to vet two
packages with the same name:

- Changing a template's signatories is **not** a migration Canton can upgrade
  through. The same name at a higher version fails with
  `NOT_VALID_UPGRADE_PACKAGE`, and the same name at the same version with
  `KNOWN_PACKAGE_VERSION`. A **new name** is the way to ship a breaking change,
  which is why the package is `netsettle-governed-v1`. The harness reads the
  name and version back out of the DAR, so it can be bumped freely.

And one from the DM's request schema rather than Daml's:

- **For `governance_type: "core_domain"` the `action` field is required but
  unused** - `proposal_cid` identifies the work item. It only has to
  deserialise. The hackathon branch's guide uses `generic_vote` as the
  placeholder, but released images whose action enum lacks that variant reject
  it, so `dp/settle-scenario.py` uses a well-formed self-action instead.

LocalNet users have argon2-hashed passwords that cannot be recovered, so
`dp/lib-localnet.sh` resets one through the Keycloak admin API (`admin`/`admin`).
That is acceptable here and only here: the Keycloak belongs to a throwaway
LocalNet on our own machine, holds nothing of ours, and is discarded by
`canton builder stop`.

### The official sandbox

DLC-link ships a purpose-built one for this challenge, on the `hackathon` branch:
three participants and three DecMan nodes, no identity provider at all
(`DECPM_INSECURE=true`). `./hackathon/up.sh` brings it up in one command.

That is the better environment for a demo - no Keycloak, no token juggling - and
worth switching to if this is presented live. It needs 12GB of memory and 4 CPUs
for Docker and ~20GB of disk, and it pins its own DecMan image tag. The harness in
`dp/` does not depend on it; it deliberately runs against a plain
`canton builder` LocalNet so the 2-of-2 party can be built with `dp/` alone.

## Run it

The whole thing is one command:

```bash
bash dp/reproduce.sh            # ~35 min first run, prints each step and stops on failure
```

Prerequisites: Docker with Compose v2.1.1+, `curl`, `jq` >= 1.6, the Canton Builder
Tool and the Daml SDK (`dpm`). Roughly 8GB of RAM.

The individual steps, if you want to run them one at a time:

```bash
bash dp/up-localnet.sh          # LocalNet (Keycloak auth) + 2 DM nodes, ~10 min first run
bash dp/onboard-operator.sh     # create the 2-of-2 operator party
bash dp/verify-operator.sh      # assert threshold 2 + two owners on the ledger
bash dp/deploy-governance.sh    # deploy GovernanceRules as the party
bash dp/prove-two-of-two.sh     # the test: one host is refused, both succeed

# the governed settlement
bash dp/vendor-governance.sh                       # fetch the governance packages
(cd dp/daml-governed && dpm build)                 # build netsettle-governed
bash dp/settle-as-decentralized-party.sh           # settle under the party
```

Exit codes for the last one: `0` both directions hold, `4` the authority boundary
held but the governed execution produced no receipt, `1` failed, `3` the
environment blocked writes.

`prove-two-of-two.sh` exits non-zero if a single host is ever allowed through, so
it is safe to wire into CI rather than trusting one green run.

Teardown: `bash dp/down.sh` (add `--purge` to delete the party and the ledger).

Every step is idempotent. `up-localnet.sh` keeps an existing ledger rather than
restarting it, and `onboard-operator.sh` reuses an existing party instead of
failing against a prefix already on the ledger — so re-running any of this is
safe, which matters because a judge will not be on a pristine machine.

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

## What we claim, and what we do not

The BitSafe challenge asks integrations to demonstrate the behaviour their model
claims, and says plainly that *"multiple nodes alone do not prove independent
control or outage tolerance"* and that *"judges will reward honest scope"*.
So, precisely:

**Claimed and demonstrated — shared control.** A governed settlement cannot
execute below the confirmation threshold and succeeds once it is met. Shown twice,
on the ledger, with asserting scripts:

| | Script | Evidence |
|---|---|---|
| Governance layer | `dp/prove-two-of-two.sh` | `Enough confirmations to execute action was not met`, then `Action executed successfully` |
| Settlement layer | `dp/settle-as-decentralized-party.sh` | `requires authorizers netsettle-operator::…`, then a receipt signed by that party |

**Not claimed — distributed hosting.** We do not demonstrate behaviour when a
hosting node goes offline, so we make no availability claim. Stopping one of our
two LocalNet nodes would show that its *signature* is required, but both nodes run
on one machine, so it would say nothing about machine-level outage tolerance.
Saying otherwise would be exactly the overclaim the brief warns against.

## Nodes, operators, thresholds, independence

Required by the brief, so stated explicitly rather than left to be inferred.

| | |
|---|---|
| Party | `netsettle-operator::1220c096f43bba0d44b93798c731ac3a6a4c66e4ff2587b44d371ba2a0ee3500453b` |
| Threshold | **2 of 2** |
| Members | `app_provider_builder-localnet-1::1220b1a5…`, `app_user_builder-localnet-1::1220d5ad…` |
| Key custody | each member holds one owner key contribution; the party's namespace needs both to sign |
| Governed contract | `Governance.Rules`, created by the party, `threshold: 2` |

**On independence, precisely:** the two members are genuinely separate Canton
participants, with separate host keys, separate participant namespaces and
separate Decentralization Manager instances that reach each other only over an
encrypted Noise mesh. No single one of them can sign for the party — that is
enforced at the namespace level, not merely in a contract, and we verified it:
submitting as the party from either participant alone is refused with `HTTP 403`,
and only the two co-signing path succeeds.

**But in this LocalNet demo both nodes are operated by us, on one machine.** So
what we have demonstrated is *cryptographic* independence of the operators' keys
and the threshold rule, not *organisational* independence of operators. In a real
deployment the members would be separate organisations with separate
infrastructure, and that is the property a reader should weigh. We would rather
state the limit than let a reader assume more than we showed.
