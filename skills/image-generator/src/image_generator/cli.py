"""Local plan, explicit read-only discovery, and opt-in paid inference."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import httpx

from .backends import GenerationError, ImageAPI, token_provider
from .config import ChoiceRequired, load
from .discovery import discover, reasons, select
from .runner import compiler_candidate, offline_plan, run


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("brief", type=Path)
    parser.add_argument(
        "--output-dir",
        type=Path,
        help="Override output; relative to the caller's directory.",
    )
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument(
        "--discover",
        action="store_true",
        help="Read Azure resources, deployments and model catalog.",
    )
    mode.add_argument(
        "--generate",
        action="store_true",
        help="Opt in to paid inference after preflight.",
    )
    parser.add_argument(
        "--approve-inference",
        action="store_true",
        help="Confirm the user approved model, count, references, retry ceiling and live costs.",
    )
    args = parser.parse_args(argv)
    try:
        brief = load(args.brief)
        if args.output_dir:
            brief["output_dir"] = str(args.output_dir.resolve())
        if not args.discover and not args.generate:
            print(json.dumps(offline_plan(brief), indent=2))
            return 0
        if args.generate and not args.approve_inference:
            raise ChoiceRequired(
                "--generate needs --approve-inference after concrete user approval; "
                "no inference or automatic deployment has occurred."
            )
        report = discover(brief)
        if args.discover:
            print(
                json.dumps(
                    {
                        **report,
                        "candidates": [
                            {
                                **item.describe(),
                                "unsuitable_reasons": reasons(item, brief),
                            }
                            for item in report["candidates"]
                        ],
                    },
                    indent=2,
                )
            )
            return 0
        candidate = select(report, brief)
        compiler = compiler_candidate(report, brief, candidate)
        print(
            json.dumps(
                {
                    "selected_model": candidate.describe(),
                    "planned_calls": offline_plan(brief)["planned_calls"],
                },
                indent=2,
            )
        )
        credential, token = token_provider(
            brief["azure"],
            subscription=report["subscription"],
            tenant_id=report.get("tenant_id"),
        )
        try:
            with httpx.Client(follow_redirects=False) as client:
                result = run(
                    brief,
                    candidate,
                    ImageAPI(client, token, attempts=brief["max_attempts"]),
                    compiler=compiler,
                )
        finally:
            credential.close()
        print(json.dumps(result, indent=2))
        return 1 if result["failed"] else 0
    except (ChoiceRequired, GenerationError, OSError, ValueError) as exc:
        print(f"image-generator: {exc}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
