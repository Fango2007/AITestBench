# Quickstart: Target Management Dashboard

## Goal

Manage targets from the dashboard, validate connectivity, and keep run history
safe through archiving.

## Steps

1. Open the dashboard and navigate to Targets.
2. Create a new target with connection details.
3. Confirm the target saves immediately and shows a pending connectivity status.
4. Wait for the connectivity result and available models to appear.
5. Update a target to trigger a new connectivity check and model refresh.
6. Attempt to delete a target with runs and archive it instead.
7. Confirm archived targets appear in a separate section and are hidden from new
   run selection by default, with a toggle to view.
8. Retry a failed connectivity check and confirm the status updates.

## Expected Results

- Targets list shows active and archived sections with latest connectivity
  status.
- Failed checks remain visible with a retry action.
- Duplicate target names are rejected with a clear error message.
