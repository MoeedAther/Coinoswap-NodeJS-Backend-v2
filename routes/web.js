import express from "express";
import exchangeController from "../controllers/exchangeController.js";
import CronController from "../controllers/cronController.js";
import exchangeRatesController from "../controllers/individualExchangeRateController.js";
import RateController from "../controllers/rateController.js";
import buyCryptoController from "../controllers/buyController.js";
import swapController from "../controllers/swapController.js";
import adminRouter from "./admin.js";

const router = express.Router();

//**************************************** Universal Rate API (New Improved Controller) ************************* */
router.post("/rate", RateController.getRate);

//**************************************** Price Check Apis (Legacy Individual Controllers) ************************* */
router.post("/changelly/new/price", exchangeRatesController.changellyprice);
router.post("/changenow/new/price", exchangeRatesController.changenowprice);
router.post("/stealthex/new/price", exchangeRatesController.stealthexprice);
router.post("/exolix/new/price", exchangeRatesController.exolixprice);
router.post("/simpleswap/new/price", exchangeRatesController.simpleswapprice);
router.post("/changehero/new/price", exchangeRatesController.changeheroprice);
router.post("/godex/new/price", exchangeRatesController.godexprice);
router.post(
  "/letsexchange/new/price",
  exchangeRatesController.letsexchangeprice
);
router.post("/easybit/new/price", exchangeRatesController.easybitprice);

//.................................. Transaction APIs ......................................./

// Floating transactions

//**************************************** Changelly Float Transaction ************************* */
router.post(
  "/createTransaction/changelly/float",
  exchangeController.changellyFloatingTransaction
);

//************************************ Changenow Floating Transactions ************************* */
router.post(
  "/createTransaction/changenow/float",
  exchangeController.changenowFloatingTransaction
);

//************************************ Changehero Floating Transactions ************************* */
router.post(
  "/createTransaction/changehero/float",
  exchangeController.changeheroFloatingTransaction
);

//**************************************** StealthEX Float Transactions ************************* */
router.post(
  "/createTransaction/stealthex/float",
  exchangeController.stealthexFloatingTransaction
);

//**************************************** Exolix Float Transactions ************************* */
router.post(
  "/createTransaction/exolix/float",
  exchangeController.exolixFloatingTransaction
);

//**************************************** Simnpleswap Float Transactions ************************* */
router.post(
  "/createTransaction/simpleswap/float",
  exchangeController.simpleswapFloatingTransaction
);

//**************************************** Godex Float Transactions ************************* */
router.post(
  "/createTransaction/godex/float",
  exchangeController.godexFloatingTransaction
);

//**************************************** Letsexchange Float Transactions ************************* */
router.post(
  "/createTransaction/letsexchange/float",
  exchangeController.letsexchangeFloatingTransaction
);

//**************************************** EasyBit Float Transactions ************************* */
router.post(
  "/createTransaction/easybit/float",
  exchangeController.easybitFloatingTransaction
);

// Fixed Transactions

//**************************************** Creating Fixed Transaction ************************* */
router.post(
  "/createTransaction/changelly/fixed",
  exchangeController.changellyFixedTransaction
);

//************************************ Changenow Fixed Transactions ************************* */
router.post(
  "/createTransaction/changenow/fixed",
  exchangeController.changenowFixedTransaction
);

//************************************ Changehero Fixed Transactions ************************* */
router.post(
  "/createTransaction/changehero/fixed",
  exchangeController.changeheroFixedTransaction
);

//**************************************** StealthEX Float Transactions ************************* */
router.post(
  "/createTransaction/stealthex/fixed",
  exchangeController.stealthexFixedTransaction
);

//**************************************** Exolix Fixed Transactions ************************* */
router.post(
  "/createTransaction/exolix/fixed",
  exchangeController.exolixFixedTransaction
);

//**************************************** Simnpleswap Fixed Transactions ************************* */
router.post(
  "/createTransaction/simpleswap/fixed",
  exchangeController.simpleswapFixedTransaction
);

//**************************************** Simnpleswap Fixed Transactions ************************* */
router.post(
  "/createTransaction/godex/fixed",
  exchangeController.godexFixedTransaction
);

//**************************************** Letsexchange Fixed Transactions ************************* */
router.post(
  "/createTransaction/letsexchange/fixed",
  exchangeController.letsexchangeFixedTransaction
);

//.................................. Cron Job APIs ......................................./
//Get cron type data
router.post("/get/cron/status", CronController.getStatusCronData);

//Set cron type data
router.post("/set/cron/status", CronController.setStatusCronData);

//.................................. Transaction Status Apis ......................................./
router.post(
  "/tx/changelly/status",
  exchangeController.checkChangellyTransactionStatus
);
router.post(
  "/tx/changenow/status",
  exchangeController.checkChangenowTransactionStatus
);
router.post(
  "/tx/changehero/status",
  exchangeController.checkChangeheroTransactionStatus
);
router.post(
  "/tx/exolix/status",
  exchangeController.checkExolixTransactionStatus
);
router.post(
  "/tx/letsexchange/status",
  exchangeController.checkLetsexchangeTransactionStatus
);
router.post(
  "/tx/simpleswap/status",
  exchangeController.checkSimpleswapTransactionStatus
);
router.post("/tx/godex/status", exchangeController.checkGodexTransactionStatus);
router.post(
  "/tx/stealthex/status",
  exchangeController.checkStealthexTransactionStatus
);
router.post(
  "/tx/easybit/status",
  exchangeController.checkEasybitTransactionStatus
);

//.......................... Transaction Status Check Using Order ID .............................../
router.post("/tx/status", exchangeController.checkTransactionStatus);

// ...................................... Buy Currencies .........................................../
router.get("/buy/update-coins", buyCryptoController.updateCoins);
router.post("/buy/create-standard-coin", buyCryptoController.createStandardCoin);
router.post("/buy/add-delete-coins", buyCryptoController.addAndDeleteCoin);
router.get("/buy/search-coins", buyCryptoController.searchCoins);

// ...................................... Swap Currencies .........................................../
router.get("/swap/update-coins", swapController.updateCoins);
router.post("/swap/add-delete-coins", swapController.addAndDeleteCoin);
router.post("/swap/standardize-coin", swapController.standardizeCoin);
router.post("/swap/destandardize-coin", swapController.destandardizeCoin);
router.get("/swap/get-standard-coin", swapController.getStandardCoin);
router.post("/swap/update-standard-coin", swapController.updateStandardCoin);
router.get("/swap/search-coins", swapController.searchCoins);

// ...................................... Admin Routes .........................................../
router.use("/admin", adminRouter);

export default router;
