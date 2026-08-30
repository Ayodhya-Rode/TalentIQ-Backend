-- CreateEnum
CREATE TYPE "BookingStatus" AS ENUM ('PENDING_PAYMENT', 'ASSIGNED', 'NEEDS_ATTENTION', 'COMPLETED', 'CANCELLED');

-- CreateTable
CREATE TABLE "InterviewBooking" (
    "id" SERIAL NOT NULL,
    "domain" "Domain" NOT NULL,
    "status" "BookingStatus" NOT NULL DEFAULT 'PENDING_PAYMENT',
    "scheduledDate" TIMESTAMP(3) NOT NULL,
    "candidateId" INTEGER NOT NULL,
    "organizationId" INTEGER NOT NULL,
    "assignedEmpId" INTEGER,
    "reassignCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InterviewBooking_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "InterviewBooking" ADD CONSTRAINT "InterviewBooking_candidateId_fkey" FOREIGN KEY ("candidateId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InterviewBooking" ADD CONSTRAINT "InterviewBooking_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InterviewBooking" ADD CONSTRAINT "InterviewBooking_assignedEmpId_fkey" FOREIGN KEY ("assignedEmpId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
