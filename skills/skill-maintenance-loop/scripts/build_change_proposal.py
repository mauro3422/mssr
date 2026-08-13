#!/usr/bin/env python3
"""Build a deterministic, non-mutating capability-evolution proposal from incident facts."""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import sys
import tempfile
from pathlib import Path
from typing import Any


PROMOTION_GATES = (
    "datasetAudit",
    "replayHoldout",
    "calibration",
    "shadow",
    "featureFlagRollback",
)


def load_json(path: Path) -> dict[str, Any]:
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError as exc:
        raise ValueError(f"Incident input not found: {path}") from exc
    except json.JSONDecodeError as exc:
        raise ValueError(f"Invalid JSON in {path}: {exc}") from exc
    if not isinstance(value, dict):
        raise ValueError("Incident input must be a JSON object")
    return value


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def atomic_write_json(path: Path, payload: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    text = json.dumps(payload, indent=2, ensure_ascii=False) + "\n"
    fd, temp_name = tempfile.mkstemp(prefix=f".{path.name}.", suffix=".tmp", dir=str(path.parent))
    try:
        with os.fdopen(fd, "w", encoding="utf-8", newline="\n") as handle:
            handle.write(text)
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(temp_name, path)
    except Exception:
        try:
            os.unlink(temp_name)
        except FileNotFoundError:
            pass
        raise


def as_bool(value: Any) -> bool:
    return value is True


def as_int(value: Any) -> int:
    try:
        return max(0, int(value))
    except (TypeError, ValueError):
        return 0


def string_list(value: Any) -> list[str]:
    if not isinstance(value, list):
        return []
    result: list[str] = []
    for item in value:
        text = str(item).strip()
        if text and text not in result:
            result.append(text)
    return result


def bounded_entries(value: Any) -> list[Any]:
    """Preserve bounded digest entries without inventing content for absent fields."""
    if not isinstance(value, list):
        return []
    return value[:100]


def evidence_state(value: Any) -> str:
    if value is True:
        return "available"
    if value is False:
        return "unavailable"
    return "unknown"


def optional_decision_review(incident: dict[str, Any]) -> tuple[list[dict[str, Any]], list[str]]:
    entries = incident.get("optionalDecisions")
    if entries is None:
        return [], []
    if not isinstance(entries, list):
        return [], ["optionalDecisions must be a list when supplied"]

    fallback_evidence = incident.get("hostEvidenceAvailable")
    results: list[dict[str, Any]] = []
    blockers: list[str] = []
    for index, raw_entry in enumerate(entries[:100]):
        if not isinstance(raw_entry, dict):
            blockers.append(f"optionalDecisions[{index}] must be an object")
            continue
        evidence_value = raw_entry.get("evidenceAvailable", fallback_evidence)
        availability = evidence_state(evidence_value)
        reason_code = str(raw_entry.get("reasonCode") or "").strip()
        refs = string_list(raw_entry.get("evidenceRefs"))
        result: dict[str, Any] = {
            "id": str(raw_entry.get("id") or f"optional-decision-{index + 1}"),
            "selected": raw_entry.get("selected"),
            "evidenceAvailability": availability,
            "reasonCode": reason_code or None,
            "evidenceRefs": refs,
        }
        if availability == "available":
            if not reason_code:
                result["status"] = "reason-code-required"
                blockers.append(f"optional decision {result['id']} has evidence but no reasonCode")
            elif not refs:
                result["status"] = "evidence-refs-required"
                blockers.append(f"optional decision {result['id']} has evidence but no evidenceRefs")
            else:
                result["status"] = "reviewable"
        elif availability == "unavailable":
            result["status"] = "evidence-unavailable"
        else:
            result["status"] = "evidence-availability-unknown"
        results.append(result)
    return results, blockers


def promotion_gate_review(incident: dict[str, Any]) -> tuple[dict[str, dict[str, Any]], list[str]]:
    supplied = incident.get("promotionGates")
    supplied = supplied if isinstance(supplied, dict) else {}
    results: dict[str, dict[str, Any]] = {}
    blockers: list[str] = []
    for gate_name in PROMOTION_GATES:
        raw_gate = supplied.get(gate_name)
        gate = raw_gate if isinstance(raw_gate, dict) else {}
        declared_status = str(gate.get("status") or "unknown").strip().lower()
        refs = string_list(gate.get("evidenceRefs"))
        passed_with_evidence = declared_status == "passed" and bool(refs)
        if declared_status == "passed" and not refs:
            status = "passed-without-evidence"
        elif declared_status == "passed":
            status = "passed"
        elif declared_status in {"failed", "not-run", "unknown", "insufficient"}:
            status = declared_status
        else:
            status = "unknown"
        results[gate_name] = {
            "status": status,
            "evidenceRefs": refs,
            "passedWithEvidence": passed_with_evidence,
        }
        if not passed_with_evidence:
            blockers.append(f"promotion gate {gate_name} is {status}")
    return results, blockers


def evidence_sufficient(incident: dict[str, Any]) -> bool:
    return (
        as_int(incident.get("occurrences")) >= 2
        or (as_bool(incident.get("highImpact")) and as_bool(incident.get("demonstratedCause")))
        or as_bool(incident.get("repeatedCorrection"))
    )


def new_skill_ready(incident: dict[str, Any]) -> bool:
    return all(
        [
            as_bool(incident.get("reusable")),
            as_bool(incident.get("independentObjective")),
            as_int(incident.get("stableSteps")) >= 3,
            as_bool(incident.get("independentActivation")),
            as_bool(incident.get("independentSuccessMetric")),
            as_bool(incident.get("multipleUseCases")),
            not as_bool(incident.get("ownerCoversObjective")),
        ]
    )


def build_proposal(incident: dict[str, Any], source_path: Path | None = None) -> dict[str, Any]:
    sufficient = evidence_sufficient(incident)
    owner = str(incident.get("existingOwner") or "unresolved").strip() or "unresolved"
    unresolved: list[str] = []
    rationale: list[str] = []
    supporting_actions: list[str] = []
    findings_supplied = "findings" in incident
    friction_supplied = "observedFriction" in incident
    findings = bounded_entries(incident.get("findings"))
    observed_friction = bounded_entries(incident.get("observedFriction"))
    evidence_refs = string_list(incident.get("evidenceRefs"))
    optional_decisions, optional_blockers = optional_decision_review(incident)
    promotion_gates, promotion_blockers = promotion_gate_review(incident)

    required_fields = ["title", "summary", "occurrences", "demonstratedCause", "reusable"]
    for field in required_fields:
        if field not in incident:
            unresolved.append(field)

    explicit_zero_digest = findings_supplied and not findings and not observed_friction
    review_subject_present = bool(findings or observed_friction or not (findings_supplied or friction_supplied))
    if review_subject_present and not evidence_refs:
        unresolved.append("evidenceRefs")
    if explicit_zero_digest and not evidence_refs:
        unresolved.append("digest evidence for findings=0")

    if not sufficient:
        recommendation = "insufficient-evidence"
        rationale.append("The supplied facts do not meet the recurrence or demonstrated high-impact threshold.")
    elif as_bool(incident.get("contextOwnedElsewhere")):
        recommendation = "context-handoff"
        rationale.append("The required state or authority is declared to live in another product or provider.")
    elif as_bool(incident.get("projectSpecific")) and not as_bool(incident.get("reusable")):
        recommendation = "local-documentation"
        rationale.append("The fact is project-specific and is not declared reusable across projects.")
    elif new_skill_ready(incident):
        recommendation = "new-skill-candidate"
        owner = str(incident.get("proposedSkillName") or "new-owner-to-name")
        rationale.append("The gap has an independent reusable objective, activation boundary, success metric and at least three stable steps.")
        rationale.append("No existing owner is declared to cover the objective cleanly.")
    elif owner != "unresolved" and as_bool(incident.get("ownerCoversObjective")):
        if as_bool(incident.get("conditionalProcedure")):
            recommendation = "add-skill-memory-module"
            rationale.append("The existing skill owns the objective, but the rule is conditional or incident-specific.")
        else:
            recommendation = "update-existing-skill"
            rationale.append("The existing skill already owns the objective and should receive the smallest reusable correction.")
    elif as_bool(incident.get("executionSupportNeeded")):
        recommendation = "add-script-tool-or-guide"
        rationale.append("The supplied facts say prose alone cannot reliably enforce the operation or verification gate.")
    elif owner != "unresolved":
        recommendation = "update-existing-skill"
        rationale.append("An existing owner is named and no complete independent-skill case was supplied.")
    else:
        recommendation = "insufficient-evidence"
        unresolved.append("existingOwner or complete independent skill criteria")
        rationale.append("Ownership cannot be resolved safely from the supplied facts.")

    if as_bool(incident.get("executionSupportNeeded")) and recommendation not in {
        "add-script-tool-or-guide",
        "insufficient-evidence",
        "context-handoff",
    }:
        supporting_actions.append("add-script-tool-or-guide")
    if recommendation in {"new-skill-candidate", "update-existing-skill", "add-skill-memory-module"}:
        supporting_actions.extend(["review-routing-metadata", "add-positive-negative-continuation-fixtures"])
    if as_bool(incident.get("requiresIncidentLedger", True)):
        supporting_actions.append("update-owner-incident-ledger")
    supporting_actions.extend(string_list(incident.get("supportingActions")))
    supporting_actions = list(dict.fromkeys(supporting_actions))

    tests = [
        "reproduce-original-failure-or-state-historical-limit",
        "test-nearby-nominal-case",
        "read-back-canonical-source",
        "run-owner-specific-validation",
    ]
    if recommendation in {"new-skill-candidate", "update-existing-skill", "add-skill-memory-module"}:
        tests.extend(["verify-runtime-skill-discovery", "run-real-mssr-route-plan"])
    if recommendation == "new-skill-candidate":
        tests.extend(["install-runtime-junction", "verify-independent-success-metric"])

    source = None
    if source_path is not None:
        source = {
            "file": str(source_path.resolve()),
            "bytes": source_path.stat().st_size,
            "sha256": sha256_file(source_path),
        }

    if explicit_zero_digest and evidence_refs and not optional_blockers:
        learning_decision = "no-learning-change"
        learning_rationale = ["The digest explicitly reports findings=0, no observed friction and durable supporting evidence."]
    elif optional_blockers:
        learning_decision = "insufficient-evidence"
        learning_rationale = ["An optional decision with available evidence lacks a required reasonCode or evidence reference."]
    elif review_subject_present and (not sufficient or not evidence_refs):
        learning_decision = "insufficient-evidence"
        learning_rationale = ["The digest has a finding or observed friction, but its evidence threshold or durable references are incomplete."]
    elif review_subject_present:
        learning_decision = "proposal-ready"
        learning_rationale = ["The supplied digest has a bounded subject, meets the evidence threshold and includes durable references."]
    else:
        learning_decision = "insufficient-evidence"
        learning_rationale = ["The digest has no explicit zero-finding assertion and no reviewable finding or observed friction."]

    gates_passed = not promotion_blockers
    human_review_eligible = learning_decision == "proposal-ready" and gates_passed
    promotion_mode = "human-review-pending" if human_review_eligible else "observe-only"

    return {
        "schemaVersion": 2,
        "title": str(incident.get("title") or "Untitled capability incident"),
        "recommendation": recommendation,
        "primaryOwner": owner,
        "evidenceThreshold": {
            "sufficient": sufficient,
            "occurrences": as_int(incident.get("occurrences")),
            "highImpact": as_bool(incident.get("highImpact")),
            "demonstratedCause": as_bool(incident.get("demonstratedCause")),
            "repeatedCorrection": as_bool(incident.get("repeatedCorrection")),
        },
        "newSkillCriteria": {
            "ready": new_skill_ready(incident),
            "independentObjective": as_bool(incident.get("independentObjective")),
            "stableSteps": as_int(incident.get("stableSteps")),
            "independentActivation": as_bool(incident.get("independentActivation")),
            "independentSuccessMetric": as_bool(incident.get("independentSuccessMetric")),
            "multipleUseCases": as_bool(incident.get("multipleUseCases")),
            "ownerCoversObjective": as_bool(incident.get("ownerCoversObjective")),
        },
        "rationale": rationale,
        "supportingActions": supporting_actions,
        "requiredTests": list(dict.fromkeys(tests)),
        "signals": string_list(incident.get("signals")),
        "evidenceRefs": evidence_refs,
        "unresolvedInputs": list(dict.fromkeys(unresolved)),
        "automaticMutationPerformed": False,
        "automaticPromotionPerformed": False,
        "digest": {
            "findingsSupplied": findings_supplied,
            "findingCount": len(findings),
            "findings": findings,
            "observedFrictionSupplied": friction_supplied,
            "observedFrictionCount": len(observed_friction),
            "observedFriction": observed_friction,
            "evidenceRefs": evidence_refs,
        },
        "learningReview": {
            "decision": learning_decision,
            "rationale": learning_rationale,
            "evidenceRefs": evidence_refs,
            "optionalDecisions": optional_decisions,
            "blockers": optional_blockers,
        },
        "promotionReadiness": {
            "mode": promotion_mode,
            "routingInfluence": False,
            "promotionEligibleForHumanReview": human_review_eligible,
            "automaticPromotionPerformed": False,
            "gates": promotion_gates,
            "blockers": promotion_blockers + optional_blockers,
            "requiredGates": list(PROMOTION_GATES),
        },
        "nextBoundary": "Apply an approved change only in a visible task with catalog inspection, diff, tests, routing verification and Git history.",
        "source": source,
    }


def run_self_test() -> dict[str, Any]:
    cases = [
        (
            "update-owner",
            {
                "title": "Repeated owner defect",
                "summary": "Owner misses a universal gate",
                "occurrences": 2,
                "demonstratedCause": True,
                "reusable": True,
                "existingOwner": "visual-reference-authoring",
                "ownerCoversObjective": True,
                "evidenceRefs": ["incidents/update-owner"],
            },
            "update-existing-skill",
        ),
        (
            "new-skill",
            {
                "title": "Independent validation capability",
                "summary": "Validates references across producers",
                "occurrences": 2,
                "demonstratedCause": True,
                "reusable": True,
                "existingOwner": "visual-reference-authoring",
                "ownerCoversObjective": False,
                "independentObjective": True,
                "stableSteps": 5,
                "independentActivation": True,
                "independentSuccessMetric": True,
                "multipleUseCases": True,
                "proposedSkillName": "visual-reference-integrity",
                "evidenceRefs": ["incidents/new-skill"],
            },
            "new-skill-candidate",
        ),
        (
            "insufficient",
            {
                "title": "One weak observation",
                "summary": "No cause yet",
                "occurrences": 1,
                "demonstratedCause": False,
                "reusable": True,
                "evidenceRefs": ["incidents/insufficient"],
            },
            "insufficient-evidence",
        ),
        (
            "module",
            {
                "title": "Conditional provider recovery",
                "summary": "Only applies to one bounded provider state",
                "occurrences": 2,
                "demonstratedCause": True,
                "reusable": True,
                "existingOwner": "visual-reference-authoring",
                "ownerCoversObjective": True,
                "conditionalProcedure": True,
                "evidenceRefs": ["incidents/module"],
            },
            "add-skill-memory-module",
        ),
    ]
    results = []
    for name, incident, expected in cases:
        proposal = build_proposal(incident)
        passed = proposal["recommendation"] == expected and proposal["automaticMutationPerformed"] is False
        results.append(
            {
                "name": name,
                "passed": passed,
                "expected": expected,
                "actual": proposal["recommendation"],
            }
        )
        if not passed:
            raise AssertionError(f"Self-test {name} failed: {proposal}")

    zero_digest = build_proposal(
        {
            "title": "Supported empty digest",
            "summary": "The completed audit has no findings or friction.",
            "occurrences": 0,
            "demonstratedCause": False,
            "reusable": False,
            "findings": [],
            "observedFriction": [],
            "evidenceRefs": ["audits/empty-digest.json"],
        }
    )
    zero_passed = zero_digest["learningReview"]["decision"] == "no-learning-change"
    results.append({"name": "zero-findings-explicit-decision", "passed": zero_passed, "expected": "no-learning-change", "actual": zero_digest["learningReview"]["decision"]})
    if not zero_passed:
        raise AssertionError(f"Self-test zero-findings-explicit-decision failed: {zero_digest}")

    friction_insufficient = build_proposal(
        {
            "title": "One friction report without supporting evidence",
            "summary": "A manual workaround was reported once.",
            "occurrences": 1,
            "demonstratedCause": False,
            "reusable": True,
            "observedFriction": ["manual workaround"],
        }
    )
    friction_insufficient_passed = friction_insufficient["learningReview"]["decision"] == "insufficient-evidence"
    results.append({"name": "observed-friction-insufficient-evidence", "passed": friction_insufficient_passed, "expected": "insufficient-evidence", "actual": friction_insufficient["learningReview"]["decision"]})
    if not friction_insufficient_passed:
        raise AssertionError(f"Self-test observed-friction-insufficient-evidence failed: {friction_insufficient}")

    optional_missing_reason = build_proposal(
        {
            "title": "Observed friction requires review",
            "summary": "A repeated workaround was observed.",
            "occurrences": 2,
            "demonstratedCause": True,
            "reusable": True,
            "findings": ["manual workaround"],
            "observedFriction": ["manual workaround"],
            "evidenceRefs": ["incidents/workaround"],
            "optionalDecisions": [{"id": "scope", "selected": "owner-update", "evidenceAvailable": True, "evidenceRefs": ["incidents/workaround"]}],
        }
    )
    optional_passed = optional_missing_reason["learningReview"]["decision"] == "insufficient-evidence"
    results.append({"name": "optional-evidence-requires-reason-code", "passed": optional_passed, "expected": "insufficient-evidence", "actual": optional_missing_reason["learningReview"]["decision"]})
    if not optional_passed:
        raise AssertionError(f"Self-test optional-evidence-requires-reason-code failed: {optional_missing_reason}")

    complete_gates = {name: {"status": "passed", "evidenceRefs": [f"evaluations/{name}.json"]} for name in PROMOTION_GATES}
    human_review = build_proposal(
        {
            "title": "Fully evaluated candidate",
            "summary": "A reusable candidate completed every evaluation gate.",
            "occurrences": 2,
            "demonstratedCause": True,
            "reusable": True,
            "findings": ["repeatable gap"],
            "evidenceRefs": ["incidents/evaluated-candidate"],
            "existingOwner": "skill-maintenance-loop",
            "ownerCoversObjective": True,
            "promotionGates": complete_gates,
        }
    )
    human_review_passed = (
        human_review["promotionReadiness"]["promotionEligibleForHumanReview"] is True
        and human_review["promotionReadiness"]["routingInfluence"] is False
        and human_review["automaticPromotionPerformed"] is False
    )
    results.append({"name": "complete-gates-remain-human-review", "passed": human_review_passed, "expected": "human-review-pending-without-promotion", "actual": human_review["promotionReadiness"]["mode"]})
    if not human_review_passed:
        raise AssertionError(f"Self-test complete-gates-remain-human-review failed: {human_review}")
    return {"ok": all(item["passed"] for item in results), "count": len(results), "tests": results}


def parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--incident", help="JSON incident facts")
    parser.add_argument("--output", help="Output proposal JSON")
    parser.add_argument("--self-test", action="store_true", help="Run dependency-free regression tests")
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    try:
        args = parse_args(argv or sys.argv[1:])
        if args.self_test:
            result = run_self_test()
            print(json.dumps(result, indent=2, ensure_ascii=False))
            return 0 if result["ok"] else 2
        if not args.incident or not args.output:
            raise ValueError("--incident and --output are required unless --self-test is used")
        source_path = Path(args.incident).resolve()
        incident = load_json(source_path)
        proposal = build_proposal(incident, source_path)
        output_path = Path(args.output).resolve()
        atomic_write_json(output_path, proposal)
        print(
            json.dumps(
                {
                    "ok": True,
                    "output": str(output_path),
                    "recommendation": proposal["recommendation"],
                    "primaryOwner": proposal["primaryOwner"],
                    "automaticMutationPerformed": False,
                },
                ensure_ascii=False,
            )
        )
        return 0
    except (OSError, ValueError, AssertionError) as exc:
        print(json.dumps({"ok": False, "error": str(exc)}, ensure_ascii=False), file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
