# Dashboard + Project Backlog + API Integration - Progress

## Problems Found
1. Dashboard has 5 static mock projects instead of loading from backend
2. No Create Project API call capability
3. CreateSprintModal emits projectId=0 (comment says "Will be set by parent" but it's uncleaned)
4. ProjectService missing getProjects() and createProject() methods

## Steps
- [ ] 1. Add `getProjects()` and `createProject()` to ProjectService
- [ ] 2. Rewrite Dashboard to load projects from backend with signal-based state
- [ ] 3. Create CreateProjectModalComponent
- [ ] 4. Add + New Project button to Dashboard
- [ ] 5. Connect modal to POST /api/Projects with auto-refresh
- [ ] 6. Fix CreateSprintModal to properly handle projectId (clean up the 0 issue)
- [ ] 7. Verify projectId propagation end-to-end
- [ ] 8. Build verification

