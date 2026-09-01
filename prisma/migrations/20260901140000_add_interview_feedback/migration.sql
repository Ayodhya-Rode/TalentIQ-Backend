CREATE TABLE "InterviewFeedback" (
    "id" SERIAL PRIMARY KEY,
    "bookingId" INTEGER NOT NULL UNIQUE,
    "empId" INTEGER NOT NULL,
    "score" INTEGER NOT NULL,
    "feedback" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "InterviewFeedback_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "InterviewBooking"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);