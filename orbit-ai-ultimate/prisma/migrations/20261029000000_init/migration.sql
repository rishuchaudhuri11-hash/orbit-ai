CREATE TABLE "User" (
  "id" TEXT NOT NULL, "email" TEXT NOT NULL, "name" TEXT NOT NULL, "passwordHash" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE TABLE "UserSettings" (
  "id" TEXT NOT NULL, "userId" TEXT NOT NULL, "theme" TEXT NOT NULL DEFAULT 'light', "language" TEXT NOT NULL DEFAULT 'auto',
  "defaultMode" TEXT NOT NULL DEFAULT 'compare', "compareEnabled" BOOLEAN NOT NULL DEFAULT true, "webSearch" BOOLEAN NOT NULL DEFAULT false,
  "systemPrompt" TEXT NOT NULL DEFAULT '', "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "UserSettings_pkey" PRIMARY KEY ("id"), CONSTRAINT "UserSettings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "UserSettings_userId_key" ON "UserSettings"("userId");
CREATE TABLE "Session" (
  "id" TEXT NOT NULL, "tokenHash" TEXT NOT NULL, "userId" TEXT NOT NULL, "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Session_pkey" PRIMARY KEY ("id"), CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "Session_tokenHash_key" ON "Session"("tokenHash"); CREATE INDEX "Session_userId_idx" ON "Session"("userId"); CREATE INDEX "Session_expiresAt_idx" ON "Session"("expiresAt");
CREATE TABLE "Project" (
  "id" TEXT NOT NULL, "userId" TEXT NOT NULL, "name" TEXT NOT NULL, "instructions" TEXT NOT NULL DEFAULT '', "color" TEXT NOT NULL DEFAULT '#6c63ff',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Project_pkey" PRIMARY KEY ("id"), CONSTRAINT "Project_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "Project_userId_updatedAt_idx" ON "Project"("userId", "updatedAt");
CREATE TABLE "Chat" (
  "id" TEXT NOT NULL, "userId" TEXT NOT NULL, "projectId" TEXT, "title" TEXT NOT NULL DEFAULT 'New conversation', "archived" BOOLEAN NOT NULL DEFAULT false,
  "pinned" BOOLEAN NOT NULL DEFAULT false, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Chat_pkey" PRIMARY KEY ("id"), CONSTRAINT "Chat_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "Chat_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX "Chat_userId_updatedAt_idx" ON "Chat"("userId", "updatedAt"); CREATE INDEX "Chat_projectId_idx" ON "Chat"("projectId");
CREATE TABLE "Message" (
  "id" TEXT NOT NULL, "chatId" TEXT NOT NULL, "role" TEXT NOT NULL, "content" TEXT NOT NULL, "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Message_pkey" PRIMARY KEY ("id"), CONSTRAINT "Message_chatId_fkey" FOREIGN KEY ("chatId") REFERENCES "Chat"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "Message_chatId_createdAt_idx" ON "Message"("chatId", "createdAt");
CREATE TABLE "Document" (
  "id" TEXT NOT NULL, "userId" TEXT NOT NULL, "projectId" TEXT, "name" TEXT NOT NULL, "mimeType" TEXT NOT NULL, "sizeBytes" INTEGER NOT NULL,
  "textContent" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Document_pkey" PRIMARY KEY ("id"), CONSTRAINT "Document_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "Document_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX "Document_userId_createdAt_idx" ON "Document"("userId", "createdAt"); CREATE INDEX "Document_projectId_idx" ON "Document"("projectId");
CREATE TABLE "Feedback" (
  "id" TEXT NOT NULL, "userId" TEXT NOT NULL, "chatId" TEXT, "messageId" TEXT, "rating" INTEGER NOT NULL, "note" TEXT NOT NULL DEFAULT '',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Feedback_pkey" PRIMARY KEY ("id"), CONSTRAINT "Feedback_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "Feedback_userId_createdAt_idx" ON "Feedback"("userId", "createdAt");
CREATE TABLE "UsageLog" (
  "id" TEXT NOT NULL, "userId" TEXT NOT NULL, "provider" TEXT NOT NULL, "model" TEXT NOT NULL, "inputChars" INTEGER NOT NULL DEFAULT 0,
  "outputChars" INTEGER NOT NULL DEFAULT 0, "latencyMs" INTEGER NOT NULL DEFAULT 0, "success" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "UsageLog_pkey" PRIMARY KEY ("id"), CONSTRAINT "UsageLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "UsageLog_userId_createdAt_idx" ON "UsageLog"("userId", "createdAt");
