-- CreateTable
CREATE TABLE `buy_crypto` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
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
