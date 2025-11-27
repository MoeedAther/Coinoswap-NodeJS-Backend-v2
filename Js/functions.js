import { db } from "../database/connectdb.js";

// Function for calculating percentge of profit (supporting function)
// ************************************************************************ Start *************************************************************************
async function fetchProfitPercantage(sql, exchangeName) {
  return new Promise((resolve, reject) => {
    db.query(sql, [exchangeName], (error, result) => {
      if (error) {
        reject(0);
      } else {
        resolve(parseFloat(result[0].profit_percent));
      }
    });
  });
}

//Function for calculating percentage;
function calculatePercentage(Number, PercentageOf) {
  const divide = PercentageOf / 100;
  const multiply = divide * Number;
  const figureAfterPercentage = multiply;
  return figureAfterPercentage;
}

export async function calculateProfitInBTC(
  exchangeName,
  sellCoin,
  sendingAmount,
  exchangeType
) {
  let sendAmount = parseFloat(sendingAmount);
  // Fetching changelly profit percentage from database
  const sql = "SELECT * FROM exchange_links WHERE exchange_name=?";
  let profitPercent;
  let amountInBTC;
  let profit = 0;

  profitPercent = await fetchProfitPercantage(sql, exchangeName);

  if (sellCoin === "btc") {
    profit = calculatePercentage(sendAmount, profitPercent);
  } else {
    switch (exchangeName) {
      case "changelly": {
        try {
          // Calling Changelly Api for converting sentding amount to BTC
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
            method:
              exchangeType === "Floating"
                ? "getExchangeAmount"
                : "getFixRateForAmount",
            params: {
              from: sellCoin,
              to: "btc",
              amountFrom: sendAmount,
            },
          };

          const signature = crypto.sign(
            "sha256",
            Buffer.from(JSON.stringify(message)),
            {
              key: privateKey,
              type: "pkcs8",
              format: "der",
            }
          );

          const param = {
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

          // Wrapping the request in a promise
          const data = await new Promise((resolve, reject) => {
            request(param, (error, response) => {
              if (error) {
                return profit;
              } else {
                resolve(JSON.parse(response.body));
              }
            });
          });

          amountInBTC = parseFloat(data.result[0].amountTo);
          profit = calculatePercentage(amountInBTC, profitPercent);
        } catch (error) {
          return profit;
        }

        break;
      }

      case "changenow": {
        try {
          const response = await fetch(
            `https://api.changenow.io/v1/exchange-amount/${
              exchangeType === "Fixed" ? "fixed-rate/" : ""
            }${sendAmount}/${sellCoin}_btc/?api_key=${process.env.CHANGENOW}`,
            {
              method: "GET",
              headers: {
                "Content-Type": "application/json",
              },
            }
          );

          const data = await response.json();
          amountInBTC = parseFloat(data.estimatedAmount);
          profit = calculatePercentage(amountInBTC, profitPercent);
        } catch (error) {
          return profit;
        }

        break;
      }

      case "changehero": {
        try {
          const param = {
            jsonrpc: "2.0",
            method:
              exchangeType === "Floating" ? "getExchangeAmount" : "getFixRate",
            params: {
              from: sellCoin,
              to: "btc",
              amount: sendAmount,
            },
          };

          const response = await fetch(`https://api.changehero.io/v2/`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "api-key": process.env.CHANGEHERO,
            },
            body: JSON.stringify(param),
          });

          const data = await response.json();
          amountInBTC =
            exchangeType === "Floating"
              ? parseFloat(data.result)
              : data.result[0].result;
          profit = calculatePercentage(amountInBTC, profitPercent);
        } catch (error) {
          return profit;
        }

        break;
      }

      case "exolix": {
        try {
          const response = await fetch(
            `https://exolix.com/api/v2/rate?coinFrom=${sellCoin}&coinTo=btc&amount=${sendAmount}&rateType=${
              exchangeType == "Floating" ? "float" : "fixed"
            }`,
            {
              method: "GET",
              headers: {
                "Content-Type": "application/json",
              },
            }
          );

          const data = await response.json();
          amountInBTC = parseFloat(data.toAmount);
          profit = calculatePercentage(amountInBTC, profitPercent);
        } catch (error) {
          return profit;
        }

        break;
      }

      case "godex": {
        try {
          let param = {
            from: sellCoin.toUpperCase(),
            to: "BTC",
            amount: sendAmount,
            float: exchangeType === "Floating" ? true : false,
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
          amountInBTC = parseFloat(data.amount);
          profit = calculatePercentage(amountInBTC, profitPercent);
        } catch (error) {
          return profit;
        }

        break;
      }

      case "stealthex": {
        try {
          const response = await fetch(
            `https://api.stealthex.io/api/v2/estimate/${sellCoin}/btc?amount=${sendAmount}&api_key=${
              process.env.STEALTHEX
            }&fixed=${exchangeType === "Fixed" ? false : true}`,
            {
              method: "GET",
              headers: {
                "Content-Type": "application/json",
              },
            }
          );

          const data = await response.json();
          amountInBTC = parseFloat(data.estimated_amount);
          profit = calculatePercentage(amountInBTC, profitPercent);
        } catch (error) {
          return profit;
        }

        break;
      }

      case "letsexchange": {
        try {
          let toncoinsell, param;
          if (sellCoin == "toncoin") {
            toncoinsell = sellCoin == "toncoin" ? "TON-ERC20" : sellCoin;
            param = {
              from: toncoinsell,
              to: "btc",
              amount: sendAmount,
              float: exchangeType === "Floating" ? true : false,
            };
          } else {
            param = {
              from: sellCoin,
              to: "btc",
              amount: sendAmount,
              float: exchangeType === "Floating" ? true : false,
            };
          }

          const response = await fetch(
            `https://api.letsexchange.io/api/v1/info`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: process.env.LETSEXCHANGE,
              },
              body: JSON.stringify(param),
            }
          );

          const data = await response.json();
          amountInBTC = parseFloat(data.amount);
          profit = calculatePercentage(amountInBTC, profitPercent);
        } catch (error) {
          return profit;
        }

        break;
      }
      case "simpleswap": {
        try {
          let sellcoin = sellCoin == "toncoin" ? "tonerc20" : sellCoin;

          const response = await fetch(
            `https://api.simpleswap.io/get_estimated?api_key=${
              process.env.SIMPLESWAP
            }&fixed=${
              exchangeType === "Floating" ? false : true
            }&currency_from=${sellcoin}&currency_to=btc&amount=${sendAmount}`,
            {
              method: "GET",
              headers: {
                "Content-Type": "application/json",
              },
            }
          );

          const data = await response.json();
          amountInBTC = parseFloat(data);
          profit = calculatePercentage(amountInBTC, profitPercent);
        } catch (error) {
          return profit;
        }

        break;
      }
      case "easybit": {
        try {
          let sellcoin = sellCoin.toUpperCase();
          const response = await fetch(
            `https://api.easybit.com/rate?send=${sellcoin}&receive=BTC&amount=${sendAmount}`,
            {
              method: "GET",
              headers: {
                "Content-Type": "application/json",
                "API-KEY": process.env.EASYBIT,
              },
            }
          );

          const data = await response.json();
          amountInBTC = parseFloat(data.data.receiveAmount);
          profit = calculatePercentage(amountInBTC, profitPercent);
        } catch (error) {
          return profit;
        }

        break;
      }
    }
  }
  return profit;
}
// ************************************************************************ End *************************************************************************

export function standerdiseStatus(status) {
  if (
    status === "new" ||
    status === "waiting" ||
    status === "wait" ||
    status === "Awating Deposit"
  ) {
    return "waiting";
  } else if (
    status === "confirming" ||
    status === "confirmation" ||
    status === "confirmed" ||
    status === "Confirming Deposit"
  ) {
    return "confirming";
  } else if (
    status === "exchanging" ||
    status === "sending" ||
    status === "sending_confirmation" ||
    status === "Exchanging" ||
    status === "Sending"
  ) {
    return "exchanging";
  } else if (
    status === "finished" ||
    status === "success" ||
    status === "Complete"
  ) {
    return "finished";
  } else if (status === "failed" || status === "error" || status === "Failed") {
    return "failed";
  } else if (status === "refunded" || status === "Refund") {
    return "refunded";
  } else if (
    status === "overdue" ||
    status === "expired" ||
    status === "Request Overdue"
  ) {
    return "overdue";
  } else {
    return "unknown";
  }
}

// This function will compare two arrays of availableExchanges and Unavailable Exchanges and returns array of unavailable exchanges
export function getUnavailableExchangeNames(availableExchanges) {
  const totalExchangesArr = [
    "changelly",
    "changenow",
    "changehero",
    "godex",
    "simpleswap",
    "letsexchange",
    "exolix",
    "easybit",
  ];

  const unavailableExchanges = totalExchangesArr.filter(
    (item) => !availableExchanges.includes(item)
  );

  return unavailableExchanges;
}

// In this function we will update standard coin and make it visible 0 in database
export function addMoreCoinsInStandardCoin(
  updateCoin,
  borrowCoins,
  coinType,
  shortName,
  shortNameChange,
  updateCoinUnavailableExchanges,
  updateCoinAvailableExchanges
) {
  return new Promise(async (resolve, reject) => {
    try {
      if (borrowCoins.length > 0) {
        // Update coin object that we are going to update
        let updateCoinExchangeDetailsObject = JSON.parse(updateCoin.exchanges);

        // Update coin exchange coin that we are goin to update
        let nUpdatedExchangesCount = 0;

        let updateCoinUnavailableExchangesArr = updateCoinUnavailableExchanges;
        let updateCoinAvailableExchangesArr = updateCoinAvailableExchanges;

        let borrowCoinIds = [];
        let updateCoinId = updateCoin.id;

        let updateCoinUnapprovedId = updateCoin.unapproved_id;

        // Looping through borrowCoin for storing availables exchanges inside update coin unavailable exchanges
        borrowCoins.map((borrowCoin) => {
          // Available exchanges array of each borrow coin from update coins
          let borrowCoinAvailableExchangesArray = JSON.parse(
            borrowCoin.available_exchanges
          );

          let borrowCoinExchangeDetailsObject = JSON.parse(
            borrowCoin.exchanges
          );

          borrowCoinAvailableExchangesArray.map((aname) => {
            if (updateCoinUnavailableExchanges.includes(aname)) {
              // value exists in the update coin unavailable exchanges array
              updateCoinExchangeDetailsObject[aname] =
                borrowCoinExchangeDetailsObject[aname];

              // Count of total exchanges updated
              nUpdatedExchangesCount++;

              // Remove the exchange from unavailableExchanges
              updateCoinUnavailableExchangesArr =
                updateCoinUnavailableExchangesArr.filter(
                  (item) => item !== aname
                );

              // Adding the exchange to available exchanges
              updateCoinAvailableExchangesArr.push(aname);

              // Adding borrow coin ids in array for updating borrow coins in unapproved_coins
              if (!borrowCoinIds.includes(borrowCoin.id)) {
                borrowCoinIds.push(borrowCoin.id);
              }
            }
          });
        });

        // Update approved_coins once
        await new Promise((res, rej) => {
          db.query(
            `UPDATE approved_coins SET exchanges_count=?, available_exchanges=?, unavailable_exchanges=?, coinType=?, short_name=?, short_name_update_method=?, exchanges=? WHERE id=?`,
            [
              updateCoinAvailableExchangesArr.length,
              JSON.stringify(updateCoinAvailableExchangesArr),
              JSON.stringify(updateCoinUnavailableExchangesArr),
              coinType,
              shortName,
              shortNameChange ? "manual" : "auto",
              JSON.stringify(updateCoinExchangeDetailsObject),
              updateCoinId,
            ],
            (error, result) => {
              if (error) return rej({ message: error });
              res();
            }
          );
        });

        // Updating approved coin in unapproved_coins table
        await new Promise((res, rej) => {
          db.query(
            `UPDATE unapproved_coins SET exchanges_count=?, available_exchanges=?, unavailable_exchanges=?, coinType=?, short_name=?, short_name_update_method=?, exchanges=? WHERE id=?`,
            [
              updateCoinAvailableExchangesArr.length,
              JSON.stringify(updateCoinAvailableExchangesArr),
              JSON.stringify(updateCoinUnavailableExchangesArr),
              coinType,
              shortName,
              shortNameChange ? "manual" : "auto",

              JSON.stringify(updateCoinExchangeDetailsObject),
              updateCoinUnapprovedId,
            ],
            (error, result) => {
              if (error) return rej({ message: error });
              res();
            }
          );
        });

        // Update unapproved_coins once
        await Promise.all(
          borrowCoinIds.map((borrowCoinId) => {
            return new Promise((res, rej) => {
              db.query(
                `UPDATE unapproved_coins SET exchanges_count=?, available_exchanges=?, unavailable_exchanges=?, coinType=?, short_name=?, short_name_update_method=?, exchanges=?, isVisible=? WHERE id=?`,
                [
                  updateCoinAvailableExchangesArr.length,
                  JSON.stringify(updateCoinAvailableExchangesArr),
                  JSON.stringify(updateCoinUnavailableExchangesArr),
                  coinType,
                  shortName,
                  shortNameChange ? "manual" : "auto",

                  JSON.stringify(updateCoinExchangeDetailsObject),
                  0,
                  borrowCoinId,
                ],
                (error, result) => {
                  if (error) return rej({ message: error });
                  res();
                }
              );
            });
          })
        );

        resolve({
          message: `You have successfully added ${nUpdatedExchangesCount} exchanges to ${updateCoin.ticker.toUpperCase()} and standardized ${
            borrowCoinIds.length
          } coins.`,
          updatedCoin: updateCoinExchangeDetailsObject,
        });
      } else if (coinType) {
        // Only update meta info
        db.query(
          `UPDATE approved_coins SET coinType=?, short_name=?, short_name_update_method=? WHERE id=?`,
          [
            coinType,
            shortName,
            shortNameChange ? "manual" : "auto",
            updateCoin.id,
          ],
          (error, result) => {
            if (error) return reject({ message: error });
            resolve({
              message: `You have successfully updated coin meta`,
            });
          }
        );
      } else {
        reject({ message: "No changes for update" });
      }
    } catch (err) {
      reject({ message: err });
    }
  });
}

// This function is responsible for fetching exchange required ticker name and network names
export function fetchCoinFromDB(coinParam, eName) {
  return new Promise((resolve, reject) => {
    let coin = {
      ticker: null,
      network: null,
    };

    db.query(
      "SELECT * FROM approved_coins WHERE ticker=?",
      [coinParam],
      async (error, result) => {
        if (error) {
          // reject promis with error message
          return reject(`Database error: ${error.message}`);
        }
        if (result.length > 0 && result.length < 2) {
          coin.ticker = JSON.parse(result[0].exchanges)[eName].ticker;
          coin.network = JSON.parse(result[0].exchanges)[eName].networkCode;

          // resolve promis with coin object
          return resolve(coin);
        } else {
          // reject promis with message no coin with this ticker name or more than one coin having same ticker name
          return reject(
            `Expected exactly 1 result, but found ${result.length} for ticker "${coinParam}"`
          );
        }
      }
    );
  });
}

//Date Formater
export function formatCustomDate(isoDateStr) {
  const date = new Date(isoDateStr);

  // Get year, month, and day
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0"); // Months are 0-indexed
  const day = String(date.getDate()).padStart(2, "0");

  // Get hours, minutes, and seconds
  let hours = date.getHours();
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const seconds = String(date.getSeconds()).padStart(2, "0");

  // Determine AM or PM
  const ampm = hours >= 12 ? "PM" : "AM";

  // Convert 24-hour time to 12-hour time
  hours = hours % 12 || 12; // If hours is 0, make it 12 (for midnight)

  // Format final string as YYYY-MM-DD H:MM:SS AM/PM
  const formattedDate = `${year}-${month}-${day} ${hours}:${minutes}:${seconds} ${ampm}`;

  return formattedDate;
}

//Figure Limitter
export function formatToChars(input, length) {
  // Step 1: Convert to string if it's a number
  let value = typeof input === "number" ? input.toString() : input;

  // Step 2: Trim the string to a maximum of 15 characters (including decimal point)
  value = value.slice(0, length);

  return value;
}

// These functions will be used in coin update cron job
// ************************************************************************ Start *************************************************************************
//This function replaces placeholder with another place holder {} helpful to enable txHash replacement in URL
export function replacePlaceholder(url) {
  if (!url) {
    return null;
  } else {
    return url
      .replace("%1$s", "{}")
      .replace("$$", "{}")
      .replace("{{txid}}", "{}");
  }
}

// This function creates an object for exchanges to store in coin data
export function createExchangeCountObject(
  name,
  bool,
  ticker,
  hasExtraId,
  coinName,
  coinNetworkCode,
  coinResponse
) {
  let exchangeObject = {
    changelly: {
      status: 0,
      ticker: null,
      name: null,
      symbol: null,
      isStable: null,
      type: null,
      networkCode: null,
      requiresExtraId: null,
      coinResponseData: null,
    },
    changenow: {
      status: 0,
      ticker: null,
      name: null,
      symbol: null,
      isStable: null,
      type: null,
      networkCode: null,
      requiresExtraId: null,
      coinResponseData: null,
    },
    changehero: {
      status: 0,
      ticker: null,
      name: null,
      symbol: null,
      isStable: null,
      type: null,
      networkCode: null,
      requiresExtraId: null,
      coinResponseData: null,
    },
    exolix: {
      status: 0,
      ticker: null,
      name: null,
      symbol: null,
      isStable: null,
      type: null,
      networkCode: null,
      requiresExtraId: null,
      coinResponseData: null,
    },
    stealthex: {
      status: 0,
      ticker: null,
      name: null,
      symbol: null,
      isStable: null,
      type: null,
      networkCode: null,
      requiresExtraId: null,
      coinResponseData: null,
    },
    letsexchange: {
      status: 0,
      ticker: null,
      name: null,
      symbol: null,
      isStable: null,
      type: null,
      networkCode: null,
      requiresExtraId: null,
      coinResponseData: null,
    },
    godex: {
      status: 0,
      ticker: null,
      name: null,
      symbol: null,
      isStable: null,
      type: null,
      networkCode: null,
      requiresExtraId: null,
      coinResponseData: null,
    },
    simpleswap: {
      status: 0,
      ticker: null,
      name: null,
      symbol: null,
      isStable: null,
      type: null,
      networkCode: null,
      requiresExtraId: null,
      coinResponseData: null,
    },
    easybit: {
      status: 0,
      ticker: null,
      name: null,
      symbol: null,
      isStable: null,
      type: null,
      networkCode: null,
      requiresExtraId: null,
      coinResponseData: null,
    },
  };

  switch (name) {
    case "changelly": {
      exchangeObject.changelly.status = bool;
      exchangeObject.changelly.ticker = ticker;
      exchangeObject.changelly.name = coinName;
      exchangeObject.changelly.requiresExtraId = hasExtraId;
      exchangeObject.changelly.networkCode = coinNetworkCode;
      exchangeObject.changelly.coinResponseData = coinResponse;
      break;
    }
    case "changenow": {
      exchangeObject.changenow.status = bool;
      exchangeObject.changenow.ticker = ticker;
      exchangeObject.changenow.name = coinName;
      exchangeObject.changenow.requiresExtraId = hasExtraId;
      exchangeObject.changenow.networkCode = coinNetworkCode;
      exchangeObject.changenow.coinResponseData = coinResponse;
      break;
    }
    case "changehero": {
      exchangeObject.changehero.status = bool;
      exchangeObject.changehero.ticker = ticker;
      exchangeObject.changehero.name = coinName;
      exchangeObject.changehero.requiresExtraId = hasExtraId;
      exchangeObject.changehero.networkCode = coinNetworkCode;
      exchangeObject.changehero.coinResponseData = coinResponse;
      break;
    }
    case "exolix": {
      exchangeObject.exolix.status = bool;
      exchangeObject.exolix.ticker = ticker;
      exchangeObject.exolix.name = coinName;
      exchangeObject.exolix.requiresExtraId = hasExtraId;
      exchangeObject.exolix.networkCode = coinNetworkCode;
      exchangeObject.exolix.coinResponseData = coinResponse;
      break;
    }
    case "stealthex": {
      exchangeObject.stealthex.status = bool;
      exchangeObject.stealthex.ticker = ticker;
      exchangeObject.stealthex.name = coinName;
      exchangeObject.stealthex.requiresExtraId = hasExtraId;
      exchangeObject.stealthex.networkCode = coinNetworkCode;
      exchangeObject.stealthex.coinResponseData = coinResponse;
      break;
    }
    case "letsexchange": {
      exchangeObject.letsexchange.status = bool;
      exchangeObject.letsexchange.ticker = ticker;
      exchangeObject.letsexchange.name = coinName;
      exchangeObject.letsexchange.requiresExtraId = hasExtraId;
      exchangeObject.letsexchange.networkCode = coinNetworkCode;
      exchangeObject.letsexchange.coinResponseData = coinResponse;
      break;
    }
    case "godex": {
      exchangeObject.godex.status = bool;
      exchangeObject.godex.ticker = ticker;
      exchangeObject.godex.name = coinName;
      exchangeObject.godex.requiresExtraId = hasExtraId;
      exchangeObject.godex.networkCode = coinNetworkCode;
      exchangeObject.godex.coinResponseData = coinResponse;
      break;
    }
    case "simpleswap": {
      exchangeObject.simpleswap.status = bool;
      exchangeObject.simpleswap.ticker = ticker;
      exchangeObject.simpleswap.name = coinName;
      exchangeObject.simpleswap.requiresExtraId = hasExtraId;
      exchangeObject.simpleswap.networkCode = coinNetworkCode;
      exchangeObject.simpleswap.coinResponseData = coinResponse;
      break;
    }
    case "easybit": {
      exchangeObject.easybit.status = bool;
      exchangeObject.easybit.ticker = ticker;
      exchangeObject.easybit.name = coinName;
      exchangeObject.easybit.requiresExtraId = hasExtraId;
      exchangeObject.easybit.networkCode = coinNetworkCode;
      exchangeObject.easybit.coinResponseData = coinResponse;
      break;
    }
  }

  return exchangeObject;
}

// This Function counts number of trues from the object
export function countActiveStatus(data) {
  return Object.values(data).filter((item) => item.status === 1).length;
}
// ************************************************************************ End *************************************************************************

// These functions used in transaction update cron job
// ************************************************************************ Start *************************************************************************
//Two Days Difference Calculation
export function is48HoursDifference(timestamp1, timestamp2, exchange, id) {
  // Calculate the difference in milliseconds
  const differenceInMilliseconds = Math.abs(timestamp1 - timestamp2);

  // Convert the difference to hours
  const differenceInHours = differenceInMilliseconds / (1000 * 60 * 60);
  // console.log(`Difference in hours of exchange ${exchange} and transaction ID ${id} = ${differenceInHours}`);
  // Check if the difference is exactly 48 hours
  return differenceInHours >= 48;
}

// Function that appends hash in transaction url
export function replaceOrAppendHash(url, transactionHash) {
  if (!url || !transactionHash) return null; // Check for null/undefined input

  if (url.includes("{}")) {
    // Replace '{}' with transaction hash
    return url.replace("{}", transactionHash);
  } else {
    // Check if the URL ends with '/'
    if (!url.endsWith("/")) {
      url += "/"; // Add '/' at the end if not present
    }
    // Append the transaction hash after the '/'
    return url + transactionHash;
  }
}
// ************************************************************************ End *************************************************************************

// This function is responsible for removing network name from ticker and creation of short name;
export function findNetwork(term, search) {
  let fullString = term.toLowerCase();
  let searchTerm = search.toLowerCase();
  if (
    fullString.endsWith(searchTerm) &&
    fullString.length > searchTerm.length &&
    fullString !== searchTerm
  ) {
    return fullString.slice(0, fullString.length - searchTerm.length).trim();
  } else {
    return fullString;
  }
}

// This function will remove Brackets and content inside bracket
export function removeBracketsAndContent(str) {
  return str.replace(/\s*\([^)]*\)/g, "").trim();
}

// This function is rresponsible for validating email. Returns false if email is not valid and true if it is a valid email
export function checkEmailValidation(email) {
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!email) {
    return false;
  }

  if (email.length < 1) {
    return false;
  } else {
    return regex.test(email);
  }
}

// This function checks if any part of the search string is present in any string of the array
export function isStringInArray(searchString, stringArray) {
  if (
    !searchString ||
    !Array.isArray(stringArray) ||
    stringArray.length === 0
  ) {
    return false;
  }

  return stringArray.some((compareString) =>
    searchString.includes(compareString)
  );
}

export function filterArrayByNotifications(array1, array2) {
  // Create a Set of all original_notification values in array2
  const notificationsSet = new Set(
    array2.map((obj) => obj.original_notification)
  );

  // Filter array1 to keep only matching notifications
  return array1.filter((obj) =>
    notificationsSet.has(obj.original_notification)
  );
}

export function getTxExplorerLink(network, txHash) {
  if (!network || !txHash) return null;

  const n = network.toLowerCase();

  const map = {
    // ─── A ──────────────────────────────────────────────
    ada: "https://blockchair.com/cardano/transaction/{}?from=coinoswap",
    arbitrum: "https://arbiscan.io/tx/{}",
    "arbitrum-one":
      "https://blockchair.com/arbitrum-one/transaction/{}?from=coinoswap",
    arbitrumone:
      "https://blockchair.com/arbitrum-one/transaction/{}?from=coinoswap",
    apt: "https://blockchair.com/aptos/transaction/{}?from=coinoswap",
    aptos: "https://blockchair.com/aptos/transaction/{}?from=coinoswap",
    avax: "https://blockchair.com/avalanche/transaction/{}?from=coinoswap",
    avalanche: "https://blockchair.com/avalanche/transaction/{}?from=coinoswap",
    avaxc: "https://blockchair.com/avalanche/transaction/{}?from=coinoswap",

    // ─── B ──────────────────────────────────────────────
    base: "https://blockchair.com/base/transaction/{}?from=coinoswap",
    basealt: "https://basescan.org/tx/{}",
    beaconchain: "https://blockchair.com/bnb/transaction/{}?from=coinoswap",
    "beacon-chain": "https://blockchair.com/bnb/transaction/{}?from=coinoswap",
    bch: "https://blockchair.com/bitcoin-cash/transaction/{}?from=coinoswap",
    "bitcoin-cash":
      "https://blockchair.com/bitcoin-cash/transaction/{}?from=coinoswap",
    bitcoincash:
      "https://blockchair.com/bitcoin-cash/transaction/{}?from=coinoswap",
    bitcoin: "https://blockchair.com/bitcoin/transaction/{}?from=coinoswap",
    bnb: "https://blockchair.com/bnb/transaction/{}?from=coinoswap",
    bsc: "https://blockchair.com/bnb/transaction/{}?from=coinoswap",
    bnbchain: "https://explorer.bnbchain.org/tx/{}",
    bob: "https://blockchair.com/bob/transaction/{}?from=coinoswap",
    botanix: "https://blockchair.com/botanix/transaction/{}?from=coinoswap",
    btc: "https://blockchair.com/bitcoin/transaction/{}?from=coinoswap",

    // ─── C ──────────────────────────────────────────────
    cardano: "https://blockchair.com/cardano/transaction/{}?from=coinoswap",

    // ─── D ──────────────────────────────────────────────
    dash: "https://blockchair.com/dash/transaction/{}?from=coinoswap",
    dgb: "https://blockchair.com/digibyte/transaction/{}?from=coinoswap",
    digibyte: "https://blockchair.com/digibyte/transaction/{}?from=coinoswap",
    doge: "https://blockchair.com/dogecoin/transaction/{}?from=coinoswap",
    dogecoin: "https://blockchair.com/dogecoin/transaction/{}?from=coinoswap",
    dot: "https://blockchair.com/polkadot/transaction/{}?from=coinoswap",
    polkadot: "https://blockchair.com/polkadot/transaction/{}?from=coinoswap",

    // ─── E ──────────────────────────────────────────────
    ecash: "https://blockchair.com/ecash/transaction/{}?from=coinoswap",
    etc: "https://blockchair.com/ethereum-classic/transaction/{}?from=coinoswap",
    "ethereum-classic":
      "https://blockchair.com/ethereum-classic/transaction/{}?from=coinoswap",
    ethereumclassic:
      "https://blockchair.com/ethereum-classic/transaction/{}?from=coinoswap",
    eth: "https://blockchair.com/ethereum/transaction/{}?from=coinoswap",
    ethereum: "https://blockchair.com/ethereum/transaction/{}?from=coinoswap",
    etherscan: "https://etherscan.io/tx/{}",
    eca: "https://blockchair.com/ecash/transaction/{}?from=coinoswap",

    // ─── F ──────────────────────────────────────────────
    fantom: "https://blockchair.com/fantom/transaction/{}?from=coinoswap",
    firo: "https://blockchair.com/firo/transaction/{}?from=coinoswap",
    ftm: "https://blockchair.com/fantom/transaction/{}?from=coinoswap",

    // ─── G ──────────────────────────────────────────────
    glmr: "https://blockchair.com/moonbeam/transaction/{}?from=coinoswap",
    gnosis: "https://blockchair.com/gnosis-chain/transaction/{}?from=coinoswap",
    "gnosis-chain":
      "https://blockchair.com/gnosis-chain/transaction/{}?from=coinoswap",
    grs: "https://blockchair.com/groestlcoin/transaction/{}?from=coinoswap",
    groestlcoin:
      "https://blockchair.com/groestlcoin/transaction/{}?from=coinoswap",

    // ─── H ──────────────────────────────────────────────
    handshake: "https://blockchair.com/handshake/transaction/{}?from=coinoswap",
    hns: "https://blockchair.com/handshake/transaction/{}?from=coinoswap",

    // ─── K ──────────────────────────────────────────────
    ksm: "https://blockchair.com/kusama/transaction/{}?from=coinoswap",
    kusama: "https://blockchair.com/kusama/transaction/{}?from=coinoswap",

    // ─── L ──────────────────────────────────────────────
    lbtc: "https://blockchair.com/liquid-network/transaction/{}?from=coinoswap",
    "l-btc":
      "https://blockchair.com/liquid-network/transaction/{}?from=coinoswap",
    litecoin: "https://blockchair.com/litecoin/transaction/{}?from=coinoswap",
    ltc: "https://blockchair.com/litecoin/transaction/{}?from=coinoswap",

    // ─── M ──────────────────────────────────────────────
    manta: "https://manta.subscan.io/extrinsic/{}",
    matic: "https://blockchair.com/polygon/transaction/{}?from=coinoswap",
    moonbeam: "https://blockchair.com/moonbeam/transaction/{}?from=coinoswap",
    monero: "https://blockchair.com/monero/transaction/{}?from=coinoswap",
    xmr: "https://blockchair.com/monero/transaction/{}?from=coinoswap",
    polygon: "https://blockchair.com/polygon/transaction/{}?from=coinoswap",
    "polygon-pos":
      "https://blockchair.com/polygon/transaction/{}?from=coinoswap",
    "polygon-zkevm":
      "https://blockchair.com/polygon-zkevm/transaction/{}?from=coinoswap",
    polygonzkevm:
      "https://blockchair.com/polygon-zkevm/transaction/{}?from=coinoswap",

    // ─── O ──────────────────────────────────────────────
    op: "https://blockchair.com/optimism/transaction/{}?from=coinoswap",
    opbnb: "https://blockchair.com/opbnb/transaction/{}?from=coinoswap",
    optimism: "https://blockchair.com/optimism/transaction/{}?from=coinoswap",
    optimismio: "https://optimistic.etherscan.io/tx/{}",

    // ─── P ──────────────────────────────────────────────
    peercoin:
      "https://blockchair.com/beacon-chain/transaction/{}?from=coinoswap",
    ppc: "https://blockchair.com/beacon-chain/transaction/{}?from=coinoswap",

    // ─── R ──────────────────────────────────────────────
    rbtc: "https://blockchair.com/rootstock/transaction/{}?from=coinoswap",
    rootstock: "https://blockchair.com/rootstock/transaction/{}?from=coinoswap",
    "root-stock":
      "https://blockchair.com/rootstock/transaction/{}?from=coinoswap",

    // ─── S ──────────────────────────────────────────────
    scroll: "https://scrollscan.com/tx/{}",
    sei: "https://blockchair.com/sei-evm/transaction/{}?from=coinoswap",
    "sei-evm": "https://blockchair.com/sei-evm/transaction/{}?from=coinoswap",
    seism: "https://blockchair.com/sei-evm/transaction/{}?from=coinoswap",
    sol: "https://blockchair.com/solana/transaction/{}?from=coinoswap",
    solana: "https://blockchair.com/solana/transaction/{}?from=coinoswap",
    solscan: "https://solscan.io/tx/{}",
    starknet: "https://starkscan.co/tx/{}",
    stellar: "https://blockchair.com/stellar/transaction/{}?from=coinoswap",
    xlm: "https://blockchair.com/stellar/transaction/{}?from=coinoswap",
    xlmalt: "https://stellar.expert/explorer/public/tx/{}",

    // ─── T ──────────────────────────────────────────────
    ton: "https://blockchair.com/ton/transaction/{}?from=coinoswap",
    tron: "https://blockchair.com/tron/transaction/{}?from=coinoswap",
    trx: "https://blockchair.com/tron/transaction/{}?from=coinoswap",
    tronscan: "https://tronscan.org/#/transaction/{}",

    // ─── X ──────────────────────────────────────────────
    xec: "https://blockchair.com/ecash/transaction/{}?from=coinoswap",
    xrpl: "https://blockchair.com/xrp-ledger/transaction/{}?from=coinoswap",
    "xrp-ledger":
      "https://blockchair.com/xrp-ledger/transaction/{}?from=coinoswap",
    xzc: "https://blockchair.com/firo/transaction/{}?from=coinoswap",

    // ─── Z ──────────────────────────────────────────────
    zcash: "https://blockchair.com/zcash/transaction/{}?from=coinoswap",
    zec: "https://blockchair.com/zcash/transaction/{}?from=coinoswap",
    zkevm: "https://blockchair.com/polygon-zkevm/transaction/{}?from=coinoswap",
    zksync: "https://explorer.zksync.io/tx/{}",
    zksyncera: "https://explorer.zksync.io/tx/{}",
  };

  const template = map[n];
  return template ? template.replace("{}", txHash) : null;
}
