# E2E Smoke Flows

These Maestro flows protect the coach workflows most likely to fail in real use. They are intentionally not wired into CI yet; run them locally against a development build until they pass consistently twice.

## Prerequisites

- Install Maestro locally.
- Start a development build for `com.bspowercats.coach`.
- Use a Firebase dev project or emulator-backed fixture data.
- Set environment variables:
  - `BSPC_E2E_EMAIL`
  - `BSPC_E2E_PASSWORD`
  - `BSPC_E2E_SWIMMER`

## Run

```bash
maestro test e2e/maestro
```
