-- CreateTable
CREATE TABLE "RealtimeEvent" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "entityId" TEXT,
    "actorUserId" TEXT,
    "recipientUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RealtimeEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RealtimeReceipt" (
    "instanceId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,

    CONSTRAINT "RealtimeReceipt_pkey" PRIMARY KEY ("instanceId","eventId")
);

-- CreateIndex
CREATE INDEX "RealtimeEvent_organizationId_createdAt_idx" ON "RealtimeEvent"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "RealtimeEvent_expiresAt_idx" ON "RealtimeEvent"("expiresAt");

-- AddForeignKey
ALTER TABLE "RealtimeReceipt" ADD CONSTRAINT "RealtimeReceipt_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "RealtimeEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Transactional invalidations contain identifiers only; each recipient is authorized again at delivery.
CREATE FUNCTION workspace_audit_event() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 INSERT INTO "RealtimeEvent" (id,"organizationId",kind,"entityId","actorUserId","createdAt","expiresAt")
 VALUES (NEW.id,NEW."organizationId",NEW.action,NEW."entityId",NEW."actorUserId",NOW(),NOW()+INTERVAL '2 days');
 RETURN NEW;
END $$;
CREATE TRIGGER workspace_audit_event AFTER INSERT ON "OrganizationAudit" FOR EACH ROW EXECUTE FUNCTION workspace_audit_event();
CREATE FUNCTION workspace_notification_event() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 INSERT INTO "RealtimeEvent" (id,"organizationId",kind,"entityId","recipientUserId","createdAt","expiresAt")
 VALUES ('notification:'||NEW.id||':'||gen_random_uuid()::text,NEW."organizationId",CASE WHEN TG_OP='INSERT' THEN 'notification.created' ELSE 'notification.changed' END,NEW.id,NEW."userId",NOW(),NOW()+INTERVAL '2 days');
 RETURN NEW;
END $$;
CREATE TRIGGER workspace_notification_event AFTER INSERT OR UPDATE ON "Notification" FOR EACH ROW EXECUTE FUNCTION workspace_notification_event();
