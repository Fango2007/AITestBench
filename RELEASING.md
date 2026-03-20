# Releasing

This repository ships `0.1.x` as a source release for local desktop deployment.
It does not currently publish standalone installers or a compiled backend bundle.

## Release checklist

1. Update `CHANGELOG.md`.
2. Run `npm ci`.
3. Run `npm run release:check`.
4. Commit the release changes.
5. Create and push the tag:

```bash
git tag v0.1.0
git push origin main --follow-tags
```

6. Open the GitHub release created by Actions and verify:
   - release notes are present
   - attached source archives are present
   - README desktop deployment steps are accurate

## Desktop deployment from the release

Users should:

1. Download the release source archive from GitHub.
2. Install Node.js 20+ and Python 3.10+.
3. Copy `.env.example` to `.env` and set the token.
4. Run:

```bash
npm ci
npm run build
npm start
```

The backend listens on `http://localhost:8080` and the frontend on `http://localhost:5173` by default.
