#!/usr/bin/env python3
"""Build data.js from data/usvex_2025.csv.

USVEX 2025 is a single-wave national survey, so (unlike the CalVEX build
script this is adapted from) there is no Supabase fetch and no multi-year
pagination — this just reads the one CSV. Re-run whenever the source CSV
changes:

    python3 build_data.py
"""
import csv
import json
import pathlib

HERE = pathlib.Path(__file__).parent
SRC = HERE / "data" / "usvex_2025.csv"
OUT = HERE / "data.js"

# Binary (0/1) outcome + subcategory columns. Source values are "Yes"/"No"
# strings; anything else (blank, "SKIPPED ON WEB", "DON'T KNOW", "REFUSED",
# stray numeric skip codes) becomes null.
BINARY_COLUMNS = [
    "pv_ever", "pv_12mo", "pv_perp_ever", "pv_perp_12mo",
    "pastyearpv1", "pastyearpv2", "pastyearpv3",
    "pastyearperppv1", "pastyearperppv2", "pastyearperppv3",
    "sv_ever", "sv_12mo", "sv_perp_12mo",
    "pastyearsv1", "pastyearsv2", "pastyearsv3",
    "pastyearsv4", "pastyearsv5", "pastyearsv6",
    "pastyearperpsv1", "pastyearperpsv2", "pastyearperpsv3",
    "pastyearperpsv4", "pastyearperpsv5", "pastyearperpsv6",
    "IPV25_EVER", "IPV25_YEAR",
    "IPV_E_12mo", "IPV_C_12mo", "IPV_T_12mo",
    "IPV_P_12mo", "IPV_L_12mo", "IPV_S_12mo", "IPV_R_12mo",
]

# Demographic columns: already plain display-label strings in this dataset
# (unlike CalVEX's numeric-coded columns), so no label lookup table is
# needed — the value itself is the label. Blank -> null.
DEMOGRAPHIC_COLUMNS = [
    "GENDER_NEW", "LGB_3", "AGE_6", "RACE_5",
    "EDUC_4", "INCOME_QUINTILE", "EMPLOY_2", "REGION4",
    "METRO", "MARITAL", "HOUSING",
]

DISABILITY_RELABEL = {"No": "No Disability", "Yes": "Has Disability"}

# IDEO uses "Unknown" as its missing-data sentinel (source code -1) rather
# than a blank string like every other demographic column, so it needs its
# own exclusion list on top of the generic norm_demo blank-check.
IDEO_EXCLUDE = {"Unknown"}


def norm_binary(v):
    v = (v or "").strip()
    if v == "Yes":
        return 1
    if v == "No":
        return 0
    return None


def norm_demo(v, exclude=()):
    v = (v or "").strip()
    if not v or v in exclude:
        return None
    return v


def norm_weight(v):
    return float(v)


def main():
    with SRC.open(newline="", encoding="utf-8-sig") as f:
        rows = list(csv.DictReader(f))

    data = {"WEIGHT": [norm_weight(r["WEIGHT_OVERALL"]) for r in rows]}
    for c in BINARY_COLUMNS:
        data[c] = [norm_binary(r[c]) for r in rows]
    for c in DEMOGRAPHIC_COLUMNS:
        data[c] = [norm_demo(r[c]) for r in rows]
    data["DISABILITY"] = [
        DISABILITY_RELABEL.get(norm_demo(r["disability"]), None) if norm_demo(r["disability"]) else None
        for r in rows
    ]
    data["IDEO"] = [norm_demo(r["IDEO"], exclude=IDEO_EXCLUDE) for r in rows]

    out = "window.USVEX_DATA = " + json.dumps(data, separators=(",", ":")) + ";\n"
    OUT.write_text(out)
    print(f"wrote {OUT.name}: {len(rows)} rows, {len(data)} columns, {OUT.stat().st_size // 1024} KB")


if __name__ == "__main__":
    main()
