-- CreateTable
CREATE TABLE `sessions` (
    `session_id` VARCHAR(128) NOT NULL,
    `expiration_time` INTEGER UNSIGNED NOT NULL,
    `data` MEDIUMTEXT NULL,

    PRIMARY KEY (`session_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
