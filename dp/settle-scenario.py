#!/usr/bin/env python3
"""Ledger scenario for dp/settle-as-decentralized-party.sh.

Reads its configuration from the environment - the shell wrapper handles auth,
party discovery and package upload - and drives one settlement end to end:

  1. one host creates the obligation, the approval and the settlement proposal;
  2. that host is refused when it tries to execute the settlement;
  3. the settlement executes as the decentralized party and issues receipts.

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
DP = os.environ["DP"]
LEDGER = os.environ["LEDGER"]
TOKEN = os.environ["TP"]
PROV = os.environ["PROV_PARTY"]
SUB = os.environ["SUB_PARTY"]
TERMS = os.environ["TERMS_HASH"]
SID = os.environ["SETTLEMENT_ID"]
# Canton resolves the signing key from (userId, actAs). The userId must be the
# identity the participant knows us by, not an arbitrary string.
USER_ID = os.environ.get("CANTON_USER_ID", "app-provider-validator")

MOD = "NetSettle.Governed"
URL = f"http://localhost:{LEDGER}/v2/commands/submit-and-wait-for-transaction"


def submit(act_as, command):
    """Submit one command and return the parsed response (or the error body)."""
    body = json.dumps(
        {
            "commands": {
                "actAs": act_as,
                "userId": USER_ID,
                "commandId": f"dp-{random.randint(1 << 30, 1 << 40)}",
                "commands": [command],
            }
        }
    ).encode()
    req = urllib.request.Request(
        URL,
        data=body,
        method="POST",
        headers={"Authorization": f"Bearer {TOKEN}", "Content-Type": "application/json"},
    )
    try:
        with urllib.request.urlopen(req, timeout=300) as response:
            return json.loads(response.read().decode())
    except urllib.error.HTTPError as err:
        return {"httpStatus": err.code, "error": err.read().decode()[:400]}


def tpl(entity):
    # The JSON API takes the template id as a single "pkg:Module:Entity" string.
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
        # 403 "security-sensitive error" means the participant refused to sign,
        # which is an environment limitation rather than a contract error.
        if tx.get("httpStatus") == 403 or "security-sensitive" in blob:
            print("    BLOCKED: the participant refused to sign this write.")
            print("    See the note in dp/settle-as-decentralized-party.sh for why,")
            print("    and for what is and is not proven without this scenario.")
            sys.exit(3)
        print(f"    create {entity} failed: {blob[:400]}")
        sys.exit(1)
    return ids[0]


def execute(act_as, cid):
    return submit(
        act_as,
        {
            "ExerciseCommand": {
                "templateId": tpl("GovernedSettlement"),
                "contractId": cid,
                "choice": "GovernableAction_Execute",
                "choiceArgument": {},
            }
        },
    )


def refused(tx):
    """True when Canton rejected the update instead of executing it."""
    if created(tx, "SettlementReceipt") or created(tx, "SettlementReceiptCreateEvent"):
        return False
    blob = json.dumps(tx).lower()
    return any(
        word in blob
        for word in (
            "cannot",
            "not authorized",
            "not authorised",
            "signature",
            "signer",
            "error",
            "code",
            "failed",
        )
    )


def main():
    print("==> host A creates the obligation, the approval, and proposes the settlement")
    obl = create(
        [PROV, SUB],
        "GovernedObligation",
        {
            "operator": PROV,
            "debtor": SUB,
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
            "residuals": [{"_1": PROV, "_2": SUB, "_3": "100000"}],
            "currency": "EUR",
            "valueDate": "2026-10-31T00:00:00Z",
            "requiredApprovers": [PROV],
            "expiresAt": "2026-12-31T00:00:00Z",
            "termsHash": TERMS,
        },
    )
    print(f"    settlement   {settle[:20]}...  proposed by one host, executable by neither")

    print("\n==> host A tries to execute the settlement it just proposed")
    tx = execute([PROV], settle)
    if refused(tx):
        print("    -> REFUSED by Canton. GovernableAction_Execute is controlled by the")
        print("       operator party, so the proposing host has no authority here.")
        boundary = True
    else:
        print("    *** EXECUTED BY THE PROPOSING HOST - the boundary does not hold ***")
        print("       " + json.dumps(tx)[:300])
        boundary = False

    print("\n==> the settlement executes as the decentralized party")
    tx = execute([DP], settle)
    receipts = created(tx, "SettlementReceipt")
    if not receipts:
        print("    no receipt: " + json.dumps(tx)[:400])
        sys.exit(1)
    for receipt in receipts:
        print(f"    receipt      {receipt[:32]}...")

    print()
    if boundary:
        print("PASS: the proposing host was refused; the operator party settled.")
        print("      A single host can propose a settlement but cannot execute one.")
        return 0
    print("FAIL: the proposing host executed a settlement it had no authority to settle.")
    return 1


if __name__ == "__main__":
    sys.exit(main())