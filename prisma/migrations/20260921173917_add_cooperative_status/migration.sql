-- AlterTable
ALTER TABLE `cooperative` ADD COLUMN `status` VARCHAR(191) NOT NULL DEFAULT 'ACTIVE';

-- CreateIndex
CREATE INDEX `Cooperative_status_idx` ON `Cooperative`(`status`);
