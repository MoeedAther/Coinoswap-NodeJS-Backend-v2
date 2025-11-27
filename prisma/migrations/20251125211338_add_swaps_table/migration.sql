-- CreateTable
CREATE TABLE `swaps` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `transactionId` LONGTEXT NULL,
    `swapPartner` VARCHAR(100) NULL,
    `sellCoin` LONGTEXT NULL,
    `buyCoin` LONGTEXT NULL,
    `sellAmount` VARCHAR(255) NULL,
    `getAmount` VARCHAR(255) NULL,
    `depositExtraId` LONGTEXT NULL,
    `refundExtraid` LONGTEXT NULL,
    `recipientExtraId` LONGTEXT NULL,
    `expiryTime` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
