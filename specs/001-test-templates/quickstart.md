# Quickstart: Test Templates Management

## Configure

1. Set `AITESTBENCH_TEST_TEMPLATES_DIR` in the root `.env` file.
2. Ensure the directory exists or let the system fall back to `./backend/data/templates`.

## Run

1. Start the backend and frontend (`npm run dev` from the repo root).
2. Open the dashboard.

## Use

1. Open the Templates view and create a JSON or Python template.
2. Fix any validation warnings until the template saves successfully.
3. Go to Run Single, select a target and model.
4. Select template(s) and click Generate Active Tests to create active tests.
5. Review the runnable command preview for JSON templates or the sandbox-ready indicator for Python templates.
6. Click Run to execute the active tests.
