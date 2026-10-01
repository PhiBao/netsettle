#!/usr/bin/env python3
"""Ledger scenario for dp/settle-as-decentralized-party.sh.

Configuration comes from the environment; the shell wrapper handles auth, party
discovery and package distribution. The flow follows DLC-link's
docs/CUSTOM_DAML_TEMPLATES.md, "Path B" plus "Confirm and execute via DecMan":

  1. a member creates the obligation, the approval and the proposal (Ledger API);
  2. that member is refused when it tries to execute the proposal itself;
  3. both members confirm through the DM, and the DM executes the proposal as the
     decentralized party, which runs `executeImpl` and issues the receipts.

Split out of the shell script because quoting nested JSON payloads through four
levels of shell is not worth the fight.
"""
import json
import os
import random
import sys
import urllib.error
import urllib.request

PKG = os.environ["PKG"]
GOV_ACTION = os.environ["GOV_ACTION"]
DP = os.environ["DP"]
LEDGER = os.environ["LEDGER"]
DM_API = os.environ["DM_API"]
DM_API2 = os.environ["DM_API2"]
TOKEN = os.environ["TP"]
PEER_TOKEN = os.environ["TU"]
PROV = os.environ["PROV_PARTY"]
TERMS = os.environ["TERMS_HASH"]
SID = os.environ["SETTLEMENT_ID"]

MOD = "NetSettle.Governed"
LEDGER_URL = f"http://localhost:{LEDGER}/v2/commands/submit-and-wait-for-transaction"

# For governance_type "core_domain" the `action` field is required by the request
# schema but unused - proposal_cid is what identifies the work item. It only has
# to deserialise, so this is a well-formed self-action used purely as a
# placeholder. Passing `generic_vote` fails on releases whose action enum does
# not include it, which is a different release from the hackathon branch.
PLACEHOLDER = {"type": "governance_set_threshold", "new_threshold": 2}

# The interface choice belongs to the *interface*, so templateId is the
# interface's own and contractId is the implementing contract. Using the
# implementing template id fails with "Invalid template ... or choice".
IFACE = f"{GOV_ACTION}:Governance.Action:GovernableAction"


# --------------------------------------------------------------------------- #
# Ledger
# --------------------------------------------------------------------------- #
def submit(act_as, command):
    body = json.dumps(
        {
            "commands": {
                "actAs": act_as,
                "userId": os.environ["CANTON_USER_ID"],
                "commandId": f"dp-{random.randint(1 << 30, 1 << 40)}",
                "commands": [command],
            }
        }
    ).encode()
    req = urllib.request.Request(
        LEDGER_URL,
        data=body,
        method="POST",
        headers={"Authorization": f"Bearer {TOKEN}", "Content-Type": "application/json"},
    )
    try:
        with urllib.request.urlopen(req, timeout=300) as response:
            return json.loads(response.read().decode())
    except urllib.error.HTTPError as err:
        return {"httpStatus": err.code, "error": err.read().decode()[:600]}


def tpl(entity):
    return f"{PKG}:{MOD}:{entity}"


def created(tx, entity):
    """Contract ids of `entity` created anywhere in a transaction, in order."""
    found, stack = [], [tx]
    while stack:
        node = stack.pop()
        if isinstance(node, dict):
            cid, tid = node.get("contractId"), node.get("templateId")
            if cid and isinstance(tid, str) and tid.endswith(f":{entity}"):
                found.append(cid)
            stack.extend(node.values())
        elif isinstance(node, list):
            stack.extend(node)
    return list(dict.fromkeys(found))


def create(act_as, entity, args):
    tx = submit(act_as, {"CreateCommand": {"templateId": tpl(entity), "createArguments": args}})
    ids = created(tx, entity)
    if not ids:
        blob = json.dumps(tx)
        if tx.get("httpStatus") in (401, 403) or "security-sensitive" in blob:
            print("    BLOCKED: the participant refused to sign this write.")
            print("    See dp/lib-localnet.sh - writes need a user session and a")
            print("    userId equal to the token's `sub` claim.")
            sys.exit(3)
        print(f"    create {entity} failed: {blob[:400]}")
        sys.exit(1)
    return ids[0]


def execute_as(act_as, cid):
    return submit(
        act_as,
        {
            "ExerciseCommand": {
                "templateId": IFACE,
                "contractId": cid,
                "choice": "GovernableAction_Execute",
                "choiceArgument": {},
            }
        },
    )


def authorization_error(tx):
    """Canton reports this through nested, escaped JSON, so slice the raw text
    around the phrase rather than trying to parse our way down to it."""
    blob = json.dumps(tx).replace('\\"', '"')
    index = blob.find("requires authorizers")
    if index == -1:
        return ""
    start = blob.rfind("Interpretation error", 0, index)
    start = start if start != -1 else max(0, index - 60)
    end = blob.find('",', index)
    end = end if end != -1 else index + 240
    return blob[start:end].strip()


# --------------------------------------------------------------------------- #
# Decentralization Manager
# --------------------------------------------------------------------------- #
def dm(port, token, method, path, body=None):
    url = f"http://localhost:{port}{path}"
    data = json.dumps(body).encode() if body is not None else None
    headers = {"Authorization": f"Bearer {token}"}
    if data:
        headers["Content-Type"] = "application/json"
    req = urllib.request.Request(url, data=data, method=method, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=300) as response:
            return json.loads(response.read().decode() or "{}")
    except urllib.error.HTTPError as err:
        return {"httpStatus": err.code, "error": err.read().decode()[:600]}


def governance_state():
    return dm(DM_API, os.environ["TPV"], "GET", f"/governance/confirmations?party_id={DP}")


def confirmations_for(proposal_cid):
    state = governance_state()
    for action in state.get("domain_actions") or []:
        if action.get("proposal_cid") == proposal_cid:
            return action
    return {}


# --------------------------------------------------------------------------- #
def main():
    rules_cid = governance_state().get("rules_contract_id")
    threshold = governance_state().get("threshold")
    if not rules_cid:
        print("no GovernanceRules for this party - run dp/deploy-governance.sh first")
        return 1
    print(f"rules contract {rules_cid[:24]}...  threshold {threshold}")

    print("\n==> host A creates the obligation, the approval, and proposes the settlement")
    obl = create(
        [PROV],
        "GovernedObligation",
        {
            "governanceParty": DP,
            "operator": PROV,
            "debtor": PROV,
            "creditor": PROV,
            "amountMinor": "100000",
            "currency": "EUR",
            "reference": "OB-GOVERNED-1",
        },
    )
    print(f"    obligation   {obl[:20]}...")

    app = create(
        [PROV],
        "GovernedApproval",
        {
            "operator": PROV,
            "approver": PROV,
            "settlementId": SID,
            "termsHash": TERMS,
        },
    )
    print(f"    approval     {app[:20]}...")

    settle = create(
        [PROV],
        "GovernedSettlement",
        {
            "governanceParty": DP,
            "proposer": PROV,
            "actionLabel": "SettleGoverned",
            "description": "Settle the October intercompany cycle under the operator party",
            "settlementId": SID,
            "operator": PROV,
            "obligationCids": [obl],
            "approvalCids": [app],
            "residuals": [{"_1": PROV, "_2": PROV, "_3": "100000"}],
            "currency": "EUR",
            "valueDate": "2026-10-31T00:00:00Z",
            "requiredApprovers": [PROV],
            "expiresAt": "2026-12-31T00:00:00Z",
            "termsHash": TERMS,
        },
    )
    print(f"    settlement   {settle[:20]}...  proposed by one host, executable by neither")

    print("\n==> host A tries to execute the settlement it just proposed")
    tx = execute_as([PROV], settle)
    detail = authorization_error(tx)
    if detail or created(tx, "SettlementReceipt"):
        if created(tx, "SettlementReceipt"):
            print("    *** EXECUTED BY THE PROPOSING HOST - the boundary does not hold ***")
            return 1
        print("    -> REFUSED. Daml named the party whose authority was required:")
        print("       " + (detail[:300] if detail else "governanceParty"))
        boundary = True
    else:
        print("    *** unexpected: " + json.dumps(tx)[:300])
        boundary = False

    # From here the DM drives it. `action` is required by the request schema but
    # unused for core_domain - proposal_cid identifies the work item.
    print("\n==> each member confirms the proposal through the Decentralization Manager")
    for label, port, token in (
        ("host A", DM_API, os.environ["TPV"]),
        ("host B", DM_API2, os.environ["TUV"]),
    ):
        r = dm(
            port,
            token,
            "POST",
            "/governance/confirm",
            {
                "party_id": DP,
                "rules_contract_id": rules_cid,
                "proposal_cid": settle,
                "action": PLACEHOLDER,
                "governance_type": "core_domain",
            },
        )
        ok = "error" not in r
        print(f"    {label} confirm -> {'ok' if ok else json.dumps(r)[:160]}")
        action = confirmations_for(settle)
        count = len(action.get("confirmations") or [])
        print(f"    confirmations: {count} of {threshold}")

    print("\n==> the DM executes the proposal as the operator party")
    action = confirmations_for(settle)
    cids = [c["contract_id"] for c in action.get("confirmations") or []]
    print(f"    can_execute reported by the DM: {action.get('can_execute')}")
    if not cids:
        print("    no confirmations recorded - cannot execute")
        return 4
    r = dm(
        DM_API,
        os.environ["TPV"],
        "POST",
        "/governance/execute",
        {
            "party_id": DP,
            "rules_contract_id": rules_cid,
            "proposal_cid": settle,
            "confirmation_cids": cids,
            "disclosed_contracts": [],
            "action": PLACEHOLDER,
            "governance_type": "core_domain",
        },
    )
    print(f"    execute -> {json.dumps(r)[:300]}")

    print("\n==> did the settlement actually happen under the party?")
    live = active_contracts()

    # Receipts for this run's settlement only. Earlier runs leave their own
    # receipts behind, so counting every receipt would overstate this one.
    receipts = [c for c in live.get("SettlementReceipt", []) if c["createArgument"].get("settlementId") == SID]
    if not receipts:
        print("    no receipt for this settlement - executeImpl did not settle anything")
        return 4
    for c in receipts:
        args = c["createArgument"]
        print(
            f"    receipt      {c['contractId'][:32]}..."
            f"  {args.get('amountMinor')} {args.get('currency')}"
            f"  signed by {str(args.get('governanceParty', ''))[:28]}..."
        )

    # The obligation must be gone: executeImpl exercises Settle, which consumes
    # it. That is what makes the settlement atomic rather than partial.
    if [c for c in live.get("GovernedObligation", []) if c["contractId"] == obl]:
        print(f"    obligation {obl[:32]}... is STILL ACTIVE - settlement was not atomic")
        return 1
    print(f"    obligation {obl[:32]}... consumed (Settle exercised, archived)")

    print()
    if boundary:
        print("PASS: the proposing host was refused, and the operator party settled.")
        print("      No single host could settle this cycle on its own: the ledger")
        print("      required the party's authority, and the receipts are signed by it.")
        return 0
    print("FAIL: the proposing host was not refused.")
    return 1


def active_contracts():
    """Every contract the party can see, keyed by template entity name.

    Read with the validator identity rather than the user session: a user token is
    not entitled to actAs the party's namespace, which is the entire point of the
    party existing.
    """
    query = json.dumps(
        {
            "activeAtOffset": ledger_end(),
            "eventFormat": {
                "filtersByParty": {DP: {"cumulative": [{"identifierFilter": {"WildcardFilter": {"value": {}}}}]}}
            },
        }
    ).encode()
    req = urllib.request.Request(
        f"http://localhost:{LEDGER}/v2/state/active-contracts",
        data=query,
        method="POST",
        headers={
            "Authorization": f"Bearer {os.environ['TPV']}",
            "Content-Type": "application/json",
            "actAs": DP,
            "readAs": DP,
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=300) as response:
            body = json.loads(response.read().decode())
    except urllib.error.HTTPError:
        return []
    out = {}
    for entry in body:
        created_event = (entry.get("contractEntry", {}).get("JsActiveContract") or {}).get("createdEvent")
        if not created_event:
            continue
        entity = str(created_event.get("templateId", "")).split(":")[-1]
        out.setdefault(entity, []).append(created_event)
    return out


def ledger_end():
    req = urllib.request.Request(
        f"http://localhost:{LEDGER}/v2/state/ledger-end",
        headers={"Authorization": f"Bearer {os.environ['TPV']}", "actAs": DP},
    )
    with urllib.request.urlopen(req, timeout=60) as response:
        return json.loads(response.read().decode())["offset"]


if __name__ == "__main__":
    sys.exit(main())