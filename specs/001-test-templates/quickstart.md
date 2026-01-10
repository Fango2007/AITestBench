# Quickstart: Test Templates

## Create a Template
1. Open the dashboard and navigate to Test Templates.
2. Select the template format (JSON or Python).
3. Enter a unique template name (unique among active templates).
4. Paste template content and save.
5. Confirm the template appears with version v1.
6. Ensure the template file is created under the directory set in
   `AITESTBENCH_TEST_TEMPLATE_DIR` (defaults to app root).

## Update a Template (New Version)
1. Open the template details.
2. Edit the content and save.
3. Confirm the version increments (v2, v3, ...).

## Archive and Unarchive
1. From the templates list, choose Archive to remove a template from active use.
2. Archived templates are not available for instantiation.
3. Use Unarchive to restore a template to the active list.

## Instantiate a Test from a Template Version
1. Choose a template and a specific version.
2. Instantiate the test.
3. Confirm the instantiated test displays the template name and version used.

## Delete a Template
1. If a template has no instantiated tests referencing it, delete it.
2. If it is referenced, deletion is blocked with an actionable message.
