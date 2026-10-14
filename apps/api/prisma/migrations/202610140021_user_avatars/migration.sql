CREATE TABLE "UserAvatar" (
 "userId" TEXT NOT NULL,
 "bytes" BYTEA NOT NULL,
 "updatedAt" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "UserAvatar_pkey" PRIMARY KEY ("userId"),
 CONSTRAINT "UserAvatar_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
