-- Multi-assignee tasks: move Task.assigneeId into the TaskAssignee join table.

CREATE TABLE "TaskAssignee" (
    "taskId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TaskAssignee_pkey" PRIMARY KEY ("taskId", "userId")
);

INSERT INTO "TaskAssignee" ("taskId", "userId")
SELECT "id", "assigneeId" FROM "Task" WHERE "assigneeId" IS NOT NULL;

DROP INDEX IF EXISTS "Task_assigneeId_dueDate_idx";
ALTER TABLE "Task" DROP CONSTRAINT IF EXISTS "Task_assigneeId_fkey";
ALTER TABLE "Task" DROP COLUMN "assigneeId";

CREATE INDEX "TaskAssignee_userId_idx" ON "TaskAssignee"("userId");
CREATE INDEX "Task_projectId_dueDate_idx" ON "Task"("projectId", "dueDate");

ALTER TABLE "TaskAssignee" ADD CONSTRAINT "TaskAssignee_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TaskAssignee" ADD CONSTRAINT "TaskAssignee_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
