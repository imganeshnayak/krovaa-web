Community feature scaffold

Prisma models added:
- Community
- CommunityMember
- Project
- ProjectMessage
- ProjectFile
- JobAnalytics

Backend routes added:
- `POST /api/communities/` - create community
- `GET /api/communities/` - list communities (public + joined)
- `GET /api/communities/:id` - get community details
- `POST /api/communities/:id/join` - join public community
- `POST /api/communities/:id/leave` - leave community
- `POST /api/communities/:id/projects` - create project in community

Next steps:
1. Run Prisma migrate to generate DB migration:

```bash
cd backend
npx prisma migrate dev --name add_communities_projects
```

2. Implement frontend pages and integrate socket channels for realtime messaging.
3. Add analytics endpoints and dashboards.
