-- AlterTable
ALTER TABLE "CandidateProfile" ADD COLUMN     "location" TEXT;

-- CreateTable
CREATE TABLE "Project" (
    "id" SERIAL NOT NULL,
    "candidateProfileId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "techStack" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "link" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_candidateProfileId_fkey" FOREIGN KEY ("candidateProfileId") REFERENCES "CandidateProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
