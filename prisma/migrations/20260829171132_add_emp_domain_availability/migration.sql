-- CreateEnum
CREATE TYPE "Domain" AS ENUM ('FULL_STACK', 'DATA_SCIENCE', 'DEVOPS', 'JAVA_DEVELOPER', 'AI_ENGINEER', 'FRONTEND', 'BACKEND');

-- CreateEnum
CREATE TYPE "DayOfWeek" AS ENUM ('MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "domains" "Domain"[] DEFAULT ARRAY[]::"Domain"[];

-- CreateTable
CREATE TABLE "AvailabilitySlot" (
    "id" SERIAL NOT NULL,
    "dayOfWeek" "DayOfWeek" NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "empId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AvailabilitySlot_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "AvailabilitySlot" ADD CONSTRAINT "AvailabilitySlot_empId_fkey" FOREIGN KEY ("empId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
