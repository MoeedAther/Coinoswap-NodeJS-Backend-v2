import crypto from "crypto";
import request from "request";
import fetch from "node-fetch";
import dotenv from "dotenv";
import prisma from "../database/prisma.js";
import { fetchCoinFromDB } from "../Js/functions.js";

dotenv.config();

// ==================== HELPER FUNCTIONS ====================

/**
 * Fetch partners settings from database
 * @returns {Promise<Array>} Array of partner objects with isEnabled and hasGiveAway flags
 */
async function fetchPartnersSettings() {
  try {
    const settings = await prisma.settings.findUnique({
      where: { key: "partners" },
    });

    if (!settings) {
      throw new Error("Partners settings not found");
    }

    return JSON.parse(settings.value);
  } catch (error) {
    throw new Error("Failed to fetch partners settings");
  }
}

/**
 * Check if exchange is enabled and has giveaway
 * @param {string} exchangeName - Name of the exchange
 * @param {Array} partners - Array of partner objects
 * @returns {Object} { isEnabled: boolean, hasGiveAway: boolean }
 */
function getExchangeStatus(exchangeName, partners) {
  const partner = partners.find((p) => p.name === exchangeName);
  if (!partner) {
    return { isEnabled: false, hasGiveAway: false };
  }
  return {
    isEnabled: partner.isEnabled,
    hasGiveAway: partner.hasGiveAway,
  };
}

/**
 * Increase number by percentage
 * @param {number|string} num - Base number
 * @param {number|string} perc - Percentage to increase
 * @returns {number} Increased value
 */
function increaseByPercentage(num, perc) {
  const number = parseFloat(num);
  const percentage = parseFloat(perc);
  return number * (1 + percentage / 100);
}

/**
 * Check if text contains keyword
 * @param {string} keyword - Keyword to search
 * @param {string} text - Text to search in
 * @returns {boolean} True if keyword found
 */
function findText(keyword, text) {
  return text ? text.includes(keyword) : false;
}

/**
 * Standard error response formatter
 * @param {string} exchangeName - Name of the exchange
 * @param {string} exchangeType - Type of exchange (Fixed/Floating)
 * @param {string} errorType - Type of error
 * @param {Object} rateObject - Rate object with defaults
 * @returns {Object} Formatted error response
 */
function formatErrorResponse(
  exchangeName,
  exchangeType,
  errorType,
  rateObject = null
) {
  const defaultRateObject = rateObject || {
    name: exchangeName,
    rate: 0,
    rate_id: null,
    min: 0,
    higher_min: 0,
    max: 0,
    exchangetype: exchangeType,
  };

  const errorMessages = {
    exchange_disabled: "This exchange is currently disabled",
    exchange_response_error: "Failed to fetch rate from exchange API",
    deposit_below_range: "Amount is below minimum exchange limit",
    deposit_above_range: "Amount exceeds maximum exchange limit",
    invalid_input: "Invalid request parameters",
    coin_not_found: "Cryptocurrency not found in database",
    settings_error: "Failed to fetch exchange settings",
  };

  return {
    success: false,
    data: {
      rateObject: defaultRateObject,
      hasGiveAway: false,
    },
    error: {
      code: errorType,
      message: errorMessages[errorType] || "An unexpected error occurred",
    },
  };
}

/**
 * Standard success response formatter
 * @param {Object} rateObject - Rate object with exchange data
 * @param {boolean} hasGiveAway - Whether exchange has giveaway
 * @param {string} message - Success message type
 * @returns {Object} Formatted success response
 */
function formatSuccessResponse(rateObject, hasGiveAway, message = "success") {
  return {
    success: true,
    data: {
      rateObject: {
        ...rateObject,
        hasGiveAway: hasGiveAway,
      },
    },
    message: message,
  };
}

/**
 * Validate rate request body
 * @param {Object} body - Request body
 * @returns {Object} { valid: boolean, error: string|null }
 */
function validateRateRequest(body) {
  const { sell, get, amount, exchangetype, exchange } = body;

  if (!sell || typeof sell !== "string") {
    return {
      valid: false,
      error: "sell parameter is required and must be a string (coin ticker)",
    };
  }

  if (!get || typeof get !== "string") {
    return {
      valid: false,
      error: "get parameter is required and must be a string (coin ticker)",
    };
  }

  if (!amount || isNaN(parseFloat(amount))) {
    return {
      valid: false,
      error: "amount parameter is required and must be a valid number",
    };
  }

  if (!exchangetype || !["Fixed", "Floating"].includes(exchangetype)) {
    return {
      valid: false,
      error: "exchangetype must be either 'Fixed' or 'Floating'",
    };
  }

  if (!exchange || typeof exchange !== "string") {
    return {
      valid: false,
      error: "exchange parameter is required (e.g., 'changelly', 'changenow')",
    };
  }

  const validExchanges = [
    "changelly",
    "changenow",
    "changehero",
    "simpleswap",
    "godex",
    "stealthex",
    "letsexchange",
    "exolix",
    "easybit",
  ];

  if (!validExchanges.includes(exchange)) {
    return {
      valid: false,
      error: `Invalid exchange. Must be one of: ${validExchanges.join(", ")}`,
    };
  }

  return { valid: true, error: null };
}

/**
 * Get exchange metadata (eta, kyc, rating)
 * @param {string} exchangeName - Name of the exchange
 * @returns {Object} Exchange metadata
 */
function getExchangeMetadata(exchangeName) {
  const metadata = {
    changelly: { eta: "5-30 Min", kyc: "On Occasion", rating: "3.9/5" },
    changenow: { eta: "10-60 Min", kyc: "Rarely Required", rating: "4.5/5" },
    changehero: { eta: "12-26 Min", kyc: "On Occasion", rating: "4.4/5" },
    simpleswap: { eta: "9-50 Min", kyc: "Rarely Required", rating: "4.1/5" },
    godex: { eta: "14-51 Min", kyc: "Rarely Required", rating: "4.5/5" },
    stealthex: { eta: "7-38 Min", kyc: "Rarely Required", rating: "4.4/5" },
    letsexchange: { eta: "2-44 Min", kyc: "Not Required", rating: "4.6/5" },
    exolix: { eta: "4-20 Min", kyc: "Not Required", rating: "4.3/5" },
    easybit: { eta: "2-44 Min", kyc: "On Occasion", rating: "4.7/5" },
  };

  return (
    metadata[exchangeName] || { eta: "N/A", kyc: "Unknown", rating: "N/A" }
  );
}

// ==================== RATE CONTROLLER ====================

class RateController {
  /**
   * Universal rate fetching endpoint
   * User provides: sell (ticker), get (ticker), amount, exchangetype, exchange (name)
   */
  static getRate = async (req, res) => {
    const { sell, get, amount, exchangetype, exchange } = req.body;

    try {
      // Validate request
      const validation = validateRateRequest(req.body);
      if (!validation.valid) {
        return res.status(400).json({
          success: false,
          error: {
            code: "invalid_input",
            message: validation.error,
          },
        });
      }

      // Check if exchange is enabled
      const partners = await fetchPartnersSettings();
      const { isEnabled, hasGiveAway } = getExchangeStatus(exchange, partners);

      if (!isEnabled) {
        const metadata = getExchangeMetadata(exchange);
        return res.status(403).json(
          formatErrorResponse(exchange, exchangetype, "exchange_disabled", {
            name: exchange,
            rate: 0,
            rate_id: null,
            min: 0,
            higher_min: 0,
            max: 0,
            exchangetype: exchangetype,
            ...metadata,
          })
        );
      }

      // Route to specific exchange handler
      switch (exchange) {
        case "changelly":
          return RateController.changellyRate(
            req,
            res,
            sell,
            get,
            amount,
            exchangetype,
            hasGiveAway
          );
        case "changenow":
          return RateController.changenowRate(
            req,
            res,
            sell,
            get,
            amount,
            exchangetype,
            hasGiveAway
          );
        case "changehero":
          return RateController.changeheroRate(
            req,
            res,
            sell,
            get,
            amount,
            exchangetype,
            hasGiveAway
          );
        case "stealthex":
          return RateController.stealthexRate(
            req,
            res,
            sell,
            get,
            amount,
            exchangetype,
            hasGiveAway
          );
        case "exolix":
          return RateController.exolixRate(
            req,
            res,
            sell,
            get,
            amount,
            exchangetype,
            hasGiveAway
          );
        case "simpleswap":
          return RateController.simpleswapRate(
            req,
            res,
            sell,
            get,
            amount,
            exchangetype,
            hasGiveAway
          );
        case "godex":
          return RateController.godexRate(
            req,
            res,
            sell,
            get,
            amount,
            exchangetype,
            hasGiveAway
          );
        case "letsexchange":
          return RateController.letsexchangeRate(
            req,
            res,
            sell,
            get,
            amount,
            exchangetype,
            hasGiveAway
          );
        case "easybit":
          return RateController.easybitRate(
            req,
            res,
            sell,
            get,
            amount,
            exchangetype,
            hasGiveAway
          );
        default:
          return res.status(400).json({
            success: false,
            error: {
              code: "invalid_exchange",
              message: "Exchange not supported",
            },
          });
      }
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: {
          code: "settings_error",
          message: "Failed to fetch exchange settings",
          details: error.message,
        },
      });
    }
  };

  /**
   * Changelly rate handler
   */
  static changellyRate = async (
    req,
    res,
    sell,
    get,
    amount,
    exchangetype,
    hasGiveAway
  ) => {
    const exchangeName = "changelly";
    const metadata = getExchangeMetadata(exchangeName);

    try {
      // Fetch coin data with exchange-specific ticker and network
      let coin;
      try {
        const sellCoinObj = await fetchCoinFromDB(sell, exchangeName);
        const getCoinObj = await fetchCoinFromDB(get, exchangeName);
        coin = {
          sellTicker: sellCoinObj.ticker,
          sellNetwork: sellCoinObj.network,
          getTicker: getCoinObj.ticker,
          getNetwork: getCoinObj.network,
        };
      } catch (error) {
        return res.status(404).json(
          formatErrorResponse(exchangeName, exchangetype, "coin_not_found", {
            name: exchangeName,
            rate: 0,
            rate_id: null,
            min: 0,
            higher_min: 0,
            max: 0,
            exchangetype: exchangetype,
            ...metadata,
          })
        );
      }

      // Initialize rate object
      let rateObject = {
        name: exchangeName,
        rate: 0,
        rate_id: null,
        min: 0,
        higher_min: 0,
        max: 0,
        exchangetype: exchangetype,
        ...metadata,
      };

      // Setup Changelly API authentication
      const privateKey = crypto.createPrivateKey({
        key: process.env.CHANGELLY_PRIVATE_KEY,
        format: "der",
        type: "pkcs8",
        encoding: "hex",
      });

      const publicKey = crypto.createPublicKey(privateKey).export({
        type: "pkcs1",
        format: "der",
      });

      const typeidentifier =
        exchangetype === "Floating"
          ? "getExchangeAmount"
          : "getFixRateForAmount";

      // Fetch min/max limits
      const pairsMessage = {
        jsonrpc: "2.0",
        id: "test",
        method: "getPairsParams",
        params: [
          {
            from: coin.sellTicker,
            to: coin.getTicker,
          },
        ],
      };

      const pairsSignature = crypto.sign(
        "sha256",
        Buffer.from(JSON.stringify(pairsMessage)),
        {
          key: privateKey,
          type: "pkcs8",
          format: "der",
        }
      );

      const pairsOptions = {
        method: "POST",
        url: "https://api.changelly.com/v2",
        headers: {
          "Content-Type": "application/json",
          "X-Api-Key": crypto
            .createHash("sha256")
            .update(publicKey)
            .digest("base64"),
          "X-Api-Signature": pairsSignature.toString("base64"),
        },
        body: JSON.stringify(pairsMessage),
      };

      // Get min/max limits
      try {
        const pairsData = await new Promise((resolve, reject) => {
          request(pairsOptions, (error, response, body) => {
            if (error || response.statusCode !== 200) {
              return reject(new Error("Failed to fetch limits"));
            }
            resolve(JSON.parse(body));
          });
        });

        if (
          !isNaN(pairsData.result[0].minAmountFixed) &&
          !isNaN(pairsData.result[0].maxAmountFixed)
        ) {
          rateObject.min = parseFloat(pairsData.result[0].minAmountFixed);
          rateObject.higher_min = increaseByPercentage(
            pairsData.result[0].minAmountFixed,
            2
          );
          rateObject.max = parseFloat(pairsData.result[0].maxAmountFixed);
        }
      } catch (error) {
        return res
          .status(502)
          .json(
            formatErrorResponse(
              exchangeName,
              exchangetype,
              "exchange_response_error",
              rateObject
            )
          );
      }

      // Fetch exchange rate
      const rateMessage = {
        jsonrpc: "2.0",
        id: "test",
        method: typeidentifier,
        params: {
          from: coin.sellTicker,
          to: coin.getTicker,
          amountFrom: amount,
        },
      };

      const rateSignature = crypto.sign(
        "sha256",
        Buffer.from(JSON.stringify(rateMessage)),
        {
          key: privateKey,
          type: "pkcs8",
          format: "der",
        }
      );

      const rateOptions = {
        method: "POST",
        url: "https://api.changelly.com/v2",
        headers: {
          "Content-Type": "application/json",
          "X-Api-Key": crypto
            .createHash("sha256")
            .update(publicKey)
            .digest("base64"),
          "X-Api-Signature": rateSignature.toString("base64"),
        },
        body: JSON.stringify(rateMessage),
      };

      request(rateOptions, async (error, response) => {
        try {
          if (error) {
            return res
              .status(502)
              .json(
                formatErrorResponse(
                  exchangeName,
                  exchangetype,
                  "exchange_response_error",
                  rateObject
                )
              );
          }

          const data = JSON.parse(response.body);

          // Check for range errors
          if (data.error) {
            if (data.error.data?.limits) {
              if (findText("Minimal amount is", data.error.message)) {
                return res
                  .status(200)
                  .json(
                    formatErrorResponse(
                      exchangeName,
                      exchangetype,
                      "deposit_below_range",
                      rateObject
                    )
                  );
              }
              if (findText("Maximum amount is", data.error.message)) {
                return res
                  .status(200)
                  .json(
                    formatErrorResponse(
                      exchangeName,
                      exchangetype,
                      "deposit_above_range",
                      rateObject
                    )
                  );
              }
            }
            return res
              .status(502)
              .json(
                formatErrorResponse(
                  exchangeName,
                  exchangetype,
                  "exchange_response_error",
                  rateObject
                )
              );
          }

          // Success - set rate
          rateObject.rate = parseFloat(data.result[0].amountTo);

          if (exchangetype === "Fixed") {
            rateObject.rate_id = data.result[0].id;
          }

          return res
            .status(200)
            .json(formatSuccessResponse(rateObject, hasGiveAway));
        } catch (error) {
          return res
            .status(502)
            .json(
              formatErrorResponse(
                exchangeName,
                exchangetype,
                "exchange_response_error",
                rateObject
              )
            );
        }
      });
    } catch (error) {
      const metadata = getExchangeMetadata(exchangeName);
      return res.status(500).json(
        formatErrorResponse(exchangeName, exchangetype, "settings_error", {
          name: exchangeName,
          rate: 0,
          rate_id: null,
          min: 0,
          higher_min: 0,
          max: 0,
          exchangetype: exchangetype,
          ...metadata,
        })
      );
    }
  };

  /**
   * ChangeNOW rate handler
   */
  static changenowRate = async (
    req,
    res,
    sell,
    get,
    amount,
    exchangetype,
    hasGiveAway
  ) => {
    const exchangeName = "changenow";
    const metadata = getExchangeMetadata(exchangeName);

    try {
      // Fetch coin data with exchange-specific ticker and network
      let coin;
      try {
        const sellCoinObj = await fetchCoinFromDB(sell, exchangeName);
        const getCoinObj = await fetchCoinFromDB(get, exchangeName);
        coin = {
          sellTicker: sellCoinObj.ticker,
          sellNetwork: sellCoinObj.network,
          getTicker: getCoinObj.ticker,
          getNetwork: getCoinObj.network,
        };
      } catch (error) {
        return res.status(404).json(
          formatErrorResponse(exchangeName, exchangetype, "coin_not_found", {
            name: exchangeName,
            rate: 0,
            rate_id: null,
            min: 0,
            higher_min: 0,
            max: 0,
            exchangetype: exchangetype,
            ...metadata,
          })
        );
      }

      // Initialize rate object
      let rateObject = {
        name: exchangeName,
        rate: 0,
        rate_id: null,
        min: 0,
        higher_min: 0,
        max: 0,
        exchangetype: exchangetype,
        ...metadata,
      };

      const typeidentifier =
        exchangetype === "Floating" ? "standard" : "fixed-rate";
      const useRateId = exchangetype === "Floating" ? "false" : "true";

      try {
        // Fetch min/max limits
        const minResponse = await fetch(
          `https://api.changenow.io/v2/exchange/min-amount?fromCurrency=${coin.sellTicker}&toCurrency=${coin.getTicker}&fromNetwork=${coin.sellNetwork}&toNetwork=${coin.getNetwork}&flow=${typeidentifier}`,
          {
            method: "GET",
            headers: {
              "Content-Type": "application/json",
              "x-changenow-api-key": process.env.CHANGENOW_API_KEY,
            },
          }
        );

        const minData = await minResponse.json();

        if (!isNaN(minData.minAmount)) {
          rateObject.min = parseFloat(minData.minAmount);
          rateObject.higher_min = increaseByPercentage(minData.minAmount, 2);
          if (minData.maxAmount) {
            rateObject.max = parseFloat(minData.maxAmount);
          }
        }

        // Fetch exchange rate
        const rateResponse = await fetch(
          `https://api.changenow.io/v2/exchange/estimated-amount?fromCurrency=${coin.sellTicker}&toCurrency=${coin.getTicker}&fromAmount=${amount}&toAmount=&fromNetwork=${coin.sellNetwork}&toNetwork=${coin.getNetwork}&flow=${typeidentifier}&type=direct&useRateId=${useRateId}`,
          {
            method: "GET",
            headers: {
              "Content-Type": "application/json",
              "x-changenow-api-key": process.env.CHANGENOW_API_KEY,
            },
          }
        );

        const rateData = await rateResponse.json();

        if (rateData.toAmount) {
          rateObject.rate = parseFloat(rateData.toAmount);

          if (exchangetype === "Fixed") {
            rateObject.rate_id = rateData.rateId;
          }

          return res
            .status(200)
            .json(formatSuccessResponse(rateObject, hasGiveAway));
        } else if (
          rateData.error === "deposit_too_small" ||
          rateData.error === "out_of_range"
        ) {
          if (parseFloat(amount) < rateObject.min) {
            return res
              .status(200)
              .json(
                formatErrorResponse(
                  exchangeName,
                  exchangetype,
                  "deposit_below_range",
                  rateObject
                )
              );
          } else {
            return res
              .status(200)
              .json(
                formatErrorResponse(
                  exchangeName,
                  exchangetype,
                  "deposit_above_range",
                  rateObject
                )
              );
          }
        } else {
          throw new Error("Unexpected API response");
        }
      } catch (error) {
        return res
          .status(502)
          .json(
            formatErrorResponse(
              exchangeName,
              exchangetype,
              "exchange_response_error",
              rateObject
            )
          );
      }
    } catch (error) {
      const metadata = getExchangeMetadata(exchangeName);
      return res.status(500).json(
        formatErrorResponse(exchangeName, exchangetype, "settings_error", {
          name: exchangeName,
          rate: 0,
          rate_id: null,
          min: 0,
          higher_min: 0,
          max: 0,
          exchangetype: exchangetype,
          ...metadata,
        })
      );
    }
  };

  // TODO: Implement remaining exchange handlers
  static changeheroRate = async (
    req,
    res,
    sell,
    get,
    amount,
    exchangetype,
    hasGiveAway
  ) => {
    const exchangeName = "changehero";
    const metadata = getExchangeMetadata(exchangeName);
    const typeidentifier =
      exchangetype === "Floating" ? "getExchangeAmount" : "getFixRate";

    try {
      // Fetch coin data with exchange-specific ticker and network
      let coin;
      try {
        const sellCoinObj = await fetchCoinFromDB(sell, exchangeName);
        const getCoinObj = await fetchCoinFromDB(get, exchangeName);
        coin = {
          sellTicker: sellCoinObj.ticker,
          sellNetwork: sellCoinObj.network,
          getTicker: getCoinObj.ticker,
          getNetwork: getCoinObj.network,
        };
      } catch (error) {
        return res.status(404).json(
          formatErrorResponse(exchangeName, exchangetype, "coin_not_found", {
            name: exchangeName,
            rate: 0,
            rate_id: null,
            min: 0,
            higher_min: 0,
            max: 0,
            exchangetype: exchangetype,
            ...metadata,
          })
        );
      }

      // Initialize rate object
      let rateObject = {
        name: exchangeName,
        rate: 0,
        rate_id: null,
        min: 0,
        higher_min: 0,
        max: 0,
        exchangetype: exchangetype,
        ...metadata,
      };

      try {
        // Fetch min/max limits
        const param1 = {
          jsonrpc: "2.0",
          method: "getFixRate",
          params: {
            from: coin.sellTicker,
            to: coin.getTicker,
          },
        };

        const response1 = await fetch(`https://api.changehero.io/v2/`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "api-key": process.env.CHANGEHERO_API_KEY,
          },
          body: JSON.stringify(param1),
        });

        const data1 = await response1.json();

        if (
          data1.result &&
          !isNaN(data1.result[0].minFrom) &&
          !isNaN(data1.result[0].maxFrom)
        ) {
          rateObject.min = parseFloat(data1.result[0].minFrom);
          rateObject.higher_min = increaseByPercentage(
            data1.result[0].minFrom,
            2
          );
          rateObject.max = parseFloat(data1.result[0].maxFrom);
        }

        // Fetch exchange rate
        const param = {
          jsonrpc: "2.0",
          method: typeidentifier,
          params: {
            from: coin.sellTicker,
            to: coin.getTicker,
            amount: amount,
          },
        };

        const response = await fetch(`https://api.changehero.io/v2/`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "api-key": process.env.CHANGEHERO_API_KEY,
          },
          body: JSON.stringify(param),
        });

        const data = await response.json();

        if (data.result) {
          // ChangeHero response differs for fixed and floating
          if (exchangetype === "Fixed") {
            rateObject.rate = Math.abs(
              parseFloat(
                parseFloat(amount) * parseFloat(data.result[0].result) -
                  parseFloat(data.result[0].networkFee)
              )
            );
            rateObject.rate_id = data.result[0].id;
          } else {
            rateObject.rate = parseFloat(Math.abs(data.result));
          }

          // Check if amount is within range
          if (
            parseFloat(amount) >= rateObject.min &&
            parseFloat(amount) <= rateObject.max
          ) {
            return res
              .status(200)
              .json(formatSuccessResponse(rateObject, hasGiveAway));
          } else {
            if (parseFloat(amount) < rateObject.min) {
              return res.status(200).json(
                formatErrorResponse(
                  exchangeName,
                  exchangetype,
                  "deposit_below_range",
                  rateObject
                )
              );
            } else {
              return res.status(200).json(
                formatErrorResponse(
                  exchangeName,
                  exchangetype,
                  "deposit_above_range",
                  rateObject
                )
              );
            }
          }
        } else if (data.error) {
          // Handle error messages from API
          const errorMessage = data.error.message || "";
          if (
            errorMessage.includes("Parameter amount is invalid") ||
            errorMessage.includes("Amount is less than minimal") ||
            errorMessage.includes("Amount is bigger than maximum")
          ) {
            if (parseFloat(amount) < rateObject.min) {
              return res.status(200).json(
                formatErrorResponse(
                  exchangeName,
                  exchangetype,
                  "deposit_below_range",
                  rateObject
                )
              );
            } else {
              return res.status(200).json(
                formatErrorResponse(
                  exchangeName,
                  exchangetype,
                  "deposit_above_range",
                  rateObject
                )
              );
            }
          } else {
            throw new Error("Unexpected API response");
          }
        } else {
          throw new Error("Unexpected API response");
        }
      } catch (error) {
        return res.status(502).json(
          formatErrorResponse(
            exchangeName,
            exchangetype,
            "exchange_response_error",
            rateObject
          )
        );
      }
    } catch (error) {
      const metadata = getExchangeMetadata(exchangeName);
      return res.status(500).json(
        formatErrorResponse(exchangeName, exchangetype, "settings_error", {
          name: exchangeName,
          rate: 0,
          rate_id: null,
          min: 0,
          higher_min: 0,
          max: 0,
          exchangetype: exchangetype,
          ...metadata,
        })
      );
    }
  };

  static stealthexRate = async (
    req,
    res,
    sell,
    get,
    amount,
    exchangetype,
    hasGiveAway
  ) => {
    const exchangeName = "stealthex";
    const metadata = getExchangeMetadata(exchangeName);
    const typeidentifier = exchangetype === "Floating" ? "false" : "true";

    try {
      // Fetch coin data with exchange-specific ticker and network
      let coin;
      try {
        const sellCoinObj = await fetchCoinFromDB(sell, exchangeName);
        const getCoinObj = await fetchCoinFromDB(get, exchangeName);
        coin = {
          sellTicker: sellCoinObj.ticker,
          sellNetwork: sellCoinObj.network,
          getTicker: getCoinObj.ticker,
          getNetwork: getCoinObj.network,
        };
      } catch (error) {
        return res.status(404).json(
          formatErrorResponse(exchangeName, exchangetype, "coin_not_found", {
            name: exchangeName,
            rate: 0,
            rate_id: null,
            min: 0,
            higher_min: 0,
            max: 0,
            exchangetype: exchangetype,
            ...metadata,
          })
        );
      }

      // Initialize rate object
      let rateObject = {
        name: exchangeName,
        rate: 0,
        rate_id: null,
        min: 0,
        higher_min: 0,
        max: 0,
        exchangetype: exchangetype,
        ...metadata,
      };

      try {
        // Fetch min/max limits - uses ticker only
        const response1 = await fetch(
          `https://api.stealthex.io/api/v2/range/${coin.sellTicker}/${coin.getTicker}?api_key=${process.env.STEALTHEX_API_KEY}&fixed=true`,
          {
            method: "GET",
            headers: {
              "Content-Type": "application/json",
            },
          }
        );
        const result1 = await response1.json();
        if (!isNaN(result1.min_amount)) {
          rateObject.min = parseFloat(result1.min_amount);
          rateObject.higher_min = increaseByPercentage(result1.min_amount, 2);
          if (result1.max_amount) {
            rateObject.max = parseFloat(result1.max_amount);
          }
        }

        // Fetch exchange rate - uses ticker only
        const response2 = await fetch(
          `https://api.stealthex.io/api/v2/estimate/${coin.sellTicker}/${coin.getTicker}?amount=${amount}&api_key=${process.env.STEALTHEX_API_KEY}&fixed=${typeidentifier}`,
          {
            method: "GET",
            headers: {
              "Content-Type": "application/json",
            },
          }
        );

        const data = await response2.json();

        if (
          data.estimated_amount &&
          parseFloat(amount) > rateObject.min &&
          parseFloat(amount) < rateObject.max
        ) {
          rateObject.rate = parseFloat(data.estimated_amount);

          // Store rate_id for Fixed exchanges
          if (exchangetype === "Fixed") {
            rateObject.rate_id = data.rate_id;
          }

          return res
            .status(200)
            .json(formatSuccessResponse(rateObject, hasGiveAway));
        } else if (
          parseFloat(amount) < rateObject.min ||
          parseFloat(amount) > rateObject.max
        ) {
          if (parseFloat(amount) < rateObject.min) {
            return res.status(200).json(
              formatErrorResponse(
                exchangeName,
                exchangetype,
                "deposit_below_range",
                rateObject
              )
            );
          } else {
            return res.status(200).json(
              formatErrorResponse(
                exchangeName,
                exchangetype,
                "deposit_above_range",
                rateObject
              )
            );
          }
        } else {
          throw new Error("Unexpected API response");
        }
      } catch (error) {
        return res.status(502).json(
          formatErrorResponse(
            exchangeName,
            exchangetype,
            "exchange_response_error",
            rateObject
          )
        );
      }
    } catch (error) {
      const metadata = getExchangeMetadata(exchangeName);
      return res.status(500).json(
        formatErrorResponse(exchangeName, exchangetype, "settings_error", {
          name: exchangeName,
          rate: 0,
          rate_id: null,
          min: 0,
          higher_min: 0,
          max: 0,
          exchangetype: exchangetype,
          ...metadata,
        })
      );
    }
  };

  static exolixRate = async (
    req,
    res,
    sell,
    get,
    amount,
    exchangetype,
    hasGiveAway
  ) => {
    const exchangeName = "exolix";
    const metadata = getExchangeMetadata(exchangeName);
    const typeidentifier = exchangetype === "Floating" ? "float" : "fixed";

    try {
      // Fetch coin data with exchange-specific ticker and network
      let coin;
      try {
        const sellCoinObj = await fetchCoinFromDB(sell, exchangeName);
        const getCoinObj = await fetchCoinFromDB(get, exchangeName);
        coin = {
          sellTicker: sellCoinObj.ticker,
          sellNetwork: sellCoinObj.network,
          getTicker: getCoinObj.ticker,
          getNetwork: getCoinObj.network,
        };
      } catch (error) {
        return res.status(404).json(
          formatErrorResponse(exchangeName, exchangetype, "coin_not_found", {
            name: exchangeName,
            rate: 0,
            rate_id: null,
            min: 0,
            higher_min: 0,
            max: 0,
            exchangetype: exchangetype,
            ...metadata,
          })
        );
      }

      // Initialize rate object
      let rateObject = {
        name: exchangeName,
        rate: 0,
        rate_id: null,
        min: 0,
        higher_min: 0,
        max: 0,
        exchangetype: exchangetype,
        ...metadata,
      };

      try {
        // Fetch rate with limits - uses ticker AND network
        const response = await fetch(
          `https://exolix.com/api/v2/rate?coinFrom=${coin.sellTicker}&coinTo=${coin.getTicker}&networkFrom=${coin.sellNetwork}&networkTo=${coin.getNetwork}&amount=${amount}&rateType=${typeidentifier}`,
          {
            method: "GET",
            headers: {
              "Content-Type": "application/json",
            },
          }
        );

        const data = await response.json();

        if (!isNaN(data.toAmount) && data.toAmount !== 0) {
          rateObject.rate = parseFloat(data.toAmount);
          rateObject.min = parseFloat(data.minAmount);
          rateObject.higher_min = increaseByPercentage(data.minAmount, 2);
          rateObject.max = parseFloat(data.maxAmount);
          return res
            .status(200)
            .json(formatSuccessResponse(rateObject, hasGiveAway));
        } else if (
          data.message ===
            "Amount to exchange is below the possible min amount to exchange" ||
          data.message ===
            "Amount to exchange is higher the possible max amount to exchange"
        ) {
          if (!isNaN(data.minAmount)) {
            rateObject.min = parseFloat(data.minAmount);
            rateObject.higher_min = increaseByPercentage(data.minAmount, 2);
          }
          if (!isNaN(data.maxAmount)) {
            rateObject.max = parseFloat(data.maxAmount);
          }

          if (
            data.message ===
            "Amount to exchange is below the possible min amount to exchange"
          ) {
            return res.status(200).json(
              formatErrorResponse(
                exchangeName,
                exchangetype,
                "deposit_below_range",
                rateObject
              )
            );
          }

          if (
            data.message ===
            "Amount to exchange is higher the possible max amount to exchange"
          ) {
            return res.status(200).json(
              formatErrorResponse(
                exchangeName,
                exchangetype,
                "deposit_above_range",
                rateObject
              )
            );
          }
        } else {
          throw new Error("Unexpected API response");
        }
      } catch (error) {
        return res.status(502).json(
          formatErrorResponse(
            exchangeName,
            exchangetype,
            "exchange_response_error",
            rateObject
          )
        );
      }
    } catch (error) {
      const metadata = getExchangeMetadata(exchangeName);
      return res.status(500).json(
        formatErrorResponse(exchangeName, exchangetype, "settings_error", {
          name: exchangeName,
          rate: 0,
          rate_id: null,
          min: 0,
          higher_min: 0,
          max: 0,
          exchangetype: exchangetype,
          ...metadata,
        })
      );
    }
  };

  static simpleswapRate = async (
    req,
    res,
    sell,
    get,
    amount,
    exchangetype,
    hasGiveAway
  ) => {
    const exchangeName = "simpleswap";
    const metadata = getExchangeMetadata(exchangeName);
    const typeidentifier = exchangetype === "Floating" ? "false" : "true";

    try {
      // Fetch coin data with exchange-specific ticker and network
      let coin;
      try {
        const sellCoinObj = await fetchCoinFromDB(sell, exchangeName);
        const getCoinObj = await fetchCoinFromDB(get, exchangeName);
        coin = {
          sellTicker: sellCoinObj.ticker,
          sellNetwork: sellCoinObj.network,
          getTicker: getCoinObj.ticker,
          getNetwork: getCoinObj.network,
        };
      } catch (error) {
        return res.status(404).json(
          formatErrorResponse(exchangeName, exchangetype, "coin_not_found", {
            name: exchangeName,
            rate: 0,
            rate_id: null,
            min: 0,
            higher_min: 0,
            max: 0,
            exchangetype: exchangetype,
            ...metadata,
          })
        );
      }

      // Initialize rate object
      let rateObject = {
        name: exchangeName,
        rate: 0,
        rate_id: null,
        min: 0,
        higher_min: 0,
        max: 0,
        exchangetype: exchangetype,
        ...metadata,
      };

      try {
        // Fetch min/max limits - uses ticker only
        const response1 = await fetch(
          `https://api.simpleswap.io/get_ranges?api_key=${process.env.SIMPLESWAP_API_KEY}&fixed=${typeidentifier}&currency_from=${coin.sellTicker}&currency_to=${coin.getTicker}`,
          {
            method: "GET",
            headers: {
              "Content-Type": "application/json",
            },
          }
        );

        const data1 = await response1.json();
        if (!isNaN(data1.min) && !isNaN(data1.max)) {
          rateObject.min = parseFloat(data1.min);
          rateObject.higher_min = increaseByPercentage(data1.min, 2);
          if (data1.max) {
            rateObject.max = parseFloat(data1.max);
          }
        }

        // Fetch exchange rate - uses ticker only
        const response = await fetch(
          `https://api.simpleswap.io/get_estimated?api_key=${process.env.SIMPLESWAP_API_KEY}&fixed=${typeidentifier}&currency_from=${coin.sellTicker}&currency_to=${coin.getTicker}&amount=${amount}`,
          {
            method: "GET",
            headers: {
              "Content-Type": "application/json",
            },
          }
        );
        const data = await response.json();

        // Check if response is a valid number
        if (!isNaN(Number(data)) && isFinite(data)) {
          rateObject.rate = parseFloat(data);

          return res
            .status(200)
            .json(formatSuccessResponse(rateObject, hasGiveAway));
        } else if (
          data.description &&
          data.description.includes("Amount does not fall within the range.")
        ) {
          if (parseFloat(amount) < rateObject.min) {
            return res.status(200).json(
              formatErrorResponse(
                exchangeName,
                exchangetype,
                "deposit_below_range",
                rateObject
              )
            );
          } else {
            return res.status(200).json(
              formatErrorResponse(
                exchangeName,
                exchangetype,
                "deposit_above_range",
                rateObject
              )
            );
          }
        } else {
          throw new Error("Unexpected API response");
        }
      } catch (error) {
        return res.status(502).json(
          formatErrorResponse(
            exchangeName,
            exchangetype,
            "exchange_response_error",
            rateObject
          )
        );
      }
    } catch (error) {
      const metadata = getExchangeMetadata(exchangeName);
      return res.status(500).json(
        formatErrorResponse(exchangeName, exchangetype, "settings_error", {
          name: exchangeName,
          rate: 0,
          rate_id: null,
          min: 0,
          higher_min: 0,
          max: 0,
          exchangetype: exchangetype,
          ...metadata,
        })
      );
    }
  };

  static godexRate = async (
    req,
    res,
    sell,
    get,
    amount,
    exchangetype,
    hasGiveAway
  ) => {
    const exchangeName = "godex";
    const metadata = getExchangeMetadata(exchangeName);
    const exchangeTypeIdentifier = exchangetype === "Floating" ? true : false;

    try {
      // Fetch coin data with exchange-specific ticker and network
      let coin;
      try {
        const sellCoinObj = await fetchCoinFromDB(sell, exchangeName);
        const getCoinObj = await fetchCoinFromDB(get, exchangeName);
        coin = {
          sellTicker: sellCoinObj.ticker,
          sellNetwork: sellCoinObj.network,
          getTicker: getCoinObj.ticker,
          getNetwork: getCoinObj.network,
        };
      } catch (error) {
        return res.status(404).json(
          formatErrorResponse(exchangeName, exchangetype, "coin_not_found", {
            name: exchangeName,
            rate: 0,
            rate_id: null,
            min: 0,
            higher_min: 0,
            max: 0,
            exchangetype: exchangetype,
            ...metadata,
          })
        );
      }

      // Initialize rate object
      let rateObject = {
        name: exchangeName,
        rate: 0,
        rate_id: null,
        min: 0,
        higher_min: 0,
        max: 0,
        exchangetype: exchangetype,
        ...metadata,
      };

      try {
        // Fetch rate with limits - uses ticker AND network
        const param = {
          from: coin.sellTicker,
          to: coin.getTicker,
          amount: amount,
          float: exchangeTypeIdentifier,
          network_from: coin.sellNetwork,
          network_to: coin.getNetwork,
        };

        const response = await fetch(`https://api.godex.io/api/v1/info`, {
          method: "POST",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
          },
          body: JSON.stringify(param),
        });

        const data = await response.json();

        if (
          !isNaN(data.amount) &&
          !isNaN(data.min_amount) &&
          !isNaN(data.max_amount)
        ) {
          rateObject.min = parseFloat(data.min_amount);
          rateObject.higher_min = increaseByPercentage(data.min_amount, 2);
          rateObject.max = parseFloat(data.max_amount);
          rateObject.rate = parseFloat(data.amount);
          rateObject.rate_id = data.rate_uuid;

          if (
            parseFloat(amount) >= rateObject.min &&
            parseFloat(amount) <= rateObject.max
          ) {
            return res
              .status(200)
              .json(formatSuccessResponse(rateObject, hasGiveAway));
          } else {
            if (parseFloat(amount) < rateObject.min) {
              return res.status(200).json(
                formatErrorResponse(
                  exchangeName,
                  exchangetype,
                  "deposit_below_range",
                  rateObject
                )
              );
            }

            if (parseFloat(amount) > rateObject.max) {
              return res.status(200).json(
                formatErrorResponse(
                  exchangeName,
                  exchangetype,
                  "deposit_above_range",
                  rateObject
                )
              );
            }
          }
        } else if (data.error) {
          throw new Error("API returned error");
        } else {
          throw new Error("Unexpected API response");
        }
      } catch (error) {
        return res.status(502).json(
          formatErrorResponse(
            exchangeName,
            exchangetype,
            "exchange_response_error",
            rateObject
          )
        );
      }
    } catch (error) {
      const metadata = getExchangeMetadata(exchangeName);
      return res.status(500).json(
        formatErrorResponse(exchangeName, exchangetype, "settings_error", {
          name: exchangeName,
          rate: 0,
          rate_id: null,
          min: 0,
          higher_min: 0,
          max: 0,
          exchangetype: exchangetype,
          ...metadata,
        })
      );
    }
  };

  static letsexchangeRate = async (
    req,
    res,
    sell,
    get,
    amount,
    exchangetype,
    hasGiveAway
  ) => {
    const exchangeName = "letsexchange";
    const metadata = getExchangeMetadata(exchangeName);
    const typeidentifier = exchangetype === "Floating" ? true : false;

    try {
      // Fetch coin data with exchange-specific ticker and network
      let coin;
      try {
        const sellCoinObj = await fetchCoinFromDB(sell, exchangeName);
        const getCoinObj = await fetchCoinFromDB(get, exchangeName);
        coin = {
          sellTicker: sellCoinObj.ticker,
          sellNetwork: sellCoinObj.network,
          getTicker: getCoinObj.ticker,
          getNetwork: getCoinObj.network,
        };
      } catch (error) {
        return res.status(404).json(
          formatErrorResponse(exchangeName, exchangetype, "coin_not_found", {
            name: exchangeName,
            rate: 0,
            rate_id: null,
            min: 0,
            higher_min: 0,
            max: 0,
            exchangetype: exchangetype,
            ...metadata,
          })
        );
      }

      // Initialize rate object
      let rateObject = {
        name: exchangeName,
        rate: 0,
        rate_id: null,
        min: 0,
        higher_min: 0,
        max: 0,
        exchangetype: exchangetype,
        ...metadata,
      };

      try {
        // Fetch rate with limits - uses ticker only (no network)
        const param = {
          from: coin.sellTicker,
          to: coin.getTicker,
          amount: amount,
          float: typeidentifier,
        };

        const response = await fetch(`https://api.letsexchange.io/api/v1/info`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: process.env.LETSEXCHANGE_API_KEY,
          },
          body: JSON.stringify(param),
        });

        const data = await response.json();

        if (
          !isNaN(data.amount) &&
          !isNaN(data.deposit_min_amount) &&
          !isNaN(data.deposit_max_amount)
        ) {
          rateObject.min = parseFloat(data.deposit_min_amount);
          rateObject.higher_min = increaseByPercentage(
            data.deposit_min_amount,
            2
          );
          rateObject.max = parseFloat(data.deposit_max_amount);
          rateObject.rate = parseFloat(data.amount);

          if (exchangetype === "Fixed" && data.rate_id !== "") {
            rateObject.rate_id = data.rate_id;
          }

          // Check if amount is within range
          if (
            parseFloat(amount) >= rateObject.min &&
            parseFloat(amount) <= rateObject.max
          ) {
            return res
              .status(200)
              .json(formatSuccessResponse(rateObject, hasGiveAway));
          } else {
            if (parseFloat(amount) < rateObject.min) {
              return res.status(200).json(
                formatErrorResponse(
                  exchangeName,
                  exchangetype,
                  "deposit_below_range",
                  rateObject
                )
              );
            }

            if (parseFloat(amount) > rateObject.max) {
              return res.status(200).json(
                formatErrorResponse(
                  exchangeName,
                  exchangetype,
                  "deposit_above_range",
                  rateObject
                )
              );
            }
          }
        } else {
          throw new Error("Unexpected API response");
        }
      } catch (error) {
        return res.status(502).json(
          formatErrorResponse(
            exchangeName,
            exchangetype,
            "exchange_response_error",
            rateObject
          )
        );
      }
    } catch (error) {
      const metadata = getExchangeMetadata(exchangeName);
      return res.status(500).json(
        formatErrorResponse(exchangeName, exchangetype, "settings_error", {
          name: exchangeName,
          rate: 0,
          rate_id: null,
          min: 0,
          higher_min: 0,
          max: 0,
          exchangetype: exchangetype,
          ...metadata,
        })
      );
    }
  };

  static easybitRate = async (
    req,
    res,
    sell,
    get,
    amount,
    exchangetype,
    hasGiveAway
  ) => {
    const exchangeName = "easybit";
    const metadata = getExchangeMetadata(exchangeName);

    try {
      // Fetch coin data with exchange-specific ticker and network
      let coin;
      try {
        const sellCoinObj = await fetchCoinFromDB(sell, exchangeName);
        const getCoinObj = await fetchCoinFromDB(get, exchangeName);
        coin = {
          sellTicker: sellCoinObj.ticker,
          sellNetwork: sellCoinObj.network,
          getTicker: getCoinObj.ticker,
          getNetwork: getCoinObj.network,
        };
      } catch (error) {
        return res.status(404).json(
          formatErrorResponse(exchangeName, exchangetype, "coin_not_found", {
            name: exchangeName,
            rate: 0,
            rate_id: null,
            min: 0,
            higher_min: 0,
            max: 0,
            exchangetype: exchangetype,
            ...metadata,
          })
        );
      }

      // Initialize rate object
      let rateObject = {
        name: exchangeName,
        rate: 0,
        rate_id: null,
        min: 0,
        higher_min: 0,
        max: 0,
        exchangetype: exchangetype,
        ...metadata,
      };

      try {
        // Fetch min/max limits - uses ticker AND network
        const response1 = await fetch(
          `https://api.easybit.com/pairInfo?send=${coin.sellTicker}&receive=${coin.getTicker}&sendNetwork=${coin.sellNetwork}&receiveNetwork=${coin.getNetwork}`,
          {
            method: "GET",
            headers: {
              "Content-Type": "application/json",
              "API-KEY": process.env.EASYBIT_API_KEY,
            },
          }
        );

        const result1 = await response1.json();
        if (
          result1.data &&
          !isNaN(result1.data.minimumAmount) &&
          !isNaN(result1.data.maximumAmount)
        ) {
          rateObject.min = parseFloat(result1.data.minimumAmount);
          rateObject.higher_min = increaseByPercentage(
            result1.data.minimumAmount,
            2
          );
          rateObject.max = parseFloat(result1.data.maximumAmount);
        } else {
          throw new Error("Failed to fetch min/max limits");
        }

        // Fetch exchange rate - uses ticker AND network
        const params = {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            "API-KEY": process.env.EASYBIT_API_KEY,
          },
        };

        const response2 = await fetch(
          `https://api.easybit.com/rate?send=${coin.sellTicker}&receive=${coin.getTicker}&sendNetwork=${coin.sellNetwork}&receiveNetwork=${coin.getNetwork}&amount=${amount}`,
          params
        );
        const result2 = await response2.json();

        if (result2.data && !isNaN(result2.data.receiveAmount)) {
          rateObject.rate = parseFloat(result2.data.receiveAmount);

          return res
            .status(200)
            .json(formatSuccessResponse(rateObject, hasGiveAway));
        } else if (result2.errorMessage === "Not allowed amount") {
          if (parseFloat(amount) < rateObject.min) {
            return res.status(200).json(
              formatErrorResponse(
                exchangeName,
                exchangetype,
                "deposit_below_range",
                rateObject
              )
            );
          }

          if (parseFloat(amount) > rateObject.max) {
            return res.status(200).json(
              formatErrorResponse(
                exchangeName,
                exchangetype,
                "deposit_above_range",
                rateObject
              )
            );
          }
        } else {
          throw new Error("Unexpected API response");
        }
      } catch (error) {
        return res.status(502).json(
          formatErrorResponse(
            exchangeName,
            exchangetype,
            "exchange_response_error",
            rateObject
          )
        );
      }
    } catch (error) {
      const metadata = getExchangeMetadata(exchangeName);
      return res.status(500).json(
        formatErrorResponse(exchangeName, exchangetype, "settings_error", {
          name: exchangeName,
          rate: 0,
          rate_id: null,
          min: 0,
          higher_min: 0,
          max: 0,
          exchangetype: exchangetype,
          ...metadata,
        })
      );
    }
  };
}

export default RateController;
