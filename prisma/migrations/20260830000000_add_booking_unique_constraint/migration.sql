-- CreateIndex
CREATE UNIQUE INDEX "InterviewBooking_assignedEmpId_scheduledDate_key" ON "InterviewBooking"("assignedEmpId", "scheduledDate");