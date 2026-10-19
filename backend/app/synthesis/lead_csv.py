"""Deterministic lead qualification for user-provided CSV files."""
from __future__ import annotations

import csv
import io
import re
from typing import Any, Dict, List


MAX_CSV_BYTES = 2_000_000
MAX_LEADS = 10_000
BUSINESS_EMAIL_DOMAINS = {"gmail.com", "yahoo.com", "hotmail.com", "outlook.com", "icloud.com"}
SENIORITY_TERMS = (
    "chief", "ceo", "cto", "cfo", "coo", "founder", "owner", "president", "vice president",
    " vp", "director", "head of", "partner",
)
HIGH_INTENT_TERMS = ("referral", "webinar", "conference", "demo", "pricing", "contact sales")


def process_lead_csv(csv_text: str, sales_reps: List[str]) -> Dict[str, Any]:
    csv_text = csv_text.lstrip("\ufeff")
    if not csv_text.strip():
        raise ValueError("The CSV file is empty.")
    if len(csv_text.encode("utf-8")) > MAX_CSV_BYTES:
        raise ValueError("CSV files must be 2 MB or smaller.")

    try:
        reader = csv.DictReader(io.StringIO(csv_text, newline=""), strict=True)
        headers = [header.strip().lower() if header else "" for header in (reader.fieldnames or [])]
        if not headers or not {"name", "email"}.issubset(headers):
            raise ValueError("CSV must include name and email columns.")
        if len(set(headers)) != len(headers) or "" in headers:
            raise ValueError("CSV headers must be non-empty and unique.")

        records: List[Dict[str, Any]] = []
        for row_number, raw_row in enumerate(reader, start=2):
            if row_number > MAX_LEADS + 1:
                raise ValueError(f"CSV files can contain at most {MAX_LEADS} leads.")
            if None in raw_row:
                raise ValueError(f"Row {row_number} has more values than the header.")
            row = {
                header: (raw_row.get(original) or "").strip()
                for header, original in zip(headers, reader.fieldnames or [])
            }
            records.append(_qualify_lead(row, row_number, sales_reps))
    except csv.Error as exc:
        raise ValueError(f"Could not parse CSV: {exc}") from exc

    if not records:
        raise ValueError("The CSV has headers but no lead rows.")
    return {"records": records, "total": len(records)}


def process_single_lead(name: str, contact: str, email: str) -> Dict[str, Any]:
    return _qualify_lead(
        {"name": name.strip(), "contact": contact.strip(), "email": email.strip()},
        row_number=2,
        sales_reps=[],
    )


def _qualify_lead(row: Dict[str, str], row_number: int, sales_reps: List[str]) -> Dict[str, Any]:
    name = row.get("name", "")
    email = row.get("email", "")
    title = row.get("title", "").lower()
    source = row.get("source", "").lower()
    company = row.get("company", "")

    score = 0
    if any(term in title for term in SENIORITY_TERMS):
        score += 35
    if company:
        score += 20
    email_match = re.fullmatch(r"[^\s@]+@[^\s@]+\.[^\s@]+", email)
    if email_match:
        score += 20
        domain = email.rsplit("@", 1)[-1].lower()
        if domain not in BUSINESS_EMAIL_DOMAINS:
            score += 10
    if row.get("contact", "").strip():
        score += 10
    if any(term in source for term in HIGH_INTENT_TERMS):
        score += 15
    score = min(score, 100)

    errors = []
    if not name:
        errors.append("missing name")
    if not email_match:
        errors.append("invalid or missing email")

    if errors:
        priority = "review"
    elif score >= 70:
        priority = "high"
    elif score >= 40:
        priority = "medium"
    else:
        priority = "low"

    cleaned_reps = [rep.strip() for rep in sales_reps if rep.strip()]
    assigned_to = cleaned_reps[(row_number - 2) % len(cleaned_reps)] if cleaned_reps else "Unassigned"
    return {
        **row,
        "lead_score": score,
        "priority": priority,
        "assigned_to": assigned_to,
        "validation_errors": "; ".join(errors),
    }