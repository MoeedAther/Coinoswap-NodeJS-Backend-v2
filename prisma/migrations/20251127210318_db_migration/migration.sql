-- CreateTable
CREATE TABLE `sessions` (
    `session_id` VARCHAR(128) NOT NULL,
    `expiration_time` INTEGER UNSIGNED NOT NULL,
    `data` MEDIUMTEXT NULL,

    PRIMARY KEY (`session_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `buy_crypto` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `standardTicker` VARCHAR(255) NULL,
    `ticker` VARCHAR(50) NOT NULL,
    `name` VARCHAR(100) NOT NULL,
    `network` VARCHAR(50) NULL,
    `image` LONGTEXT NULL,
    `buyPartner` VARCHAR(255) NULL,
    `mappedPartners` LONGTEXT NULL,
    `data` LONGTEXT NULL,
    `isFiat` BOOLEAN NOT NULL DEFAULT false,
    `isApproved` BOOLEAN NOT NULL DEFAULT true,
    `isStandard` BOOLEAN NULL DEFAULT false,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `swap_crypto` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `standardTicker` VARCHAR(50) NOT NULL,
    `ticker` VARCHAR(100) NOT NULL,
    `name` VARCHAR(100) NOT NULL,
    `network` VARCHAR(50) NULL,
    `shortName` VARCHAR(100) NULL,
    `image` LONGTEXT NULL,
    `swapPartner` VARCHAR(255) NULL,
    `mappedPartners` LONGTEXT NULL,
    `data` LONGTEXT NULL,
    `coinType` VARCHAR(50) NOT NULL DEFAULT 'other',
    `requiresExtraId` BOOLEAN NOT NULL DEFAULT false,
    `isApproved` BOOLEAN NOT NULL DEFAULT true,
    `isStandard` BOOLEAN NULL DEFAULT false,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `admin` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `email` VARCHAR(255) NOT NULL,
    `password` VARCHAR(255) NOT NULL,
    `name` VARCHAR(255) NOT NULL,
    `twoFactorSecret` VARCHAR(255) NULL,
    `twoFactorEnabled` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `admin_email_key`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `settings` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `key` VARCHAR(191) NOT NULL,
    `value` LONGTEXT NULL,
    `type` VARCHAR(50) NOT NULL DEFAULT 'string',
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `settings_key_key`(`key`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `swaps` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `transactionId` LONGTEXT NULL,
    `swapPartner` VARCHAR(100) NULL,
    `sellCoin` LONGTEXT NULL,
    `buyCoin` LONGTEXT NULL,
    `sellAmount` VARCHAR(255) NULL,
    `getAmount` VARCHAR(255) NULL,
    `status` VARCHAR(50) NULL,
    `depositExtraId` LONGTEXT NULL,
    `refundExtraid` LONGTEXT NULL,
    `recipientExtraId` LONGTEXT NULL,
    `expiryTime` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
