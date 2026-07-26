from pathlib import Path
import re

root = Path("apps/captain-app/src")

screen = root / "delivery/captain-delivery.screen.tsx"
content = screen.read_text()
marker = """interface CaptainDeliveryScreenProps {
  readonly client: CaptainDeliveryPort;
  readonly presenceClient: CaptainPresencePort;
  readonly locationProvider: CaptainLocationProvider;
}
"""
lifecycle_contract = """
interface EffectLifecycle {
  active: boolean;
}

function createEffectLifecycle(): EffectLifecycle {
  return { active: true };
}
"""
if "interface EffectLifecycle" not in content:
    if marker not in content:
        raise SystemExit("Captain delivery screen contract marker not found")
    content = content.replace(marker, marker + lifecycle_contract)
content = content.replace(
    "const mounted = useRef<boolean>(true);",
    "const mounted = useRef(createEffectLifecycle());",
)
content = content.replace("mounted.current", "mounted.current.active")
content = content.replace(
    "const lifecycle = { stopped: false };",
    "const locationLifecycle = createEffectLifecycle();",
)
content = content.replace("lifecycle.stopped", "!locationLifecycle.active")
content = content.replace(
    "if (!!locationLifecycle.active && mounted.current.active)",
    "if (locationLifecycle.active && mounted.current.active)",
)
content = content.replace(
    "!locationLifecycle.active = true;",
    "locationLifecycle.active = false;",
)
screen.write_text(content)

delivery_test = root / "delivery/captain-delivery.screen.test.tsx"
content = delivery_test.read_text()
for method in [
    "getTask",
    "acceptOffer",
    "rejectOffer",
    "arrivePickup",
    "verifyPickup",
    "departPickup",
    "arriveDrop",
    "complete",
]:
    pattern = re.compile(
        rf"(    {method}: )jest\.fn\((.*?)\) as jest\.MockedFunction<\n?"
        rf"\s*CaptainDeliveryPort\['{method}'\]\n?\s*>,",
        re.S,
    )
    match = pattern.search(content)
    if match is None:
        raise SystemExit(f"Captain delivery mock not found: {method}")
    implementation = match.group(2)
    replacement = (
        f"    {method}: jest.fn<\n"
        f"      ReturnType<CaptainDeliveryPort['{method}']>,\n"
        f"      Parameters<CaptainDeliveryPort['{method}']>\n"
        f"    >({implementation}),"
    )
    content = content[: match.start()] + replacement + content[match.end() :]

pattern = re.compile(
    r"(    watchLocations: )jest\.fn\((.*?)\) as jest\.MockedFunction<\n?"
    r"\s*CaptainLocationProvider\['watchLocations'\]\n?\s*>,",
    re.S,
)
match = pattern.search(content)
if match is None:
    raise SystemExit("Captain location watcher mock not found")
implementation = match.group(2)
replacement = (
    "    watchLocations: jest.fn<\n"
    "      ReturnType<CaptainLocationProvider['watchLocations']>,\n"
    "      Parameters<CaptainLocationProvider['watchLocations']>\n"
    f"    >({implementation}),"
)
content = content[: match.start()] + replacement + content[match.end() :]
delivery_test.write_text(content)

presence_test = root / "presence/resilient-captain-presence.port.test.ts"
content = presence_test.read_text()
for method in ["setAvailability", "updateLocation"]:
    pattern = re.compile(
        rf"(    {method}: )jest\.fn\((.*?)\) as jest\.MockedFunction<\n?"
        rf"\s*CaptainPresencePort\['{method}'\]\n?\s*>,",
        re.S,
    )
    match = pattern.search(content)
    if match is None:
        raise SystemExit(f"Captain presence mock not found: {method}")
    implementation = match.group(2)
    replacement = (
        f"    {method}: jest.fn<\n"
        f"      ReturnType<CaptainPresencePort['{method}']>,\n"
        f"      Parameters<CaptainPresencePort['{method}']>\n"
        f"    >({implementation}),"
    )
    content = content[: match.start()] + replacement + content[match.end() :]
presence_test.write_text(content)
