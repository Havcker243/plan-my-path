"""Run a synthetic Gemini planning session, without accessing student records."""
import argparse
import json
from pathlib import Path

from app.advisor import DEFAULT_MODEL, _get_client, _get_env_value, stream_advisor_reply
from research.fixtures import fixture_tools


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", default="../logs/agent-live-demo.json")
    parser.add_argument("--list-models", action="store_true", help="List Gemini models available to the configured key.")
    parser.add_argument("--probe-generation", action="store_true", help="Run one plain Gemini generation without tools.")
    args = parser.parse_args()
    configured = _get_env_value("GEMINI_MODEL", DEFAULT_MODEL)
    if args.list_models:
        available = sorted(
            model.name.removeprefix("models/")
            for model in _get_client().models.list()
            if model.name and "gemini" in model.name.lower()
        )
        print(f"Configured model: {configured}")
        print(f"Configured model available: {configured in available}")
        print("Available Gemini models:")
        print("\n".join(available))
        return
    if args.probe_generation:
        response = _get_client().models.generate_content(
            model=configured,
            contents="Reply with exactly: GEMINI_OK",
        )
        print(f"Configured model: {configured}")
        print(f"Response: {(response.text or '').strip()}")
        return
    tools = fixture_tools()
    events = []
    completed = False
    try:
        for event in stream_advisor_reply(
            "Using my synthetic CSCI data, propose the remaining required courses for Fall 2026 and Spring 2027. Use propose_plan to check prerequisite order. This is a nine-credit test degree, not a real Fisk degree.", tools):
            events.append(event)
            if event.get("agent_status"):
                print(event["agent_status"], flush=True)
            if event.get("chunk"):
                print(event["chunk"], flush=True)
        completed = True
    except Exception as exc:
        # Do not dump provider exception text, which may contain request details.
        error = {
            "error_type": type(exc).__name__,
            "provider_code": getattr(exc, "code", None),
            "provider_status": getattr(exc, "status", None),
        }
        print(
            f"Live Gemini run failed ({error['error_type']}, "
            f"code={error['provider_code']}, status={error['provider_status']}); "
            "see sanitized trace.",
            flush=True,
        )
        events.append(error)
    output = Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)
    success = bool(completed and tools.proposal and tools.validation and tools.validation.get("valid"))
    output.write_text(json.dumps({
        "synthetic": True,
        "agent_in_loop": True,
        "model": configured,
        "success": success,
        "events": events,
        "trace": tools.state.trace(),
    }, indent=2), encoding="utf-8")
    print(f"Trace: {output.resolve()}")
    if not success:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
