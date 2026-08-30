-- CreateTable
CREATE TABLE "BookingCancellation" (
    "id" SERIAL NOT NULL,
    "bookingId" INTEGER NOT NULL,
    "empId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BookingCancellation_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "BookingCancellation" ADD CONSTRAINT "BookingCancellation_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "InterviewBooking"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookingCancellation" ADD CONSTRAINT "BookingCancellation_empId_fkey" FOREIGN KEY ("empId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;