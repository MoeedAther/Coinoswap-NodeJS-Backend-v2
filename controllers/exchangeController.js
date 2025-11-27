import crypto from "crypto";
import request from "request";
import fetch from "node-fetch";
import dotenv from "dotenv";
import { db } from "../database/connectdb.js";
import { createLogger, format, transports } from "winston";
import {
  calculateProfitInBTC,
  fetchCoinFromDB,
  checkEmailValidation,
} from "../Js/functions.js";

import util from "util";

const query = util.promisify(db.query).bind(db);

const { combine, timestamp, printf } = format;
// Define custom log format
const logFormat = printf(({ level, message, timestamp }) => {
  return `${timestamp} ${level}: ${message}`;
});

dotenv.config();

class exchangeController {
  // *********************** Floating Transactions ************************* //

  static changellyFloatingTransaction = async (req, res) => {
    const {
      sell,
      get,
      sellname,
      getname,
      sellcoinnetwork,
      getcoinnetwork,
      selllogo,
      getlogo,
      amount,
      recieving_Address,
      refund_Address,
      mail,
      rateId,
      extraid,
      refextraid,
      expirytime,
    } = req.body;

    const email = checkEmailValidation(mail) ? email : null;

    let coin = {
      sellTicker: null,
      getTicker: null,
      sellNetwork: null,
      getNetwork: null,
    };

    let sellCoinObj, getCoinObj;

    try {
      sellCoinObj = await fetchCoinFromDB(sell, "changelly");
      getCoinObj = await fetchCoinFromDB(get, "changelly");
    } catch (error) {
      return res.status(502).json({ message: error.message });
    }

    coin.sellTicker = sellCoinObj.ticker;
    coin.getTicker = getCoinObj.ticker;
    coin.sellNetwork = sellCoinObj.network;
    coin.getNetwork = getCoinObj.network;

    let profit = await calculateProfitInBTC(
      "changelly",
      sell,
      amount,
      "Floating"
    );

    if (!profit) {
      profit = 0;
    }

    // Create the logger
    const logger = createLogger({
      format: combine(timestamp(), logFormat),
      transports: [
        new transports.Console(),
        new transports.File({
          filename: "./logs/exchangeErrorLogs/changelly.log",
        }),
      ],
    });

    const privateKeyString = process.env.CHANGELLY_PRIVATE_KEY;
    const privateKey = crypto.createPrivateKey({
      key: privateKeyString,
      format: "der",
      type: "pkcs8",
      encoding: "hex",
    });

    const publicKey = crypto.createPublicKey(privateKey).export({
      type: "pkcs1",
      format: "der",
    });

    const message = {
      jsonrpc: "2.0",
      id: "test",
      method: "createTransaction",
      params: {
        from: coin.sellTicker,
        to: coin.getTicker,
        address: recieving_Address,
        extraId: extraid,
        amountFrom: amount,
        refundAddress: refund_Address,
        refundExtraId: refextraid,
      },
    };

    if (refextraid === "") {
      // Remove refundExtraId property from params
      delete message.params.refundExtraId;
    }

    if (extraid === "") {
      // Remove refundExtraId property from params
      delete message.params.extraId;
    }

    const signature = crypto.sign(
      "sha256",
      Buffer.from(JSON.stringify(message)),
      {
        key: privateKey,
        type: "pkcs8",
        format: "der",
      }
    );

    const paramCreateExchange = {
      method: "POST",
      url: "https://api.changelly.com/v2/#createTransaction",
      headers: {
        "Content-Type": "application/json",
        "X-Api-Key": crypto
          .createHash("sha256")
          .update(publicKey)
          .digest("base64"),
        "X-Api-Signature": signature.toString("base64"),
      },
      body: JSON.stringify(message),
    };

    request(paramCreateExchange, async function (error, response) {
      if (error) {
        return res.status(502).json({ message: error.message });
      }

      const data = await JSON.parse(response.body);
      if (data.error) {
        const errorString = JSON.stringify(data.error);
        const stringData = JSON.stringify(data);
        const requestBody = JSON.stringify(paramCreateExchange);
        const proxyRequestBody = JSON.stringify(req.body);
        logger.error(
          `Error: ${errorString} || response:${stringData} requestURL:https://api.changelly.com/v2/#createTransaction, reauestBody${requestBody} proxyRequestBody:${proxyRequestBody} `
        );
        if (data.error?.message === "Address is not valid") {
          return res
            .status(422)
            .json({ success: false, message: "Invalid withdrawal address" });
        }

        return res.status(404).json({
          success: false,
          message: "Request failed with an unkown error from exchange",
        });
      }

      try {
        if (data.result.id) {
          var sql =
            "INSERT INTO changelly_transactions(transaction_id, expiry_time,	sell_coin,	get_coin, sell_coin_name, get_coin_name, sell_coin_network, get_coin_network, sell_coin_logo, get_coin_logo,	sell_amount,	get_amount, deposit_extraid,	recipient_extraid,	refund_extraid,	status, recipient_address, refund_address, deposit_address, email, average_profit_percent	) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";
          await query(sql, [
            data.result.id,
            expirytime,
            coin.sellTicker,
            coin.getTicker,
            sellname,
            getname,
            sellcoinnetwork,
            getcoinnetwork,
            selllogo,
            getlogo,
            amount,
            data.result.amountExpectedTo,
            data.result.payinExtraId,
            extraid,
            refextraid,
            data.result.status,
            recieving_Address,
            refund_Address,
            data.result.payinAddress,
            email,
            profit,
          ]);
        }
        return res.status(200).json({
          transaction_id: data.result.id,
          sell_coin: sell,
          get_coin: get,
          sell_amount: amount,
          get_amount: data.result.amountExpectedTo,
          recipient_extraid: extraid,
          refund_extraid: refextraid,
          status: data.result.status,
          recipient_address: recieving_Address,
          refund_address: refund_Address,
          deposit_address: data.result.payinAddress,
          deposit_extraid: data.result.payinExtraId
            ? data.result.payinExtraId
            : null,
          email: email,
          transaction_type: "Floating",
        });
      } catch (error) {
        let stringData = JSON.stringify(data);
        let requestBody = JSON.stringify(paramCreateExchange);
        const proxyRequestBody = JSON.stringify(req.body);
        logger.error(
          `Error: ${error} || response:${stringData} requestURL:https://api.changelly.com/v2, reauestBody:${requestBody} proxyRequestBody:${proxyRequestBody}`
        );
        return res.status(502).json({ message: error.message });
      }
    });
  };

  static changenowFloatingTransaction = async (req, res) => {
    const {
      sell,
      get,
      sellname,
      getname,
      sellcoinnetwork,
      getcoinnetwork,
      selllogo,
      getlogo,
      amount,
      recieving_Address,
      refund_Address,
      mail,
      extraid,
      refextraid,
      expirytime,
    } = req.body;

    const email = checkEmailValidation(mail) ? email : null;

    let coin = {
      sellTicker: null,
      getTicker: null,
      sellNetwork: null,
      getNetwork: null,
    };

    let sellCoinObj, getCoinObj;
    try {
      sellCoinObj = await fetchCoinFromDB(sell, "changenow");
      getCoinObj = await fetchCoinFromDB(get, "changenow");
    } catch (error) {
      console.log(error);
      return res.status(502).json({ message: error.message });
    }

    coin.sellTicker = sellCoinObj.ticker;
    coin.getTicker = getCoinObj.ticker;
    coin.sellNetwork = sellCoinObj.network;
    coin.getNetwork = getCoinObj.network;

    let profit = await calculateProfitInBTC(
      "changenow",
      sell,
      amount,
      "Floating"
    );

    if (!profit) {
      //Dont Do any thing
      profit = 0;
    }

    // Create the logger
    const logger = createLogger({
      format: combine(timestamp(), logFormat),
      transports: [
        new transports.Console(),
        new transports.File({
          filename: "./logs/exchangeErrorLogs/changenow.log",
        }),
      ],
    });

    let data, url, options;
    try {
      url = `https://api.changenow.io/v2/exchange`;

      const params = {
        fromCurrency: coin.sellTicker,
        fromNetwork: coin.sellNetwork,
        toCurrency: coin.getTicker,
        toNetwork: coin.getNetwork,
        fromAmount: amount,
        toAmount: "",
        address: recieving_Address,
        extraId: extraid,
        refundAddress: refund_Address,
        refundExtraId: refextraid,
        userId: "",
        payload: "",
        contactEmail: "",
        flow: "standard",
        type: "direct",
        rateId: "",
      };

      options = {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-changenow-api-key": process.env.CHANGENOW,
        },
        body: JSON.stringify(params),
      };

      const response = await fetch(url, options);
      data = await response.json();
    } catch (error) {
      return res.status(502).json({ message: error.message });
    }

    //Exchange Api error
    if (data.error) {
      console.log(data);
      const errorString = JSON.stringify(data.error);
      const stringResponse = JSON.stringify(data);
      const requestBody = JSON.stringify(options);
      const proxyRequestBody = JSON.stringify(req.body);
      logger.error(
        `Error: ${errorString} || response${stringResponse} requestURL:${url}, requestBody${requestBody} proxyRequestBody:${proxyRequestBody}`
      );
      if (data.error === "not_valid_address") {
        return res
          .status(422)
          .json({ success: false, message: "Invalid withdrawal address" });
      }

      return res.status(404).json({
        success: false,
        message: "Request failed with an unkown error from exchange",
      });
    }

    try {
      if (data.id) {
        var sql =
          "INSERT INTO changenow_transactions(transaction_id, expiry_time,	sell_coin,	get_coin, sell_coin_name, get_coin_name, sell_coin_network, get_coin_network, sell_coin_logo, get_coin_logo,	sell_amount,	get_amount, deposit_extraid,	recipient_extraid,	refund_extraid, status, recipient_address, refund_address, deposit_address, email, average_profit_percent	) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";
        await query(sql, [
          data.id,
          expirytime,
          coin.sellTicker,
          coin.getTicker,
          sellname,
          getname,
          sellcoinnetwork,
          getcoinnetwork,
          selllogo,
          getlogo,
          amount,
          data.toAmount,
          data.payinExtraId,
          extraid,
          refextraid,
          "waiting",
          recieving_Address,
          refund_Address,
          data.payinAddress,
          email,
          profit,
        ]);

        return res.status(200).json({
          transaction_id: data.id,
          sell_coin: sell,
          get_coin: get,
          sell_amount: amount,
          get_amount: data.amount,
          recipient_extraid: extraid,
          refund_extraid: refextraid,
          status: data.status,
          recipient_address: recieving_Address,
          refund_address: refund_Address,
          deposit_address: data.payinAddress,
          deposit_extraid: data.payinExtraId ? data.payinExtraId : null,
          email: email,
          transaction_type: "Floating",
        });
      }
    } catch (error) {
      const stringResponse = JSON.stringify(data);
      const requestBody = JSON.stringify(options);
      const proxyRequestBody = JSON.stringify(req.body);
      logger.error(
        `Error: ${error} || response${stringResponse} requestURL:${url}, requestBody${requestBody} proxyRequestBody:${proxyRequestBody}`
      );

      //Exchange response invalid
      return res.status(502).json({ message: error.message });
    }
  };

  static changeheroFloatingTransaction = async (req, res) => {
    const {
      sell,
      get,
      sellname,
      getname,
      sellcoinnetwork,
      getcoinnetwork,
      selllogo,
      getlogo,
      amount,
      recieving_Address,
      refund_Address,
      mail,
      rateId,
      extraid,
      refextraid,
      expirytime,
    } = req.body;

    const email = checkEmailValidation(mail) ? email : null;

    let coin = {
      sellTicker: null,
      getTicker: null,
      sellNetwork: null,
      getNetwork: null,
    };

    let sellCoinObj, getCoinObj;
    try {
      sellCoinObj = await fetchCoinFromDB(sell, "changehero");
      getCoinObj = await fetchCoinFromDB(get, "changehero");
    } catch (error) {
      return res.status(502).json({ message: error.message });
    }

    coin.sellTicker = sellCoinObj.ticker;
    coin.getTicker = getCoinObj.ticker;
    coin.sellNetwork = sellCoinObj.network;
    coin.getNetwork = getCoinObj.network;

    let profit = await calculateProfitInBTC(
      "changehero",
      sell,
      amount,
      "Floating"
    );

    if (!profit) {
      profit = 0;
    }
    // Create the logger
    const logger = createLogger({
      format: combine(timestamp(), logFormat),
      transports: [
        new transports.Console(),
        new transports.File({
          filename: "./logs/exchangeErrorLogs/changehero.log",
        }),
      ],
    });

    let data, options, url;
    try {
      url = "https://api.changehero.io/v2/";

      const params = {
        jsonrpc: "2.0",
        method: "createTransaction",
        params: {
          from: coin.sellTicker,
          to: coin.getTicker,
          address: recieving_Address,
          extraId: extraid,
          amount: amount,
          refundAddress: refund_Address,
          refundExtraId: refextraid,
        },
      };

      options = {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "api-key": process.env.CHANGEHERO,
        },
        body: JSON.stringify(params),
      };

      const response = await fetch(url, options);
      data = await response.json();
    } catch (error) {
      return res.status(502).json({ message: error.message });
    }

    if (data.error) {
      const errorString = JSON.stringify(data.error);
      const stringResponse = JSON.stringify(data);
      const requestBody = JSON.stringify(options);
      const proxyRequestBody = JSON.stringify(req.body);
      logger.error(
        `Error: ${errorString} || response${stringResponse} requestURL:${url}, reauestBody${requestBody} proxyRequestBody:${proxyRequestBody}`
      );

      if (data.error.message === "Invalid address") {
        return res
          .status(422)
          .json({ success: false, message: "Invalid withdrawal address" });
      }

      if (data.error.message === "Invalid refund address") {
        return res
          .status(422)
          .json({ success: false, message: "Invalid refund address" });
      }

      return res.status(404).json({
        success: false,
        message: "Request failed with an unkown error from exchange",
      });
    }

    try {
      if (data.result.id) {
        var sql =
          "INSERT INTO changehero_transactions(transaction_id, expiry_time,	sell_coin,	get_coin, sell_coin_name, get_coin_name, sell_coin_network, get_coin_network, sell_coin_logo, get_coin_logo,	sell_amount,	get_amount, deposit_extraid,	recipient_extraid,	refund_extraid, status, recipient_address, refund_address, deposit_address, email, average_profit_percent	) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";
        await query(sql, [
          data.result.id,
          expirytime,
          coin.sellTicker,
          coin.getTicker,
          sellname,
          getname,
          sellcoinnetwork,
          getcoinnetwork,
          selllogo,
          getlogo,
          amount,
          data.result.amountExpectedTo,
          data.result.payinExtraId,
          extraid,
          refextraid,
          data.result.status,
          recieving_Address,
          refund_Address,
          data.result.payinAddress,
          email,
          profit,
        ]);

        return res.status(200).json({
          transaction_id: data.result.id,
          sell_coin: sell,
          get_coin: get,
          sell_amount: amount,
          get_amount: data.result.amountExpectedTo,
          recipient_extraid: extraid,
          refund_extraid: refextraid,
          status: data.result.status,
          recipient_address: recieving_Address,
          refund_address: refund_Address,
          deposit_address: data.result.payinAddress,
          deposit_extraid: data.result.payinExtraId
            ? data.result.payinExtraId
            : null,
          email: email,
          transaction_type: "Floating",
        });
      }
    } catch (error) {
      const stringResponse = JSON.stringify(data);
      const requestBody = JSON.stringify(options);
      const proxyRequestBody = JSON.stringify(req.body);
      logger.error(
        `Error: ${error} || response${stringResponse} requestURL:${url}, reuestBody${requestBody} proxyRequestBody:${proxyRequestBody}`
      );
      //Exchange response invalid
      return res.status(502).json({ message: error.message });
    }
  };

  static stealthexFloatingTransaction = async (req, res) => {
    const {
      sell,
      get,
      sellname,
      getname,
      sellcoinnetwork,
      getcoinnetwork,
      selllogo,
      getlogo,
      amount,
      recieving_Address,
      refund_Address,
      mail,
      rateId,
      extraid,
      refextraid,
      expirytime,
    } = req.body;

    const email = checkEmailValidation(mail) ? email : null;

    let coin = {
      sellTicker: null,
      getTicker: null,
      sellNetwork: null,
      getNetwork: null,
    };

    let sellCoinObj, getCoinObj;
    try {
      sellCoinObj = await fetchCoinFromDB(sell, "stealthex");
      getCoinObj = await fetchCoinFromDB(get, "stealthex");
    } catch (error) {
      return res.status(502).json({ message: error.message });
    }

    coin.sellTicker = sellCoinObj.ticker;
    coin.getTicker = getCoinObj.ticker;
    coin.sellNetwork = sellCoinObj.network;
    coin.getNetwork = getCoinObj.network;

    let profit = await calculateProfitInBTC(
      "stealthex",
      sell,
      amount,
      "Floating"
    );
    if (!profit) {
      profit = 0;
    }
    // Create the logger
    const logger = createLogger({
      format: combine(timestamp(), logFormat),
      transports: [
        new transports.Console(),
        new transports.File({
          filename: "./logs/exchangeErrorLogs/stealthex.log",
        }),
      ],
    });

    let data, url, options;
    try {
      url = `https://api.stealthex.io/api/v2/exchange?api_key=${process.env.STEALTHEX}`;
      const params = {
        currency_from: coin.sellTicker,
        currency_to: getCoinObj.ticker,
        address_to: recieving_Address,
        extra_id_to: extraid,
        amount_from: amount,
        fixed: false,
        refund_address: refund_Address,
        refund_extra_id: refextraid,
        api_key: process.env.STEALTHEX,
      };

      options = {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(params),
      };

      const response = await fetch(url, options);
      data = await response.json();
    } catch (error) {
      return res.status(502).json({ message: error.message });
    }

    if (data.err) {
      const errorString = JSON.stringify(data.err);
      const stringResponse = JSON.stringify(data);
      const requestBody = JSON.stringify(options);
      const proxyRequestBody = JSON.stringify(req.body);
      logger.error(
        `Error: ${errorString} || response${stringResponse} requestURL:${url}, reauestBody${requestBody} proxyRequestBody:${proxyRequestBody}`
      );
      if (data.err?.details === "Invalid address") {
        return res
          .status(422)
          .json({ success: false, message: "Invalid withdrawal address" });
      }

      return res.status(404).json({
        success: false,
        message: "Request failed with an unkown error from exchange",
      });
    }

    try {
      if (data.id) {
        var sql =
          "INSERT INTO stealthex_transactions(transaction_id, expiry_time,	sell_coin,	get_coin, sell_coin_name, get_coin_name, sell_coin_network, get_coin_network, sell_coin_logo, get_coin_logo,	sell_amount,	get_amount, deposit_extraid,	recipient_extraid,	refund_extraid, status, recipient_address, refund_address, deposit_address, email, average_profit_percent	) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";
        await query(sql, [
          data.id,
          expirytime,
          coin.sellTicker,
          coin.getTicker,
          sellname,
          getname,
          sellcoinnetwork,
          getcoinnetwork,
          selllogo,
          getlogo,
          amount,
          data.amount_to,
          data.extra_id_from,
          extraid,
          refextraid,
          data.status,
          recieving_Address,
          refund_Address,
          data.address_from,
          email,
          profit,
        ]);

        return res.status(200).json({
          transaction_id: data.id,
          sell_coin: sell,
          get_coin: get,
          sell_amount: amount,
          get_amount: data.amount_to,
          recipient_extraid: extraid,
          refund_extraid: refextraid,
          status: data.status,
          recipient_address: recieving_Address,
          refund_address: refund_Address,
          deposit_address: data.address_from,
          deposit_extraid: data.extra_id_from ? data.extra_id_from : null,
          email: email,
          transaction_type: "Floating",
        });
      }
    } catch (error) {
      const stringResponse = JSON.stringify(data);
      const requestBody = JSON.stringify(options);
      const proxyRequestBody = JSON.stringify(req.body);
      logger.error(
        `Error: ${error} || response${stringResponse} requestURL:${url}, reauestBody${requestBody} proxyRequestBody:${proxyRequestBody}`
      );
      //Exchange response invalid
      return res.status(502).json({ message: error.message });
    }
  };

  static exolixFloatingTransaction = async (req, res) => {
    const {
      sell,
      get,
      sellname,
      getname,
      sellcoinnetwork,
      getcoinnetwork,
      selllogo,
      getlogo,
      amount,
      recieving_Address,
      refund_Address,
      mail,
      rateId,
      extraid,
      refextraid,
      expirytime,
    } = req.body;

    // Storing null in DB if sent email is an empty string
    const email = checkEmailValidation(mail) ? email : null;

    let coin = {
      sellTicker: null,
      getTicker: null,
      sellNetwork: null,
      getNetwork: null,
    };

    let sellCoinObj, getCoinObj;
    try {
      sellCoinObj = await fetchCoinFromDB(sell, "exolix");
      getCoinObj = await fetchCoinFromDB(get, "exolix");
    } catch (error) {
      return res.status(502).json({ message: error.message });
    }

    coin.sellTicker = sellCoinObj.ticker;
    coin.getTicker = getCoinObj.ticker;
    coin.sellNetwork = sellCoinObj.network;
    coin.getNetwork = getCoinObj.network;

    // Create the logger
    const logger = createLogger({
      format: combine(timestamp(), logFormat),
      transports: [
        new transports.Console(),
        new transports.File({
          filename: "./logs/exchangeErrorLogs/exolix.log",
        }),
      ],
    });

    let profit = await calculateProfitInBTC("exolix", sell, amount, "Floating");
    if (!profit) {
      profit = 0;
    }

    let data, options, url;

    try {
      url = "https://exolix.com/api/v2/transactions";

      const params = {
        coinFrom: coin.sellTicker,
        networkFrom: coin.sellNetwork,
        coinTo: coin.getTicker,
        networkTo: coin.getNetwork,
        amount: amount,
        withdrawalAddress: recieving_Address,
        withdrawalExtraId: extraid,
        rateType: "float",
        refundAddress: refund_Address,
        refundExtraId: refextraid,
      };

      options = {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: process.env.EXOLIX,
        },
        body: JSON.stringify(params),
      };

      const response = await fetch(url, options);
      data = await response.json();
    } catch (error) {
      return res.status(502).json({ message: error.message });
    }

    if (data.error || data.message) {
      const stringResponse = JSON.stringify(data);
      const requestBody = JSON.stringify(options);
      const proxyRequestBody = JSON.stringify(req.body);
      logger.error(
        `Error: ${stringResponse} || response${stringResponse} requestURL:${url}, reauestBody${requestBody} proxyRequestBody:${proxyRequestBody}`
      );
      if (data.error === "Invalid withdrawal address") {
        return res
          .status(422)
          .json({ success: false, message: "Invalid withdrawal address" });
      }
      return res.status(404).json({
        success: false,
        message: "Request failed with an unkown error from exchange",
      });
    }

    try {
      if (data.id) {
        var sql =
          "INSERT INTO exolix_transactions(transaction_id, expiry_time,	sell_coin,	get_coin, sell_coin_name, get_coin_name, sell_coin_network, get_coin_network, sell_coin_logo, get_coin_logo,	sell_amount,	get_amount, deposit_extraid,	recipient_extraid,	refund_extraid, status, recipient_address, refund_address, deposit_address, email, average_profit_percent	) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";
        await query(sql, [
          data.id,
          expirytime,
          coin.sellTicker,
          coin.getTicker,
          sellname,
          getname,
          sellcoinnetwork,
          getcoinnetwork,
          selllogo,
          getlogo,
          amount,
          data.amountTo,
          data.depositExtraId,
          extraid,
          refextraid,
          data.status,
          recieving_Address,
          refund_Address,
          data.depositAddress,
          email,
          profit,
        ]);

        return res.status(200).json({
          transaction_id: data.id,
          sell_coin: sell,
          get_coin: get,
          sell_amount: amount,
          get_amount: data.amountTo,
          recipient_extraid: extraid,
          refund_extraid: refextraid,
          status: data.status,
          recipient_address: recieving_Address,
          refund_address: refund_Address,
          deposit_address: data.depositAddress,
          deposit_extraid: data.depositExtraId ? data.depositExtraId : null,
          email: email,
          transaction_type: "Floating",
        });
      }
    } catch (error) {
      const stringResponse = JSON.stringify(data);
      const requestBody = JSON.stringify(options);
      const proxyRequestBody = JSON.stringify(req.body);
      logger.error(
        `Error: ${error} || response${stringResponse} requestURL:${url}, reauestBody${requestBody} proxyRequestBody:${proxyRequestBody}`
      );
      //Exchange response invalid
      return res.status(502).json({ success: false, message: error.message });
    }
  };

  static simpleswapFloatingTransaction = async (req, res) => {
    const {
      sell,
      get,
      sellname,
      getname,
      sellcoinnetwork,
      getcoinnetwork,
      selllogo,
      getlogo,
      amount,
      recieving_Address,
      refund_Address,
      mail,
      rateId,
      extraid,
      refextraid,
      expirytime,
    } = req.body;

    const email = checkEmailValidation(mail) ? email : null;

    // Create the logger
    const logger = createLogger({
      format: combine(timestamp(), logFormat),
      transports: [
        new transports.Console(),
        new transports.File({
          filename: "./logs/exchangeErrorLogs/simpleswap.log",
        }),
      ],
    });

    let coin = {
      sellTicker: null,
      getTicker: null,
      sellNetwork: null,
      getNetwork: null,
    };

    let sellCoinObj, getCoinObj;
    try {
      sellCoinObj = await fetchCoinFromDB(sell, "simpleswap");
      getCoinObj = await fetchCoinFromDB(get, "simpleswap");
    } catch (error) {
      return res.status(502).json({ message: error.message });
    }

    coin.sellTicker = sellCoinObj.ticker;
    coin.getTicker = getCoinObj.ticker;
    coin.sellNetwork = sellCoinObj.network;
    coin.getNetwork = getCoinObj.network;

    let profit = await calculateProfitInBTC(
      "simpleswap",
      sell,
      amount,
      "Floating"
    );
    if (!profit) {
      profit = 0;
    }

    let data, url, options;
    try {
      url = `https://api.simpleswap.io/create_exchange?api_key=${process.env.SIMPLESWAP}`;

      // Create the logger
      const logger = createLogger({
        format: combine(timestamp(), logFormat),
        transports: [
          new transports.Console(),
          new transports.File({
            filename: "./logs/exchangeErrorLogs/simpleswap.log",
          }),
        ],
      });
      const params = {
        fixed: false,
        currency_from: coin.sellTicker,
        currency_to: coin.getTicker,
        amount: amount,
        address_to: recieving_Address,
        extra_id_to: extraid,
        user_refund_address: refund_Address,
        user_refund_extra_id: refextraid,
      };

      options = {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          api_key: process.env.SIMPLESWAP,
        },
        body: JSON.stringify(params),
      };

      const response = await fetch(url, options);
      data = await response.json();
    } catch (error) {
      return res.status(502).json({ message: error.message });
    }

    if (data.error) {
      const errorString = JSON.stringify(data.error);
      const stringResponse = JSON.stringify(data);
      const requestBody = JSON.stringify(options);
      const proxyRequestBody = JSON.stringify(req.body);
      logger.error(
        `Error: ${errorString} || response${stringResponse} requestURL:${url}, reauestBody${requestBody} proxyRequestBody:${proxyRequestBody}`
      );
      if (data.description === "Validation of 'address_to' failed") {
        return res
          .status(422)
          .json({ success: false, message: "Invalid withdrawal address" });
      }
      return res.status(404).json({
        success: false,
        message: "Request failed with an unkown error from exchange",
      });
    }

    try {
      if (data.id) {
        var sql =
          "INSERT INTO simpleswap_transactions(transaction_id, expiry_time,	sell_coin,	get_coin, sell_coin_name, get_coin_name, sell_coin_network, get_coin_network, sell_coin_logo, get_coin_logo,	sell_amount,	get_amount, deposit_extraid,	recipient_extraid,	refund_extraid, status, recipient_address, refund_address, deposit_address, email, average_profit_percent	) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";
        await query(sql, [
          data.id,
          expirytime,
          coin.sellTicker,
          coin.getTicker,
          sellname,
          getname,
          sellcoinnetwork,
          getcoinnetwork,
          selllogo,
          getlogo,
          amount,
          data.amount_to,
          data.extra_id_from,
          extraid,
          refextraid,
          data.status,
          recieving_Address,
          refund_Address,
          data.address_from,
          email,
          profit,
        ]);

        return res.status(200).json({
          transaction_id: data.id,
          sell_coin: sell,
          get_coin: get,
          sell_amount: amount,
          get_amount: data.amount_to,
          recipient_extraid: extraid,
          refund_extraid: refextraid,
          status: data.status,
          recipient_address: recieving_Address,
          refund_address: refund_Address,
          deposit_address: data.address_from,
          deposit_extraid: data.extra_id_from ? data.extra_id_from : null,
          email: email,
          transaction_type: "Floating",
        });
      }
    } catch (error) {
      const stringResponse = JSON.stringify(data);
      const requestBody = JSON.stringify(options);
      const proxyRequestBody = JSON.stringify(req.body);
      logger.error(
        `Error: ${error} || response${stringResponse} requestURL:${url}, reauestBody${requestBody} proxyRequestBody:${proxyRequestBody}`
      );
      //Exchange response invalid
      return res.status(502).json({ message: error.message });
    }
  };

  static godexFloatingTransaction = async (req, res) => {
    const {
      sell,
      get,
      sellname,
      getname,
      sellcoinnetwork,
      getcoinnetwork,
      selllogo,
      getlogo,
      amount,
      recieving_Address,
      refund_Address,
      mail,
      rateId,
      extraid,
      refextraid,
      expirytime,
    } = req.body;

    const email = checkEmailValidation(mail) ? email : null;

    let coin = {
      sellTicker: null,
      getTicker: null,
      sellNetwork: null,
      getNetwork: null,
    };

    let sellCoinObj, getCoinObj;
    try {
      sellCoinObj = await fetchCoinFromDB(sell, "godex");
      getCoinObj = await fetchCoinFromDB(get, "godex");
    } catch (error) {
      return res.status(502).json({ message: error.message });
    }

    coin.sellTicker = sellCoinObj.ticker;
    coin.getTicker = getCoinObj.ticker;
    coin.sellNetwork = sellCoinObj.network;
    coin.getNetwork = getCoinObj.network;

    let profit = await calculateProfitInBTC("godex", sell, amount, "Floating");
    if (!profit) {
      profit = 0;
    }
    // Create the logger
    const logger = createLogger({
      format: combine(timestamp(), logFormat),
      transports: [
        new transports.Console(),
        new transports.File({ filename: "./logs/exchangeErrorLogs/godex.log" }),
      ],
    });

    let data, url, options;

    try {
      url = "https://api.godex.io/api/v1/transaction";

      const params = {
        coin_from: sell.toUpperCase(),
        coin_to: get.toUpperCase(),
        deposit_amount: amount,
        withdrawal: recieving_Address,
        withdrawal_extra_id: extraid != undefined ? extraid : "",
        return: refund_Address,
        return_extra_id: refextraid != undefined ? refextraid : "",
        affiliate_id: process.env.GODEX_AFFILIATE_ID,
        float: true,
      };

      options = {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          "public-key": process.env.GODEX,
        },
        body: JSON.stringify(params),
      };
      const response = await fetch(url, options);
      data = await response.json();
    } catch (error) {
      return res.status(502).json({ message: error.message });
    }

    if (data.error) {
      const errorString = JSON.stringify(data.validation);
      const stringResponse = JSON.stringify(data);
      const requestBody = JSON.stringify(options);
      const proxyRequestBody = JSON.stringify(req.body);
      logger.error(
        `Error: ${errorString} || response${stringResponse} requestURL:${url}, reauestBody${requestBody} proxyRequestBody:${proxyRequestBody}`
      );

      if (data.error?.validation?.withdrawal) {
        return res
          .status(422)
          .json({ success: false, message: "Invalid withdrawal address" });
      }

      return res.status(404).json({
        success: false,
        message: "Request failed with an unkown error from exchange",
      });
    }

    try {
      if (data.transaction_id) {
        var sql =
          "INSERT INTO godex_transactions(transaction_id, expiry_time,	sell_coin,	get_coin, sell_coin_name, get_coin_name, sell_coin_network, get_coin_network, sell_coin_logo, get_coin_logo,	sell_amount,	get_amount, deposit_extraid,	recipient_extraid,	refund_extraid, status, recipient_address, refund_address, deposit_address, email, average_profit_percent	) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";
        await query(sql, [
          data.transaction_id,
          expirytime,
          coin.sellTicker,
          coin.getTicker,
          sellname,
          getname,
          sellcoinnetwork,
          getcoinnetwork,
          selllogo,
          getlogo,
          amount,
          data.withdrawal_amount,
          data.deposit_extra_id,
          extraid,
          refextraid,
          data.status,
          recieving_Address,
          refund_Address,
          data.deposit,
          email,
          profit,
        ]);

        return res.status(200).json({
          transaction_id: data.transaction_id,
          sell_coin: sell,
          get_coin: get,
          sell_amount: amount,
          get_amount: data.withdrawal_amount,
          recipient_extraid: extraid,
          refund_extraid: refextraid,
          status: data.status,
          recipient_address: recieving_Address,
          refund_address: refund_Address,
          deposit_address: data.deposit,
          deposit_extraid: data.deposit_extra_id ? data.deposit_extra_id : null,
          email: email,
          transaction_type: "Floating",
        });
      }
    } catch (error) {
      const stringResponse = JSON.stringify(data);
      const requestBody = JSON.stringify(options);
      const proxyRequestBody = JSON.stringify(req.body);
      logger.error(
        `Error: ${error} || response${stringResponse} requestURL:${url}, reauestBody${requestBody} ${proxyRequestBody}`
      );
      //Exchange response invalid
      return res.status(502).json({ message: error.message });
    }
  };

  static letsexchangeFloatingTransaction = async (req, res) => {
    const {
      sell,
      get,
      sellname,
      getname,
      sellcoinnetwork,
      getcoinnetwork,
      selllogo,
      getlogo,
      amount,
      recieving_Address,
      refund_Address,
      mail,
      rateId,
      extraid,
      refextraid,
      expirytime,
    } = req.body;

    const email = checkEmailValidation(mail) ? email : null;

    let coin = {
      sellTicker: null,
      getTicker: null,
      sellNetwork: null,
      getNetwork: null,
    };

    let sellCoinObj, getCoinObj;
    try {
      sellCoinObj = await fetchCoinFromDB(sell, "letsexchange");
      getCoinObj = await fetchCoinFromDB(get, "letsexchange");
    } catch (error) {
      return res.status(502).json({ message: error.message });
    }

    coin.sellTicker = sellCoinObj.ticker;
    coin.getTicker = getCoinObj.ticker;
    coin.sellNetwork = sellCoinObj.network;
    coin.getNetwork = getCoinObj.network;

    let profit = await calculateProfitInBTC(
      "letsexchange",
      sell,
      amount,
      "Floating"
    );

    if (!profit) {
      profit = 0;
    }

    // Create the logger
    const logger = createLogger({
      format: combine(timestamp(), logFormat),
      transports: [
        new transports.Console(),
        new transports.File({
          filename: "./logs/exchangeErrorLogs/letsexchange.log",
        }),
      ],
    });

    let data, url, options;
    try {
      const url = "https://api.letsexchange.io/api/v1/transaction";
      const params = {
        float: true,
        coin_from: coin.sellTicker,
        coin_to: coin.getTicker,
        deposit_amount: amount,
        withdrawal: recieving_Address,
        withdrawal_extra_id: extraid != undefined ? extraid : "",
        return: refund_Address,
        return_extra_id: refextraid,
        affiliate_id: process.env.LETSEXCHANGE_AFFILIATE_ID,
      };

      options = {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: process.env.LETSEXCHANGE,
          Accept: "application/json",
        },
        body: JSON.stringify(params),
      };

      const response = await fetch(url, options);
      data = await response.json();
    } catch (error) {
      return res.status(502).json({ message: error.message });
    }

    if (data.error) {
      const errorString = JSON.stringify(data.error);
      const stringResponse = JSON.stringify(data);
      const requestBody = JSON.stringify(options);
      const proxyRequestBody = JSON.stringify(req.body);
      logger.error(
        `Error: ${errorString} || response${stringResponse} requestURL:${url}, reauestBody${requestBody} proxyRequestBody:${proxyRequestBody}`
      );
      if (data.error?.validation?.withdrawal) {
        return res
          .status(422)
          .json({ success: false, message: "Invalid withdrawal address" });
      }

      return res.status(404).json({
        success: false,
        message: "Request failed with an unkown error from exchange",
      });
    }

    try {
      if (data.transaction_id) {
        let profit = await calculateProfitInBTC(
          "letsexchange",
          sell,
          amount,
          "Floating"
        );
        var sql =
          "INSERT INTO letsexchange_transactions(transaction_id, expiry_time,	sell_coin,	get_coin, sell_coin_name, get_coin_name, sell_coin_network, get_coin_network, sell_coin_logo, get_coin_logo,	sell_amount,	get_amount, deposit_extraid,	recipient_extraid,	refund_extraid, status, recipient_address, refund_address, deposit_address, email, average_profit_percent	) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";
        await query(sql, [
          data.transaction_id,
          expirytime,
          coin.sellTicker,
          coin.getTicker,
          sellname,
          getname,
          sellcoinnetwork,
          getcoinnetwork,
          selllogo,
          getlogo,
          amount,
          data.withdrawal_amount,
          data.deposit_extra_id,
          extraid,
          refextraid,
          data.status,
          recieving_Address,
          refund_Address,
          data.deposit,
          email,
          profit,
        ]);

        return res.status(200).json({
          transaction_id: data.transaction_id,
          sell_coin: sell,
          get_coin: get,
          sell_amount: amount,
          get_amount: data.withdrawal_amount,
          recipient_extraid: extraid,
          refund_extraid: refextraid,
          status: data.status,
          recipient_address: recieving_Address,
          refund_address: refund_Address,
          deposit_address: data.deposit,
          deposit_extraid: data.deposit_extra_id ? data.deposit_extra_id : null,
          email: email,
          transaction_type: "Floating",
        });
      }
    } catch (error) {
      const stringResponse = JSON.stringify(data);
      const requestBody = JSON.stringify(options);
      const proxyRequestBody = JSON.stringify(req.body);
      logger.error(
        `Error: ${error} || response${stringResponse} requestURL:${url}, reauestBody${requestBody} proxyRequestBody:${proxyRequestBody}`
      );
      //Exchange response invalid
      return res.status(502).json({ message: error.message });
    }
  };

  static easybitFloatingTransaction = async (req, res) => {
    const {
      sell,
      get,
      sellname,
      getname,
      sellcoinnetwork,
      getcoinnetwork,
      selllogo,
      getlogo,
      amount,
      recieving_Address,
      refund_Address,
      mail,
      rateId,
      extraid,
      refextraid,
      expirytime,
      payload,
    } = req.body;

    const email = checkEmailValidation(mail) ? email : null;

    let coin = {
      sellTicker: null,
      getTicker: null,
      sellNetwork: null,
      getNetwork: null,
    };

    let sellCoinObj, getCoinObj;
    try {
      sellCoinObj = await fetchCoinFromDB(sell, "easybit");
      getCoinObj = await fetchCoinFromDB(get, "easybit");
    } catch (error) {
      return res.status(502).json({ message: error.message });
    }

    coin.sellTicker = sellCoinObj.ticker;
    coin.getTicker = getCoinObj.ticker;
    coin.sellNetwork = sellCoinObj.network;
    coin.getNetwork = getCoinObj.network;

    let profit = await calculateProfitInBTC(
      "easybit",
      sell,
      amount,
      "Floating"
    );

    if (!profit) {
      profit = 0;
    }

    // Create the logger
    const logger = createLogger({
      format: combine(timestamp(), logFormat),
      transports: [
        new transports.Console(),
        new transports.File({
          filename: "./logs/exchangeErrorLogs/easybit.log",
        }),
      ],
    });

    let data, url, options;
    try {
      url = "https://api.easybit.com/order";
      const params = {
        send: coin.sellTicker,
        receive: coin.getTicker,
        amount: amount,
        receiveAddress: recieving_Address,
        sendNetwork: coin.sellNetwork,
        receiveNetwork: coin.getNetwork,
        payload: payload,
        receiveTag: extraid.length > 0 ? extraid : null,
        refundAddress: refund_Address,
        refundTag: refextraid.length > 0 ? refextraid : null,
      };
      options = {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "API-KEY": process.env.EASYBIT,
        },
        body: JSON.stringify(params),
      };
      const response = await fetch(url, options);
      data = await response.json();
    } catch (error) {
      return res.status(502).json({ message: error.message });
    }

    if (data.errorCode && data.errorMessage) {
      const errorString = JSON.stringify(data.errorMessage);
      const stringResponse = JSON.stringify(data);
      const requestBody = JSON.stringify(options);
      const proxyRequestBody = JSON.stringify(req.body);
      logger.error(
        `Error: ${errorString} || response${stringResponse} requestURL:${url}, reauestBody${requestBody} proxyRequestBody:${proxyRequestBody}`
      );
      if (data.errorMessage === "Invalid address for specified network") {
        return res
          .status(422)
          .json({ success: false, message: "Invalid withdrawal address" });
      }

      return res.status(404).json({
        success: false,
        message: "Request failed with an unkown error from exchange",
      });
    }

    try {
      if (data.data.id) {
        var sql =
          "INSERT INTO easybit_transactions(transaction_id, expiry_time,	sell_coin,	get_coin, sell_coin_name, get_coin_name, sell_coin_network, get_coin_network, sell_coin_logo, get_coin_logo,	sell_amount,	get_amount, deposit_extraid,	recipient_extraid,	refund_extraid, status, recipient_address, refund_address, deposit_address, email, average_profit_percent	) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";
        await query(sql, [
          data.data.id,
          expirytime,
          coin.sellTicker,
          coin.getTicker,
          sellname,
          getname,
          sellcoinnetwork,
          getcoinnetwork,
          selllogo,
          getlogo,
          amount,
          data.data.receiveAmount,
          data.data.sendTag,
          extraid,
          refextraid,
          "Awaiting Deposit",
          recieving_Address,
          refund_Address,
          data.data.sendAddress,
          email,
          profit,
        ]);

        return res.status(200).json({
          transaction_id: data.data.id,
          sell_coin: sell,
          get_coin: get,
          sell_amount: amount,
          get_amount: data.data.receiveAmount,
          recipient_extraid: extraid,
          refund_extraid: refextraid,
          status: "Awaiting Deposit",
          recipient_address: recieving_Address,
          refund_address: refund_Address,
          deposit_address: data.data.sendAddress,
          deposit_extraid: data.data.sendTag ? data.data.sendTag : null,
          email: email,
          transaction_type: "Floating",
        });
      }
    } catch (error) {
      const stringResponse = JSON.stringify(data);
      const requestBody = JSON.stringify(options);
      const proxyRequestBody = JSON.stringify(req.body);
      logger.error(
        `Error: ${error} || response${stringResponse} requestURL:${url}, reauestBody${requestBody} proxyRequestBody:${proxyRequestBody}`
      );
      //Exchange response invalid
      return res.status(502).json({ message: error.message });
    }
  };

  // *********************** Fixed Transactions ************************* //

  static changellyFixedTransaction = async (req, res) => {
    const {
      sell,
      get,
      sellname,
      getname,
      sellcoinnetwork,
      getcoinnetwork,
      selllogo,
      getlogo,
      amount,
      recieving_Address,
      refund_Address,
      mail,
      rateId,
      extraid,
      refextraid,
      expirytime,
    } = req.body;

    const email = checkEmailValidation(mail) ? email : null;

    let coin = {
      sellTicker: null,
      getTicker: null,
      sellNetwork: null,
      getNetwork: null,
    };

    let sellCoinObj, getCoinObj;
    try {
      sellCoinObj = await fetchCoinFromDB(sell, "changelly");
      getCoinObj = await fetchCoinFromDB(get, "changelly");
    } catch (error) {
      console.log(error);
      return res.status(502).json({ message: error.message });
    }

    coin.sellTicker = sellCoinObj.ticker;
    coin.getTicker = getCoinObj.ticker;
    coin.sellNetwork = sellCoinObj.network;
    coin.getNetwork = getCoinObj.network;

    let profit = await calculateProfitInBTC("changelly", sell, amount, "Fixed");
    if (!profit) {
      profit = 0;
    }
    // Create the logger
    const logger = createLogger({
      format: combine(timestamp(), logFormat),
      transports: [
        new transports.Console(),
        new transports.File({
          filename: "./logs/exchangeErrorLogs/changelly.log",
        }),
      ],
    });

    const privateKeyString = process.env.CHANGELLY_PRIVATE_KEY;
    const privateKey = crypto.createPrivateKey({
      key: privateKeyString,
      format: "der",
      type: "pkcs8",
      encoding: "hex",
    });

    const publicKey = crypto.createPublicKey(privateKey).export({
      type: "pkcs1",
      format: "der",
    });

    const message = {
      jsonrpc: "2.0",
      id: "test",
      method: "createFixTransaction",
      params: {
        from: coin.sellTicker,
        to: coin.getTicker,
        address: recieving_Address,
        extraId: extraid,
        amountFrom: amount,
        rateId: rateId,
        refundAddress: refund_Address,
        refundExtraId: refextraid,
      },
    };

    if (refextraid === "") {
      // Remove refundExtraId property from params
      delete message.params.refundExtraId;
    }

    if (extraid === "") {
      // Remove refundExtraId property from params
      delete message.params.extraId;
    }

    const signature = crypto.sign(
      "sha256",
      Buffer.from(JSON.stringify(message)),
      {
        key: privateKey,
        type: "pkcs8",
        format: "der",
      }
    );

    const paramy = {
      method: "POST",
      url: "https://api.changelly.com/v2",
      headers: {
        "Content-Type": "application/json",
        "X-Api-Key": crypto
          .createHash("sha256")
          .update(publicKey)
          .digest("base64"),
        "X-Api-Signature": signature.toString("base64"),
      },
      body: JSON.stringify(message),
    };

    request(paramy, async function (error, response) {
      if (error) {
        return res.status(502).json({ message: error.message });
      }

      const data = await JSON.parse(response.body);

      if (data.error) {
        const errorString = JSON.stringify(data.error);
        const responseString = JSON.stringify(data);
        const requestBody = JSON.stringify(paramy);
        const proxyRequestBody = JSON.stringify(req.body);
        logger.error(
          `Error: ${errorString} || response:${responseString} requestURL:https://api.changelly.com/v2, reauestBody${requestBody} proxyRequestBody:${proxyRequestBody}`
        );
        if (data.error?.message === "Address is not valid") {
          return res
            .status(422)
            .json({ success: false, message: "Invalid withdrawal address" });
        }

        if (
          data.error?.message ===
          "rateId was expired or already used. Use method getFixRate to generate new rateId"
        ) {
          return res.status(404).json({
            success: false,
            message:
              "Fixed rate has expired for this offer. Please select another offer.",
          });
        }

        return res.status(404).json({
          success: false,
          message: "Request failed with an unkown error from exchange",
        });
      }

      try {
        if (data.result.id) {
          var sql =
            "INSERT INTO changelly_transactions(transaction_id, expiry_time,	sell_coin,	get_coin, sell_coin_name, get_coin_name, sell_coin_network, get_coin_network, sell_coin_logo, get_coin_logo,	sell_amount,	get_amount, deposit_extraid,	recipient_extraid,	refund_extraid,	status, recipient_address, refund_address, deposit_address, email, transaction_type, average_profit_percent	) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";
          await query(sql, [
            data.result.id,
            expirytime,
            coin.sellTicker,
            coin.getTicker,
            sellname,
            getname,
            sellcoinnetwork,
            getcoinnetwork,
            selllogo,
            getlogo,
            amount,
            data.result.amountExpectedTo,
            data.result.payinExtraId,
            extraid,
            refextraid,
            data.result.status,
            recieving_Address,
            refund_Address,
            data.result.payinAddress,
            email,
            "Fixed",
            profit,
          ]);
        }
        return res.status(200).json({
          transaction_id: data.result.id,
          sell_coin: sell,
          get_coin: get,
          sell_amount: amount,
          get_amount: data.result.amountExpectedTo,
          recipient_extraid: extraid,
          refund_extraid: refextraid,
          status: data.result.status,
          recipient_address: recieving_Address,
          refund_address: refund_Address,
          deposit_address: data.result.payinAddress,
          deposit_extraid: data.result.payinExtraId
            ? data.result.payinExtraId
            : null,
          email: email,
          transaction_type: "Fixed",
        });
      } catch (error) {
        const stringData = JSON.stringify(data);
        const requestBody = JSON.stringify(paramy);
        const proxyRequestBody = JSON.stringify(req.body);
        logger.error(
          `Error: ${error}, response:${stringData} || requestURL:https://api.changelly.com/v2, reauestBody${requestBody} proxyRequestBody:${proxyRequestBody}`
        );
        return res.status(502).json({ message: error.message });
      }
    });
  };

  static changenowFixedTransaction = async (req, res) => {
    const {
      sell,
      get,
      sellname,
      getname,
      sellcoinnetwork,
      getcoinnetwork,
      selllogo,
      getlogo,
      amount,
      recieving_Address,
      refund_Address,
      mail,
      rateId,
      extraid,
      refextraid,
      expirytime,
    } = req.body;

    const email = checkEmailValidation(mail) ? email : null;

    let coin = {
      sellTicker: null,
      getTicker: null,
      sellNetwork: null,
      getNetwork: null,
    };

    let sellCoinObj, getCoinObj;
    try {
      sellCoinObj = await fetchCoinFromDB(sell, "changenow");
      getCoinObj = await fetchCoinFromDB(get, "changenow");
    } catch (error) {
      return res.status(502).json({ message: error.message });
    }

    coin.sellTicker = sellCoinObj.ticker;
    coin.getTicker = getCoinObj.ticker;
    coin.sellNetwork = sellCoinObj.network;
    coin.getNetwork = getCoinObj.network;

    let profit = await calculateProfitInBTC("changenow", sell, amount, "Fixed");
    if (!profit) {
      profit = 0;
    }
    // Create the logger
    const logger = createLogger({
      format: combine(timestamp(), logFormat),
      transports: [
        new transports.Console(),
        new transports.File({
          filename: "./logs/exchangeErrorLogs/changenow.log",
        }),
      ],
    });

    let data, url, options;
    try {
      url = `https://api.changenow.io/v2/exchange`;

      const params = {
        fromCurrency: coin.sellTicker,
        fromNetwork: coin.sellNetwork,
        toCurrency: coin.getTicker,
        toNetwork: coin.getNetwork,
        fromAmount: amount,
        toAmount: "",
        address: recieving_Address,
        extraId: extraid,
        refundAddress: refund_Address,
        refundExtraId: refextraid,
        userId: "",
        payload: "",
        contactEmail: "",
        flow: "fixed-rate",
        type: "direct",
        rateId: rateId,
      };

      options = {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-changenow-api-key": process.env.CHANGENOW,
        },
        body: JSON.stringify(params),
      };

      const response = await fetch(url, options);
      data = await response.json();
    } catch (error) {
      return res.status(502).json({ message: error.message });
    }

    //Exchange Api error
    if (data.error) {
      const errorString = JSON.stringify(data.error);
      const stringResponse = JSON.stringify(data);
      const requestBody = JSON.stringify(options);
      const proxyRequestBody = JSON.stringify(req.body);
      logger.error(
        `Error: ${errorString} || response${stringResponse} requestURL:${url}, reauestBody${requestBody} proxyRequestBody:${proxyRequestBody}`
      );
      if (data.error === "not_valid_address") {
        return res
          .status(422)
          .json({ success: false, message: "Invalid withdrawal address" });
      }

      if (data.error === "rate_id_not_found_or_expired") {
        return res.status(404).json({
          success: false,
          message:
            "Fixed rate has expired for this offer. Please select another offer.",
        });
      }

      return res.status(404).json({
        success: false,
        message: "Request failed with an unkown error from exchange",
      });
    }
    try {
      if (data.id) {
        var sql =
          "INSERT INTO changenow_transactions(transaction_id, expiry_time,	sell_coin,	get_coin, sell_coin_name, get_coin_name, sell_coin_network, get_coin_network, sell_coin_logo, get_coin_logo,	sell_amount,	get_amount, deposit_extraid,	recipient_extraid,	refund_extraid, status,  recipient_address, refund_address, deposit_address, email, transaction_type, average_profit_percent	) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";
        await query(sql, [
          data.id,
          expirytime,
          coin.sellTicker,
          coin.getTicker,
          sellname,
          getname,
          sellcoinnetwork,
          getcoinnetwork,
          selllogo,
          getlogo,
          amount,
          data.toAmount,
          data.payinExtraId,
          extraid,
          refextraid,
          "waiting",
          recieving_Address,
          refund_Address,
          data.payinAddress,
          email,
          "Fixed",
          profit,
        ]);

        return res.status(200).json({
          transaction_id: data.id,
          sell_coin: sell,
          get_coin: get,
          sell_amount: amount,
          get_amount: data.toAmount,
          recipient_extraid: extraid,
          refund_extraid: refextraid,
          status: data.status,
          recipient_address: recieving_Address,
          refund_address: refund_Address,
          deposit_address: data.payinAddress,
          deposit_extraid: data.payinExtraId ? data.payinExtraId : null,
          email: email,
          transaction_type: "Fixed",
        });
      }
    } catch (error) {
      const stringResponse = JSON.stringify(data);
      const requestBody = JSON.stringify(options);
      const proxyRequestBody = JSON.stringify(req.body);
      logger.error(
        `Error: ${error} || response${stringResponse} requestURL:${url}, reauestBody${requestBody} proxyRequestBody:${proxyRequestBody}`
      );
      //Exchange response invalid
      return res.status(502).json({ message: error.message });
    }
  };

  static changeheroFixedTransaction = async (req, res) => {
    const {
      sell,
      get,
      sellname,
      getname,
      sellcoinnetwork,
      getcoinnetwork,
      selllogo,
      getlogo,
      amount,
      recieving_Address,
      refund_Address,
      mail,
      rateId,
      extraid,
      refextraid,
      expirytime,
    } = req.body;

    const email = checkEmailValidation(mail) ? email : null;

    let coin = {
      sellTicker: null,
      getTicker: null,
      sellNetwork: null,
      getNetwork: null,
    };

    let sellCoinObj, getCoinObj;
    try {
      sellCoinObj = await fetchCoinFromDB(sell, "changehero");
      getCoinObj = await fetchCoinFromDB(get, "changehero");
    } catch (error) {
      return res.status(502).json({ message: error.message });
    }

    coin.sellTicker = sellCoinObj.ticker;
    coin.getTicker = getCoinObj.ticker;
    coin.sellNetwork = sellCoinObj.network;
    coin.getNetwork = getCoinObj.network;

    let profit = await calculateProfitInBTC(
      "changehero",
      sell,
      amount,
      "Fixed"
    );
    if (!profit) {
      profit = 0;
    }
    // Create the logger
    const logger = createLogger({
      format: combine(timestamp(), logFormat),
      transports: [
        new transports.Console(),
        new transports.File({
          filename: "./logs/exchangeErrorLogs/changehero.log",
        }),
      ],
    });

    let data, options, url;
    try {
      url = "https://api.changehero.io/v2/";
      const params = {
        jsonrpc: "2.0",
        method: "createFixTransaction",
        params: {
          rateId: rateId,
          from: coin.sellTicker,
          to: coin.getTicker,
          address: recieving_Address,
          extraId: extraid,
          amount: amount,
          refundAddress: refund_Address,
          refundExtraId: refextraid,
        },
      };
      options = {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "api-key": `${process.env.CHANGEHERO}`,
        },
        body: JSON.stringify(params),
      };

      const response = await fetch(url, options);
      data = await response.json();
    } catch (error) {
      return res.status(502).json({ message: error.message });
    }

    if (data.error) {
      const errorString = JSON.stringify(data.error);
      const stringResponse = JSON.stringify(data);
      const requestBody = JSON.stringify(options);
      const proxyRequestBody = JSON.stringify(req.body);
      logger.error(
        `Error: ${errorString} || response${stringResponse} requestURL:${url}, reauestBody${requestBody} proxyRequestBody:${proxyRequestBody}`
      );

      if (data.error.message === "Invalid address") {
        return res
          .status(422)
          .json({ success: false, message: "Invalid withdrawal address" });
      }

      if (data.error.message === "Invalid refund address") {
        return res
          .status(422)
          .json({ success: false, message: "Invalid refund address" });
      }

      if (data.error?.message === "expired rate id") {
        return res.status(404).json({
          success: false,
          message:
            "Fixed rate has expired for this offer. Please select another offer.",
        });
      }

      return res.status(404).json({
        success: false,
        message: "Request failed with an unkown error from exchange",
      });
    }

    try {
      if (data.result.id) {
        var sql =
          "INSERT INTO changehero_transactions(transaction_id, expiry_time,	sell_coin,	get_coin, sell_coin_name, get_coin_name, sell_coin_network, get_coin_network, sell_coin_logo, get_coin_logo,	sell_amount,	get_amount, deposit_extraid,	recipient_extraid,	refund_extraid, status, recipient_address, refund_address, deposit_address, email, transaction_type, average_profit_percent	) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";
        await query(sql, [
          data.result.id,
          expirytime,
          coin.sellTicker,
          coin.getTicker,
          sellname,
          getname,
          sellcoinnetwork,
          getcoinnetwork,
          selllogo,
          getlogo,
          amount,
          data.result.amountExpectedTo,
          data.result.payinExtraId,
          extraid,
          refextraid,
          data.result.status,
          recieving_Address,
          refund_Address,
          data.result.payinAddress,
          email,
          "Fixed",
          profit,
        ]);

        return res.status(200).json({
          transaction_id: data.result.id,
          sell_coin: sell,
          get_coin: get,
          sell_amount: amount,
          get_amount: data.result.amountExpectedTo,
          recipient_extraid: extraid,
          refund_extraid: refextraid,
          status: data.result.status,
          recipient_address: recieving_Address,
          refund_address: refund_Address,
          deposit_address: data.result.payinAddress,
          deposit_extraid: data.result.payinExtraId
            ? data.result.payinExtraId
            : null,
          email: email,
          transaction_type: "Fixed",
        });
      }
    } catch (error) {
      const stringResponse = JSON.stringify(data);
      const requestBody = JSON.stringify(options);
      const proxyRequestBody = JSON.stringify(req.body);
      logger.error(
        `Error: ${error} || response${stringResponse} requestURL:${url}, reauestBody${requestBody} proxyRequestBody:${proxyRequestBody}`
      );
      //Exchange response invalid
      return res.status(502).json({ message: error.message });
    }
  };

  static stealthexFixedTransaction = async (req, res) => {
    const {
      sell,
      get,
      sellname,
      getname,
      sellcoinnetwork,
      getcoinnetwork,
      selllogo,
      getlogo,
      amount,
      recieving_Address,
      refund_Address,
      mail,
      rateId,
      extraid,
      refextraid,
      expirytime,
    } = req.body;

    const email = checkEmailValidation(mail) ? email : null;

    let coin = {
      sellTicker: null,
      getTicker: null,
      sellNetwork: null,
      getNetwork: null,
    };

    let sellCoinObj, getCoinObj;
    try {
      sellCoinObj = await fetchCoinFromDB(sell, "stealthex");
      getCoinObj = await fetchCoinFromDB(get, "stealthex");
    } catch (error) {
      return res.status(502).json({ message: error.message });
    }

    coin.sellTicker = sellCoinObj.ticker;
    coin.getTicker = getCoinObj.ticker;
    coin.sellNetwork = sellCoinObj.network;
    coin.getNetwork = getCoinObj.network;

    let profit = await calculateProfitInBTC("stealthex", sell, amount, "Fixed");
    if (!profit) {
      profit = 0;
    }
    // Create the logger
    const logger = createLogger({
      format: combine(timestamp(), logFormat),
      transports: [
        new transports.Console(),
        new transports.File({
          filename: "./logs/exchangeErrorLogs/stealthex.log",
        }),
      ],
    });

    let data, url, options;
    try {
      url = `https://api.stealthex.io/api/v2/exchange?api_key=${process.env.STEALTHEX}`;

      const params = {
        currency_from: coin.sellTicker,
        currency_to: coin.getTicker,
        address_to: recieving_Address,
        extra_id_to: extraid,
        amount_from: amount,
        fixed: true,
        refund_address: refund_Address,
        refund_extra_id: refextraid,
        api_key: process.env.STEALTHEX,
        rate_id: rateId,
      };

      options = {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(params),
      };

      const response = await fetch(url, options);
      data = await response.json();
    } catch (error) {
      return res.status(502).json({ message: error.message });
    }

    if (data.err) {
      const errorString = JSON.stringify(data.err);
      const stringResponse = JSON.stringify(data);
      const requestBody = JSON.stringify(options);
      const proxyRequestBody = JSON.stringify(req.body);
      logger.error(
        `Error: ${errorString} || response${stringResponse} requestURL:${url}, reauestBody${requestBody} proxyRequestBody:${proxyRequestBody}`
      );
      if (data.err?.details === "Invalid address") {
        return res
          .status(422)
          .json({ success: false, message: "Invalid withdrawal address" });
      }

      if (data.err.details === "Received expired or nonexistent rate id") {
        return res.status(404).json({
          success: false,
          message:
            "Fixed rate has expired for this offer. Please select another offer.",
        });
      }

      return res.status(404).json({
        success: false,
        message: "Request failed with an unkown error from exchange",
      });
    }

    try {
      if (data.id) {
        var sql =
          "INSERT INTO stealthex_transactions(transaction_id, expiry_time,	sell_coin,	get_coin, sell_coin_name, get_coin_name, sell_coin_network, get_coin_network, sell_coin_logo, get_coin_logo,	sell_amount,	get_amount, deposit_extraid,	recipient_extraid,	refund_extraid, status, recipient_address, refund_address, deposit_address, email, transaction_type, average_profit_percent	) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";
        await query(sql, [
          data.id,
          expirytime,
          coin.sellTicker,
          coin.getTicker,
          sellname,
          getname,
          sellcoinnetwork,
          getcoinnetwork,
          selllogo,
          getlogo,
          amount,
          data.amount_to,
          data.extra_id_from,
          extraid,
          refextraid,
          data.status,
          recieving_Address,
          refund_Address,
          data.address_from,
          email,
          "Fixed",
          profit,
        ]);

        return res.status(200).json({
          transaction_id: data.id,
          sell_coin: sell,
          get_coin: get,
          sell_amount: amount,
          get_amount: data.amount_to,
          recipient_extraid: extraid,
          refund_extraid: refextraid,
          status: data.status,
          recipient_address: recieving_Address,
          refund_address: refund_Address,
          deposit_address: data.address_from,
          deposit_extraid: data.extra_id_from ? data.extra_id_from : null,
          email: email,
          transaction_type: "Fixed",
        });
      }
    } catch (error) {
      const stringResponse = JSON.stringify(data);
      const requestBody = JSON.stringify(options);
      const proxyRequestBody = JSON.stringify(req.body);
      logger.error(
        `Error: ${error} || response${stringResponse} requestURL:${url}, reauestBody${requestBody} proxyRequestBody:${proxyRequestBody}`
      );
      //Exchange response invalid
      return res.status(502).json({ message: error.message });
    }
  };

  static exolixFixedTransaction = async (req, res) => {
    const {
      sell,
      get,
      sellname,
      getname,
      sellcoinnetwork,
      getcoinnetwork,
      selllogo,
      getlogo,
      amount,
      recieving_Address,
      refund_Address,
      mail,
      rateId,
      extraid,
      refextraid,
      expirytime,
    } = req.body;

    const email = checkEmailValidation(mail) ? email : null;

    let coin = {
      sellTicker: null,
      getTicker: null,
      sellNetwork: null,
      getNetwork: null,
    };

    let sellCoinObj, getCoinObj;
    try {
      sellCoinObj = await fetchCoinFromDB(sell, "exolix");
      getCoinObj = await fetchCoinFromDB(get, "exolix");
    } catch (error) {
      return res.status(502).json({ message: error.message });
    }

    coin.sellTicker = sellCoinObj.ticker;
    coin.getTicker = getCoinObj.ticker;
    coin.sellNetwork = sellCoinObj.network;
    coin.getNetwork = getCoinObj.network;

    let profit = await calculateProfitInBTC("exolix", sell, amount, "Fixed");
    if (!profit) {
      profit = 0;
    }

    // Create the logger
    const logger = createLogger({
      format: combine(timestamp(), logFormat),
      transports: [
        new transports.Console(),
        new transports.File({
          filename: "./logs/exchangeErrorLogs/exolix.log",
        }),
      ],
    });

    let data, options, url;
    try {
      url = "https://exolix.com/api/v2/transactions";

      const params = {
        coinFrom: coin.sellTicker,
        networkFrom: coin.sellNetwork,
        coinTo: coin.getTicker,
        networkTo: coin.getNetwork,
        amount: amount,
        withdrawalAddress: recieving_Address,
        withdrawalExtraId: extraid,
        rateType: "fixed",
        refundAddress: refund_Address,
        refundExtraId: refextraid,
      };

      options = {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: process.env.EXOLIX,
        },
        body: JSON.stringify(params),
      };

      const response = await fetch(url, options);
      data = await response.json();
    } catch (error) {
      return res.status(502).json({ message: error.message });
    }

    if (data.error || data.message) {
      const stringResponse = JSON.stringify(data);
      const requestBody = JSON.stringify(options);
      const proxyRequestBody = JSON.stringify(req.body);
      logger.error(
        `Error: ${stringResponse} || response${stringResponse} requestURL:${url}, reauestBody${requestBody} proxyRequestBody:${proxyRequestBody}`
      );
      if (data.error === "Invalid withdrawal address") {
        return res
          .status(422)
          .json({ success: false, message: "Invalid withdrawal address" });
      } else {
        return res.status(404).json({
          success: false,
          message: "Request failed with an unkown error from exchange",
        });
      }
    }

    try {
      if (data.id) {
        var sql =
          "INSERT INTO exolix_transactions(transaction_id, expiry_time,	sell_coin,	get_coin, sell_coin_name, get_coin_name, sell_coin_network, get_coin_network, sell_coin_logo, get_coin_logo,	sell_amount,	get_amount, deposit_extraid,	recipient_extraid,	refund_extraid, status, recipient_address, refund_address, deposit_address, email, transaction_type, average_profit_percent	) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";
        await query(sql, [
          data.id,
          expirytime,
          coin.sellTicker,
          coin.getTicker,
          sellname,
          getname,
          sellcoinnetwork,
          getcoinnetwork,
          selllogo,
          getlogo,
          amount,
          data.amountTo,
          data.depositExtraId,
          extraid,
          refextraid,
          data.status,
          recieving_Address,
          refund_Address,
          data.depositAddress,
          email,
          "Fixed",
          profit,
        ]);

        return res.status(200).json({
          transaction_id: data.id,
          sell_coin: sell,
          get_coin: get,
          sell_amount: amount,
          get_amount: data.amountTo,
          recipient_extraid: extraid,
          refund_extraid: refextraid,
          status: data.status,
          recipient_address: recieving_Address,
          refund_address: refund_Address,
          deposit_address: data.depositAddress,
          deposit_extraid: data.depositExtraId ? data.depositExtraId : null,
          email: email,
          transaction_type: "Fixed",
        });
      }
    } catch (error) {
      const stringResponse = JSON.stringify(data);
      const requestBody = JSON.stringify(options);
      const proxyRequestBody = JSON.stringify(req.body);
      logger.error(
        `Error: ${error} || response${stringResponse} requestURL:${url}, reauestBody${requestBody} proxyRequestBody:${proxyRequestBody}`
      );
      //Exchange response invalid
      return res.status(502).json({ message: error.message });
    }
  };

  static simpleswapFixedTransaction = async (req, res) => {
    const {
      sell,
      get,
      sellname,
      getname,
      sellcoinnetwork,
      getcoinnetwork,
      selllogo,
      getlogo,
      amount,
      recieving_Address,
      refund_Address,
      mail,
      rateId,
      extraid,
      refextraid,
      expirytime,
    } = req.body;

    const email = checkEmailValidation(mail) ? email : null;

    let coin = {
      sellTicker: null,
      getTicker: null,
      sellNetwork: null,
      getNetwork: null,
    };

    let sellCoinObj, getCoinObj;
    try {
      sellCoinObj = await fetchCoinFromDB(sell, "simpleswap");
      getCoinObj = await fetchCoinFromDB(get, "simpleswap");
    } catch (error) {
      return res.status(502).json({ message: error.message });
    }

    coin.sellTicker = sellCoinObj.ticker;
    coin.getTicker = getCoinObj.ticker;
    coin.sellNetwork = sellCoinObj.network;
    coin.getNetwork = getCoinObj.network;

    let profit = await calculateProfitInBTC(
      "simpleswap",
      sell,
      amount,
      "Fixed"
    );
    if (!profit) {
      profit = 0;
    }
    // Create the logger
    const logger = createLogger({
      format: combine(timestamp(), logFormat),
      transports: [
        new transports.Console(),
        new transports.File({
          filename: "./logs/exchangeErrorLogs/simpleswap.log",
        }),
      ],
    });

    let data, url, options;
    try {
      url = `https://api.simpleswap.io/create_exchange?api_key=${process.env.SIMPLESWAP}`;

      const params = {
        fixed: true,
        currency_from: coin.sellTicker,
        currency_to: coin.getTicker,
        amount: amount,
        address_to: recieving_Address,
        extra_id_to: extraid,
        extra_id: extraid,
        user_refund_address: refund_Address,
        user_refund_extra_id: refextraid,
      };
      options = {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          api_key: process.env.SIMPLESWAP,
        },
        body: JSON.stringify(params),
      };
      const response = await fetch(url, options);
      data = await response.json();
    } catch (error) {
      return res.status(502).json({ message: error.message });
    }

    if (data.error) {
      const errorString = JSON.stringify(data.error);
      const stringResponse = JSON.stringify(data);
      const requestBody = JSON.stringify(options);
      const proxyRequestBody = JSON.stringify(req.body);
      logger.error(
        `Error: ${errorString} || response${stringResponse} requestURL:${url}, reauestBody${requestBody} proxyRequestBody:${proxyRequestBody}`
      );
      if (data.description === "Validation of 'address_to' failed") {
        return res
          .status(422)
          .json({ success: false, message: "Invalid withdrawal address" });
      }
      return res.status(404).json({
        success: false,
        message: "Request failed with an unkown error from exchange",
      });
    }

    try {
      if (data.id) {
        var sql =
          "INSERT INTO simpleswap_transactions(transaction_id, expiry_time,	sell_coin,	get_coin, sell_coin_name, get_coin_name, sell_coin_network, get_coin_network, sell_coin_logo, get_coin_logo,	sell_amount,	get_amount, deposit_extraid,	recipient_extraid,	refund_extraid, status, recipient_address, refund_address, deposit_address, email, transaction_type, average_profit_percent	) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";
        await query(sql, [
          data.id,
          expirytime,
          coin.sellTicker,
          coin.getTicker,
          sellname,
          getname,
          sellcoinnetwork,
          getcoinnetwork,
          selllogo,
          getlogo,
          amount,
          data.amount_to,
          data.extra_id_from,
          extraid,
          refextraid,
          data.status,
          recieving_Address,
          refund_Address,
          data.address_from,
          email,
          "Fixed",
          profit,
        ]);

        return res.status(200).json({
          transaction_id: data.id,
          sell_coin: sell,
          get_coin: get,
          sell_amount: amount,
          get_amount: data.amount_to,
          recipient_extraid: extraid,
          refund_extraid: refextraid,
          status: data.status,
          recipient_address: recieving_Address,
          refund_address: refund_Address,
          deposit_address: data.address_from,
          deposit_extraid: data.extra_id_from ? data.extra_id_from : null,
          email: email,
          transaction_type: "Fixed",
        });
      }
    } catch (error) {
      const stringResponse = JSON.stringify(data);
      const requestBody = JSON.stringify(options);
      const proxyRequestBody = JSON.stringify(req.body);
      logger.error(
        `Error: ${error} || response${stringResponse} requestURL:${url}, reauestBody${requestBody} proxyRequestBody:${proxyRequestBody}`
      );
      //Exchange response invalid
      return res.status(502).json({ message: error.message });
    }
  };

  static godexFixedTransaction = async (req, res) => {
    const {
      sell,
      get,
      sellname,
      getname,
      sellcoinnetwork,
      getcoinnetwork,
      selllogo,
      getlogo,
      amount,
      recieving_Address,
      refund_Address,
      mail,
      rateId,
      extraid,
      refextraid,
      expirytime,
    } = req.body;

    const email = checkEmailValidation(mail) ? email : null;

    let coin = {
      sellTicker: null,
      getTicker: null,
      sellNetwork: null,
      getNetwork: null,
    };

    let sellCoinObj, getCoinObj;
    try {
      sellCoinObj = await fetchCoinFromDB(sell, "godex");
      getCoinObj = await fetchCoinFromDB(get, "godex");
    } catch (error) {
      return res.status(502).json({ message: error.message });
    }

    coin.sellTicker = sellCoinObj.ticker;
    coin.getTicker = getCoinObj.ticker;
    coin.sellNetwork = sellCoinObj.network;
    coin.getNetwork = getCoinObj.network;

    let profit = await calculateProfitInBTC("godex", sell, amount, "Fixed");
    if (!profit) {
      profit = 0;
    }
    // Create the logger
    const logger = createLogger({
      format: combine(timestamp(), logFormat),
      transports: [
        new transports.Console(),
        new transports.File({ filename: "./logs/exchangeErrorLogs/godex.log" }),
      ],
    });

    let data, options, url;
    try {
      const url = "https://api.godex.io/api/v1/transaction";
      const params = {
        coin_from: coin.sellTicker,
        coin_to: coin.getTicker,
        deposit_amount: amount,
        withdrawal: recieving_Address,
        withdrawal_extra_id: extraid != undefined ? extraid : "",
        return: refund_Address,
        return_extra_id: refextraid != undefined ? refextraid : "",
        affiliate_id: process.env.GODEX_AFFILIATE_ID,
        float: false,
      };
      options = {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          "public-key": process.env.GODEX,
        },
        body: JSON.stringify(params),
      };
      const response = await fetch(url, options);
      data = await response.json();
    } catch (error) {
      return res.status(502).json({ message: error.message });
    }

    if (data.error) {
      const errorString = JSON.stringify(data.validation);
      const stringResponse = JSON.stringify(data);
      const requestBody = JSON.stringify(options);
      const proxyRequestBody = JSON.stringify(req.body);
      logger.error(
        `Error: ${errorString} || response${stringResponse} requestURL:${url}, reauestBody${requestBody} proxyRequestBody:${proxyRequestBody}`
      );
      if (data.error?.validation?.withdrawal) {
        return res
          .status(422)
          .json({ success: false, message: "Invalid withdrawal address" });
      }

      return res.status(404).json({
        success: false,
        message: "Request failed with an unkown error from exchange",
      });
    }

    try {
      if (data.transaction_id) {
        var sql =
          "INSERT INTO godex_transactions(transaction_id, expiry_time,	sell_coin,	get_coin, sell_coin_name, get_coin_name, sell_coin_network, get_coin_network, sell_coin_logo, get_coin_logo,	sell_amount,	get_amount, deposit_extraid,	recipient_extraid,	refund_extraid, status, recipient_address, refund_address, deposit_address, email, transaction_type, average_profit_percent	) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";
        await query(sql, [
          data.transaction_id,
          expirytime,
          coin.sellTicker,
          coin.getTicker,
          sellname,
          getname,
          sellcoinnetwork,
          getcoinnetwork,
          selllogo,
          getlogo,
          amount,
          data.withdrawal_amount,
          data.deposit_extra_id,
          extraid,
          refextraid,
          data.status,
          recieving_Address,
          refund_Address,
          data.deposit,
          email,
          "Fixed",
          profit,
        ]);

        return res.status(200).json({
          transaction_id: data.transaction_id,
          sell_coin: sell,
          get_coin: get,
          sell_amount: amount,
          get_amount: data.withdrawal_amount,
          recipient_extraid: extraid,
          refund_extraid: refextraid,
          status: data.status,
          recipient_address: recieving_Address,
          refund_address: refund_Address,
          deposit_address: data.deposit,
          deposit_extraid: data.deposit_extra_id ? data.deposit_extra_id : null,
          email: email,
          transaction_type: "Fixed",
        });
      }
    } catch (error) {
      const stringResponse = JSON.stringify(data);
      const requestBody = JSON.stringify(options);
      const proxyRequestBody = JSON.stringify(req.body);
      logger.error(
        `Error: ${error} || response${stringResponse} requestURL:${url}, reauestBody${requestBody} ${proxyRequestBody}`
      );
      //Exchange response invalid
      return res.status(502).json({ message: error.message });
    }
  };

  static letsexchangeFixedTransaction = async (req, res) => {
    const {
      sell,
      get,
      sellname,
      getname,
      sellcoinnetwork,
      getcoinnetwork,
      selllogo,
      getlogo,
      amount,
      recieving_Address,
      refund_Address,
      mail,
      rateId,
      extraid,
      refextraid,
      expirytime,
    } = req.body;

    const email = checkEmailValidation(mail) ? email : null;

    let coin = {
      sellTicker: null,
      getTicker: null,
      sellNetwork: null,
      getNetwork: null,
    };

    let sellCoinObj, getCoinObj;
    try {
      sellCoinObj = await fetchCoinFromDB(sell, "letsexchange");
      getCoinObj = await fetchCoinFromDB(get, "letsexchange");
    } catch (error) {
      return res.status(502).json({ message: error.message });
    }

    coin.sellTicker = sellCoinObj.ticker;
    coin.getTicker = getCoinObj.ticker;
    coin.sellNetwork = sellCoinObj.network;
    coin.getNetwork = getCoinObj.network;

    let profit = await calculateProfitInBTC(
      "letsexchange",
      sell,
      amount,
      "Floating"
    );
    if (!profit) {
      profit = 0;
    }

    // Create the logger
    const logger = createLogger({
      format: combine(timestamp(), logFormat),
      transports: [
        new transports.Console(),
        new transports.File({
          filename: "./logs/exchangeErrorLogs/letsexchange.log",
        }),
      ],
    });

    let data, url, options;
    try {
      url = "https://api.letsexchange.io/api/v1/transaction";
      const params = {
        float: false,
        coin_from: coin.sellTicker,
        coin_to: coin.getTicker,
        deposit_amount: amount,
        withdrawal: recieving_Address,
        withdrawal_extra_id: extraid != undefined ? extraid : "",
        return: refund_Address,
        return_extra_id: refextraid,
        rate_id: rateId,
        affiliate_id: process.env.LETSEXCHANGE_AFFILIATE_ID,
      };
      options = {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: process.env.LETSEXCHANGE,
          Accept: "application/json",
        },
        body: JSON.stringify(params),
      };
      const response = await fetch(url, options);
      data = await response.json();
    } catch (error) {
      return res.status(502).json({ message: error.message });
    }

    if (data.error) {
      const errorString = JSON.stringify(data.error);
      const stringResponse = JSON.stringify(data);
      const requestBody = JSON.stringify(options);
      const proxyRequestBody = JSON.stringify(req.body);
      logger.error(
        `Error: ${errorString} || response${stringResponse} requestURL:${url}, reauestBody${requestBody} proxyRequestBody${proxyRequestBody}`
      );
      if (data.error?.validation?.withdrawal) {
        return res
          .status(422)
          .json({ success: false, message: "Invalid withdrawal address" });
      }

      if (data.error === "Fixed rate timeout expired!") {
        return res.status(404).json({
          success: false,
          message:
            "Fixed rate has expired for this offer. Please select another offer.",
        });
      }

      return res.status(404).json({
        success: false,
        message: "Request failed with an unkown error from exchange",
      });
    }

    try {
      if (data.transaction_id) {
        var sql =
          "INSERT INTO letsexchange_transactions(transaction_id, expiry_time,	sell_coin,	get_coin, sell_coin_name, get_coin_name, sell_coin_network, get_coin_network, sell_coin_logo, get_coin_logo,	sell_amount,	get_amount, deposit_extraid,	recipient_extraid,	refund_extraid, status, recipient_address, refund_address, deposit_address, email, transaction_type, average_profit_percent	) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";
        await query(sql, [
          data.transaction_id,
          expirytime,
          coin.sellTicker,
          coin.getTicker,
          sellname,
          getname,
          sellcoinnetwork,
          getcoinnetwork,
          selllogo,
          getlogo,
          amount,
          data.withdrawal_amount,
          data.deposit_extra_id,
          extraid,
          refextraid,
          data.status,
          recieving_Address,
          refund_Address,
          data.deposit,
          email,
          "Fixed",
          profit,
        ]);

        return res.status(200).json({
          transaction_id: data.transaction_id,
          sell_coin: sell,
          get_coin: get,
          sell_amount: amount,
          get_amount: data.withdrawal_amount,
          recipient_extraid: extraid,
          refund_extraid: refextraid,
          status: data.status,
          recipient_address: recieving_Address,
          refund_address: refund_Address,
          deposit_address: data.deposit,
          deposit_extraid: data.deposit_extra_id ? data.deposit_extra_id : null,
          email: email,
          transaction_type: "Fixed",
        });
      }
    } catch (error) {
      const stringResponse = JSON.stringify(data);
      const requestBody = JSON.stringify(options);
      const proxyRequestBody = JSON.stringify(req.body);
      logger.error(
        `Error: ${error} || response${stringResponse} requestURL:${url}, reauestBody${requestBody} proxyRequestBody:${proxyRequestBody}`
      );
      //Exchange response invalid
      return res.status(502).json({ message: error.message });
    }
  };

  // *********************** Check Transaction Status ************************* //

  static checkChangellyTransactionStatus = async (req, res) => {
    const { id } = req.body;
    var sql = "SELECT * FROM changelly_transactions WHERE transaction_id=?";
    db.query(sql, [id], function (error, result) {
      if (error) {
        return res.json({ tx: [], message: "This transaction does't exist" });
      } else {
        return res.json({ tx: result[0], message: "Transaction found" });
      }
    });
  };

  static checkChangenowTransactionStatus = async (req, res) => {
    const { id } = req.body;
    var sql = "SELECT * FROM changenow_transactions WHERE transaction_id=?";
    db.query(sql, [id], function (error, result) {
      if (error) {
        return res.json({ tx: [], message: "This transaction does't exist" });
      } else {
        let transaction = result[0];
        return res.json({ tx: transaction, message: "Transaction found" });
      }
    });
  };

  static checkChangeheroTransactionStatus = async (req, res) => {
    const { id } = req.body;
    var sql = "SELECT * FROM changehero_transactions WHERE transaction_id=?";
    db.query(sql, [id], function (error, result) {
      console.log(id);
      if (error) {
        return res.json({ tx: [], message: "This transaction does't exist" });
      } else {
        console.log(result[0]);
        return res.json({ tx: result[0], message: "Transaction found" });
      }
    });
  };

  static checkExolixTransactionStatus = async (req, res) => {
    const { id } = req.body;
    var sql = "SELECT * FROM exolix_transactions WHERE transaction_id=?";
    db.query(sql, [id], function (error, result) {
      if (error) {
        return res.json({ tx: [], message: "This transaction does't exist" });
      } else {
        return res.json({ tx: result[0], message: "Transaction found" });
      }
    });
  };

  static checkLetsexchangeTransactionStatus = async (req, res) => {
    const { id } = req.body;
    var sql = "SELECT * FROM letsexchange_transactions WHERE transaction_id=?";
    db.query(sql, [id], function (error, result) {
      if (error) {
        return res.json({ tx: [], message: "This transaction does't exist" });
      } else {
        return res.json({ tx: result[0], message: "Transaction found" });
      }
    });
  };

  static checkSimpleswapTransactionStatus = async (req, res) => {
    const { id } = req.body;
    var sql = "SELECT * FROM simpleswap_transactions WHERE transaction_id=?";
    db.query(sql, [id], function (error, result) {
      if (error) {
        return res.json({ tx: [], message: "This transaction does't exist" });
      } else {
        return res.json({ tx: result[0], message: "Transaction found" });
      }
    });
  };

  static checkGodexTransactionStatus = async (req, res) => {
    const { id } = req.body;
    var sql = "SELECT * FROM godex_transactions WHERE transaction_id=?";
    db.query(sql, [id], function (error, result) {
      if (error) {
        return res.json({ tx: [], message: "This transaction does't exist" });
      } else {
        return res.json({ tx: result[0], message: "Transaction found" });
      }
    });
  };

  static checkStealthexTransactionStatus = async (req, res) => {
    const { id } = req.body;
    var sql = "SELECT * FROM stealthex_transactions WHERE transaction_id=?";
    db.query(sql, [id], function (error, result) {
      if (error) {
        return res.json({ tx: [], message: "This transaction does't exist" });
      } else {
        return res.json({ tx: result[0], message: "Transaction found" });
      }
    });
  };

  static checkEasybitTransactionStatus = async (req, res) => {
    const { id } = req.body;
    var sql = "SELECT * FROM easybit_transactions WHERE transaction_id=?";
    db.query(sql, [id], function (error, result) {
      if (error) {
        return res.json({ tx: [], message: "This transaction does't exist" });
      } else {
        return res.json({ tx: result[0], message: "Transaction found" });
      }
    });
  };

  // *********************** Check Transaction Status Using Transaction ID ************************* //

  static checkTransactionStatus = async (req, res) => {
    const { id } = req.body;
    var sql1 = "SELECT * FROM changelly_transactions WHERE transaction_id=?";
    var sql2 = "SELECT * FROM changenow_transactions WHERE transaction_id=?";
    var sql3 = "SELECT * FROM changehero_transactions WHERE transaction_id=?";
    var sql4 = "SELECT * FROM exolix_transactions WHERE transaction_id=?";
    var sql5 = "SELECT * FROM letsexchange_transactions WHERE transaction_id=?";
    var sql6 = "SELECT * FROM simpleswap_transactions WHERE transaction_id=?";
    var sql7 = "SELECT * FROM godex_transactions WHERE transaction_id=?";
    var sql8 = "SELECT * FROM stealthex_transactions WHERE transaction_id=?";
    var sql9 = "SELECT * FROM easybit_transactions WHERE transaction_id=?";

    let array = [sql1, sql2, sql3, sql4, sql5, sql6, sql7, sql8, sql9];

    let SqlPromises = array.map((sql, index) => {
      return new Promise((resolve, reject) => {
        db.query(sql, [id], function (error, result) {
          if (error) {
            return res.json({ tx: {}, message: "Transaction Not Found!" });
          } else {
            resolve(result);
          }
        });
      });
    });

    // Wait for all Promises to resolve
    const results = await Promise.all(SqlPromises);

    // Find the first non-empty result
    const transaction = results.find((result) => result.length > 0);

    if (transaction) {
      return res.json({ tx: transaction[0], message: "Transaction Found" });
    } else {
      return res.json({ tx: {}, message: "Transaction Not Found!" });
    }
  };
}

export default exchangeController;
