-- DropForeignKey
ALTER TABLE "AvailabilitySlot" DROP CONSTRAINT "AvailabilitySlot_empId_fkey";

-- AddForeignKey
ALTER TABLE "AvailabilitySlot" ADD CONSTRAINT "AvailabilitySlot_empId_fkey" FOREIGN KEY ("empId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
