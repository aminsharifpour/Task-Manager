-- Nullable scopes preserve the extracted legacy database. Scoped writes always supply a scope.
-- Legacy modules are blocked in foundation mode until their backfill and policies are complete.
ALTER TABLE "Task" ADD CONSTRAINT "Task_scoped_project_fk"
  FOREIGN KEY ("organizationId", "projectId") REFERENCES "Project" ("organizationId", "id");
ALTER TABLE "Organization" ADD CONSTRAINT "Organization_positive_limit" CHECK ("activeMemberLimit" > 0);
ALTER TABLE "OrganizationInvitation" ADD CONSTRAINT "OrganizationInvitation_user_fk"
  FOREIGN KEY ("invitedUserId") REFERENCES "User" ("id") ON DELETE RESTRICT;
