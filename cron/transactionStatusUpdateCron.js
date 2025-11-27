import { db } from "../database/connectdb.js";
import request from "request";
import crypto from "crypto";
import fetch from "node-fetch";
import cron from "node-cron";
import dotenv from "dotenv";
import {
  is48HoursDifference,
  replaceOrAppendHash,
  getTxExplorerLink,
} from "../Js/functions.js";
import util from "util";

const query = util.promisify(db.query).bind(db);
dotenv.config();


export function updateTransactionStatus() {
  db.query(
    "SELECT * FROM cron_job WHERE type=?",
    ["status/removal cron"],
    (error, result) => {
      if (!error) {
        cron.schedule(
          `${result[0].second} ${result[0].minute} ${result[0].hour} ${result[0].date_of_month} ${result[0].month} ${result[0].day_of_week}`,
          async () => {
            //Qyery for fetching coins fetching coins from database
            try {
              // Changelly
              db.query(
                "SELECT * FROM changelly_transactions",
                (error, result) => {
                  if (result.length > 0) {
                    result.map((swap) => {
                      // This condition checks if a transaction is successfull then it doesnot perform any logic
                      if (
                        swap.status != "finished" &&
                        swap.status != "success" &&
                        swap.status != "Complete"
                      ) {
                        const currentTimestamp = Date.now(); // Current timestamp
                        const isValid = is48HoursDifference(
                          currentTimestamp,
                          swap.time,
                          "Changelly",
                          swap.transaction_id
                        );
                        try {
                          const privateKey = crypto.createPrivateKey({
                            key: process.env.CHANGELLY_PRIVATE_KEY,
                            format: "der",
                            type: "pkcs8",
                            encoding: "hex",
                          });

                          const publicKey = crypto
                            .createPublicKey(privateKey)
                            .export({
                              type: "pkcs1",
                              format: "der",
                            });

                          const message = {
                            jsonrpc: "2.0",
                            id: "test",
                            method: "getTransactions",
                            params: {
                              id: swap.transaction_id,
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

                          const params = {
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

                          request(params, async function (error, response) {
                            try {
                              if (error) {
                                // Return here only stops further execution inside this callback, not the parent function
                                return;
                              }
                              //This logic checks if time difference is greater than two days and status is not finished and successfull then delete transaction
                              if (isValid && swap.status != "finished") {
                                db.query(
                                  "DELETE FROM changelly_transactions WHERE transaction_id=?",
                                  [swap.transaction_id],
                                  (error, result) => {
                                    if (error) {
                                    }
                                  }
                                );
                              } else {
                                const data = await JSON.parse(response.body);

                                //Logic for updating Exchange Start Time
                                if (
                                  data.result[0].status &&
                                  (data.result[0].status == "confirming" ||
                                    data.result[0].status == "confirmation" ||
                                    data.result[0].status == "confirmed")
                                ) {
                                  db.query(
                                    `UPDATE changelly_transactions SET start_time=NOW() WHERE transaction_id=?`[
                                      swap.transaction_id
                                    ],
                                    (error, result) => {
                                      if (error) {
                                      }
                                    }
                                  );
                                }

                                // Explorer link logic
                                if (
                                  data.result[0].status &&
                                  data.result[0].payoutHash
                                ) {
                                  let tx_explorer = null;

                                  tx_explorer = getTxExplorerLink(
                                    swap.get_coin_network,
                                    data.result[0].payoutHash
                                  );

                                  if (!tx_explorer) {
                                    if (
                                      data.result[0].payoutHashLink !== null ||
                                      data.result[0].payoutHashLink !== ""
                                    ) {
                                      tx_explorer =
                                        data.result[0].payoutHashLink;
                                    }
                                  }

                                  db.query(
                                    `UPDATE changelly_transactions SET status=?, tx_hash=?, tx_hash_link=?, sell_amount=?, get_amount=?, completion_time=NOW(), rate=? WHERE transaction_id=?`,
                                    [
                                      data.result[0].status,
                                      data.result[0].payoutHash,
                                      tx_explorer,
                                      data.result[0].amountFrom,
                                      data.result[0].amountTo,
                                      data.result[0].rate,
                                      swap.transaction_id,
                                    ],
                                    (error, result) => {
                                      if (error) {
                                      }
                                    }
                                  );
                                } else if (data.result[0].status) {
                                  db.query(
                                    `UPDATE changelly_transactions SET status=?, completion_time=NOW() WHERE transaction_id=?`,
                                    [
                                      data.result[0].status,
                                      swap.transaction_id,
                                    ],
                                    (error, result) => {
                                      if (error) {
                                      }
                                    }
                                  );
                                }
                              }
                            } catch (error) {
                            }
                          });
                        } catch (error) {
                        }
                      }
                    });
                  }
                }
              );

              // Changenow
              db.query(
                "SELECT * FROM changenow_transactions",
                async (error, result) => {
                  if (result.length > 0) {
                    const currentTimestamp = Date.now(); // Current timestamp
                    result.map(async (swap) => {
                      if (
                        swap.status != "finished" &&
                        swap.status != "success" &&
                        swap.status != "Complete"
                      ) {
                        const isValid = is48HoursDifference(
                          currentTimestamp,
                          swap.time,
                          "Changenow",
                          swap.transaction_id
                        );
                        try {
                          if (isValid && swap.status !== "finished") {
                            db.query(
                              "DELETE FROM changenow_transactions WHERE transaction_id=?",
                              [swap.transaction_id],
                              (error, result) => {
                                if (error) {
                                }
                              }
                            );
                          } else {
                            const url = `https://api.changenow.io/v2/exchange/by-id?id=${swap.transaction_id}`;

                            const options = {
                              method: "GET",
                              headers: {
                                "Content-Type": "application/json",
                                "x-changenow-api-key": `${process.env.CHANGENOW}`,
                              },
                            };

                            const response = await fetch(url, options);

                            const data = await response.json();
                            //Logic for updating Exchange Start Time
                            if (
                              data.status &&
                              (data.status == "confirming" ||
                                data.status == "confirmation" ||
                                data.status == "confirmed")
                            ) {
                              db.query(
                                `UPDATE changenow_transactions SET start_time=NOW() WHERE transaction_id=?`[
                                  swap.transaction_id
                                ],
                                (error, result) => {
                                  if (error) {
                                  }
                                }
                              );
                            }

                            if (
                              data.status &&
                              data.payoutHash &&
                              data.payoutHash != ""
                            ) {
                              let tx_explorer = null;

                              tx_explorer = getTxExplorerLink(
                                swap.get_coin_network,
                                data.payoutHash
                              );

                              db.query(
                                `UPDATE changenow_transactions SET status=?, tx_hash=?, tx_hash_link=?, sell_amount=?, get_amount=?, completion_time=NOW() WHERE transaction_id=?`,
                                [
                                  data.status,
                                  data.payoutHash,
                                  tx_explorer,
                                  data.amountFrom,
                                  data.amountTo,
                                  swap.transaction_id,
                                ],
                                (error, result) => {
                                  if (error) {
                                  }
                                }
                              );
                            } else if (data.status) {
                              db.query(
                                `UPDATE changenow_transactions SET status=?, completion_time=NOW() WHERE transaction_id=?`,
                                [data.status, swap.transaction_id],
                                (error, result) => {
                                  if (error) {
                                  }
                                }
                              );
                            } else {
                            }
                          }
                        } catch (error) {
                        }
                      }
                    });
                  }
                }
              );

              // Changehero
              db.query(
                "SELECT * FROM changehero_transactions",
                (error, result) => {
                  if (result.length > 0) {
                    const currentTimestamp = Date.now(); // Current timestamp
                    result.map(async (swap, index) => {
                      if (
                        swap.status != "finished" &&
                        swap.status != "success" &&
                        swap.status != "Complete"
                      ) {
                        const isValid = is48HoursDifference(
                          currentTimestamp,
                          swap.time,
                          "Changehero",
                          swap.transaction_id
                        );
                        try {
                          if (isValid && swap.status !== "finished") {
                            db.query(
                              "DELETE FROM changehero_transactions WHERE transaction_id=?",
                              [swap.transaction_id],
                              (error, result) => {
                                if (error) {
                                }
                              }
                            );
                          } else {
                            const url = `https://api.changehero.io/v2/`;

                            const params = {
                              jsonrpc: "2.0",
                              method: "getTransactions",
                              params: {
                                id: `${swap.transaction_id}`,
                              },
                            };

                            const options = {
                              method: "POST",
                              headers: {
                                "Content-Type": "application/json",
                                "api-key": `${process.env.CHANGEHERO}`,
                              },
                              body: JSON.stringify(params),
                            };

                            const response = await fetch(url, options);
                            const data = await response.json();
                            if (
                              data.result[0].status &&
                              (data.result[0].status == "confirming" ||
                                data.result[0].status == "confirmation" ||
                                data.result[0].status == "confirmed")
                            ) {
                              db.query(
                                `UPDATE changehero_transactions SET start_time=NOW() WHERE transaction_id=?`[
                                  swap.transaction_id
                                ],
                                (error, result) => {
                                  if (error) {
                                  }
                                }
                              );
                            }
                            if (
                              data.result[0].status &&
                              data.result[0].payoutHash &&
                              data.result[0].payoutHash != null
                            ) {
                              let tx_explorer = null;

                              tx_explorer = getTxExplorerLink(
                                swap.get_coin_network,
                                data.result[0].payoutHash
                              );

                              db.query(
                                `UPDATE changehero_transactions SET status=?, tx_hash=?, tx_hash_link=?, sell_amount=?, get_amount=?, completion_time=NOW() WHERE transaction_id=?`,
                                [
                                  data.result[0].status,
                                  data.result[0].payoutHash,
                                  tx_explorer,
                                  data.result[0].amountFrom &&
                                    data.result[0].amountFrom,
                                  data.result[0].amountTo &&
                                    data.result[0].amountTo,
                                  swap.transaction_id,
                                ],
                                (error, result) => {
                                  if (error) {
                                  }
                                }
                              );
                            } else if (data.result[0].status) {
                              db.query(
                                `UPDATE changehero_transactions SET status=?, completion_time=NOW() WHERE transaction_id=?`,
                                [data.result[0].status, swap.transaction_id],
                                (error, result) => {
                                  if (error) {
                                  }
                                }
                              );
                            } else {
                            }
                          }
                        } catch (error) {
                        }
                      }
                    });
                  }
                }
              );

              // Exolix
              db.query("SELECT * FROM exolix_transactions", (error, result) => {
                if (result.length > 0) {
                  const currentTimestamp = Date.now(); // Current timestamp
                  result.map(async (swap, index) => {
                    if (
                      swap.status != "finished" &&
                      swap.status != "success" &&
                      swap.status != "Complete"
                    ) {
                      try {
                        const isValid = is48HoursDifference(
                          currentTimestamp,
                          swap.time,
                          "Exolix",
                          swap.transaction_id
                        );

                        // Logic for deletion of outstanding transaction
                        if (isValid && swap.status !== "success") {
                          db.query(
                            "DELETE FROM exolix_transactions WHERE transaction_id=?",
                            [swap.transaction_id],
                            (error, result) => {
                              if (error) {
                              }
                            }
                          );
                        } else {
                          const url = `https://exolix.com/api/v2/transactions/${swap.transaction_id}`;
                          const options = {
                            method: "GET",
                            headers: {
                              "Content-Type": "application/json",
                            },
                          };

                          const response = await fetch(url, options);

                          const data = await response.json();
                          if (
                            data.status &&
                            (data.status == "confirming" ||
                              data.status == "confirmation" ||
                              data.status == "confirmed")
                          ) {
                            db.query(
                              `UPDATE exolix_transactions SET start_time=NOW() WHERE transaction_id=?`[
                                swap.transaction_id
                              ],
                              (error, result) => {
                                if (error) {
                                }
                              }
                            );
                          }
                          if (
                            data.status &&
                            data.hashOut.hash &&
                            data.hashOut.hash != null
                          ) {
                            let tx_explorer = null;

                            tx_explorer = getTxExplorerLink(
                              swap.get_coin_network,
                              data.hashOut.hash
                            );

                            if (!tx_explorer) {
                              if (data.hashOut.link !== null) {
                                tx_explorer = data.hashOut.link;
                              }
                            }

                            db.query(
                              `UPDATE exolix_transactions SET status=?, tx_hash=?, tx_hash_link=?, sell_amount=?, get_amount=?, completion_time=NOW(), rate=? WHERE transaction_id=?`,
                              [
                                data.status,
                                data.hashOut.hash,
                                tx_explorer,
                                data.amount,
                                data.amountTo,
                                data.rate,
                                swap.transaction_id,
                              ],
                              (error, result) => {
                                if (error) {
                                }
                              }
                            );
                          } else if (data.status) {
                            db.query(
                              `UPDATE exolix_transactions SET status=?, completion_time=NOW() WHERE transaction_id=?`,
                              [data.status, swap.transaction_id],
                              (error, result) => {
                                if (error) {
                                }
                              }
                            );
                          } else {
                          }
                        }
                      } catch (error) {
                      }
                    }
                  });
                }
              });

              // Godex
              db.query("SELECT * FROM godex_transactions", (error, result) => {
                if (result.length > 0) {
                  const currentTimestamp = Date.now(); // Current timestamp
                  result.map(async (swap) => {
                    if (
                      swap.status != "finished" &&
                      swap.status != "success" &&
                      swap.status != "Complete"
                    ) {
                      try {
                        const isValid = is48HoursDifference(
                          currentTimestamp,
                          swap.time,
                          "Godex",
                          swap.transaction_id
                        );
                        if (isValid && swap.status != "success") {
                          db.query(
                            "DELETE FROM godex_transactions WHERE transaction_id=?",
                            [swap.transaction_id],
                            (error, result) => {
                              if (error) {
                              }
                            }
                          );
                        } else {
                          const url = `http://api.godex.io/api/v1/transaction/${swap.transaction_id}`;

                          const options = {
                            method: "GET",
                            headers: {
                              "Content-Type": "application/json",
                              Accept: "application/json",
                            },
                          };

                          const response = await fetch(url, options);

                          const data = await response.json();
                          if (
                            data.status &&
                            (data.status == "confirming" ||
                              data.status == "confirmation" ||
                              data.status == "confirmed")
                          ) {
                            db.query(
                              `UPDATE godex_transactions SET start_time=NOW() WHERE transaction_id=?`[
                                swap.transaction_id
                              ],
                              (error, result) => {
                                if (error) {
                                }
                              }
                            );
                          }
                          if (
                            data.status &&
                            data.hash_out &&
                            data.hash_out !== null
                          ) {
                            let tx_explorer = null;

                            tx_explorer = getTxExplorerLink(
                              swap.get_coin_network,
                              data.hash_out
                            );

                            if (!tx_explorer) {
                              if (data.coin_to_explorer_url !== null) {
                                tx_explorer = replaceOrAppendHash(
                                  data.coin_to_explorer_url,
                                  data.hash_out
                                );
                              }
                            }

                            db.query(
                              `UPDATE godex_transactions SET status=?, tx_hash=?, tx_hash_link=?, sell_amount=?, get_amount=?, completion_time=NOW(), rate=? WHERE transaction_id=?`,
                              [
                                data.status,
                                data.hash_out,
                                tx_explorer,
                                data.deposit_amount,
                                data.real_withdrawal_amount,
                                data.rate,
                                swap.transaction_id,
                              ],
                              (error, result) => {
                                if (error) {
                                }
                              }
                            );
                          } else if (data.status) {
                            db.query(
                              `UPDATE godex_transactions SET status=?, completion_time=NOW() WHERE transaction_id=?`,
                              [data.status, swap.transaction_id],
                              (error, result) => {
                                if (error) {
                                }
                              }
                            );
                          } else {
                          }
                        }
                      } catch (error) {
                      }
                    }
                  });
                }
              });

              // Letsexchange
              db.query(
                "SELECT * FROM letsexchange_transactions",
                (error, result) => {
                  if (result.length > 0) {
                    const currentTimestamp = Date.now(); // Current timestamp
                    result.map(async (swap) => {
                      if (
                        swap.status != "finished" &&
                        swap.status != "success" &&
                        swap.status != "Complete"
                      ) {
                        try {
                          const isValid = is48HoursDifference(
                            currentTimestamp,
                            swap.time,
                            "Letsexchange",
                            swap.transaction_id
                          );
                          if (isValid && swap.status != "success") {
                            db.query(
                              "DELETE FROM letsexchange_transactions WHERE transaction_id=?",
                              [swap.transaction_id],
                              (error, result) => {
                                if (error) {
                                }
                              }
                            );
                          } else {
                            const url = `https://api.letsexchange.io/api/v1/transaction/${swap.transaction_id}`;

                            const options = {
                              method: "GET",
                              headers: {
                                "Content-Type": "application/json",
                                Authorization: `${process.env.LETSEXCHANGE}`,
                                Accept: "application/json",
                              },
                            };

                            const response = await fetch(url, options);

                            const data = await response.json();
                            if (
                              data.status &&
                              (data.status == "confirming" ||
                                data.status == "confirmation" ||
                                data.status == "confirmed")
                            ) {
                              db.query(
                                `UPDATE letsexchange_transactions SET start_time=NOW() WHERE transaction_id=?`[
                                  swap.transaction_id
                                ],
                                (error, result) => {
                                  if (error) {
                                  }
                                }
                              );
                            }
                            if (
                              data.status &&
                              data.hash_out &&
                              data.hash_out != null
                            ) {
                              let tx_explorer = null;

                              tx_explorer = getTxExplorerLink(
                                swap.get_coin_network,
                                data.hash_out
                              );

                              if (!tx_explorer) {
                                if (data.coin_to_explorer_url !== null) {
                                  tx_explorer = replaceOrAppendHash(
                                    data.coin_to_explorer_url,
                                    data.hash_out
                                  );
                                }
                              }

                              db.query(
                                `UPDATE letsexchange_transactions SET status=?, tx_hash=?, tx_hash_link=?, sell_amount=?, get_amount=?, completion_time=NOW(), rate=? WHERE transaction_id=?`,
                                [
                                  data.status,
                                  data.hash_out,
                                  tx_explorer,
                                  data.real_deposit_amount,
                                  data.real_withdrawal_amount,
                                  data.rate,
                                  swap.transaction_id,
                                ],
                                (error, result) => {
                                  if (error) {
                                  }
                                }
                              );
                            } else if (data.status) {
                              db.query(
                                `UPDATE letsexchange_transactions SET status=?, completion_time=NOW() WHERE transaction_id=?`,
                                [data.status, swap.transaction_id],
                                (error, result) => {
                                  if (error) {
                                  }
                                }
                              );
                            } else {
                            }
                          }
                        } catch (error) {
                        }
                      }
                    });
                  }
                }
              );

              // Stealthex
              db.query(
                "SELECT * FROM stealthex_transactions",
                (error, result) => {
                  if (result.length > 0) {
                    const currentTimestamp = Date.now(); // Current timestamp
                    result.map(async (swap, index) => {
                      if (
                        swap.status != "finished" &&
                        swap.status != "success" &&
                        swap.status != "Complete"
                      ) {
                        try {
                          const isValid = is48HoursDifference(
                            currentTimestamp,
                            swap.time,
                            "Stealthex",
                            swap.transaction_id
                          );
                          // If transaction is 2 days old and is not completed
                          if (isValid && swap.status !== "finished") {
                            db.query(
                              "DELETE FROM stealthex_transactions WHERE transaction_id=?",
                              [swap.transaction_id],
                              (error, result) => {
                                if (error) {
                                }
                              }
                            );

                            // If swap still in progress
                          } else {
                            const url = `https://api.stealthex.io/api/v2/exchange/${swap.transaction_id}?api_key=${process.env.STEALTHEX}`;
                            const options = {
                              method: "GET",
                              headers: {
                                "Content-Type": "application/json",
                              },
                            };

                            const response = await fetch(url, options);
                            let data = await response.json();

                            if (
                              data.status &&
                              (data.status == "confirming" ||
                                data.status == "confirmation" ||
                                data.status == "confirmed")
                            ) {
                              db.query(
                                `UPDATE stealthex_transactions SET start_time=NOW() WHERE transaction_id=?`[
                                  swap.transaction_id
                                ],
                                (error, result) => {
                                  if (error) {
                                  }
                                }
                              );
                            }
                            let keys = Object.keys(data.currencies); // Get the keys as an array
                            let keyAtIndex = keys[1]; // Get the key at the specified index
                            let innerObject = data.currencies[keyAtIndex]; // Access the inner object using the key

                            if (data.status && data.tx_to && data.tx_to != "") {
                              let tx_explorer = null;
                              tx_explorer = getTxExplorerLink(
                                swap.get_coin_network,
                                data.tx_to
                              );

                              if (!tx_explorer) {
                                if (
                                  innerObject.tx_explorer !== null ||
                                  innerObject.tx_explorer !== ""
                                ) {
                                  tx_explorer = replaceOrAppendHash(
                                    innerObject.tx_explorer,
                                    data.tx_to
                                  );
                                }
                              }

                              db.query(
                                `UPDATE stealthex_transactions SET status=?, tx_hash=?, tx_hash_link=?, sell_amount=?, get_amount=?, completion_time=NOW() WHERE transaction_id=?`,
                                [
                                  data.status,
                                  data.tx_to,
                                  tx_explorer,
                                  data.amount_from,
                                  data.amount_to,
                                  swap.transaction_id,
                                ],
                                (error, result) => {
                                  if (error) {
                                  }
                                }
                              );
                            } else if (data.status) {
                              db.query(
                                `UPDATE stealthex_transactions SET status=?, completion_time=NOW() WHERE transaction_id=?`,
                                [data.status, swap.transaction_id],
                                (error, result) => {
                                  if (error) {
                                  }
                                }
                              );
                            } else {
                            }
                          }
                        } catch (error) {
                        }
                      }
                    });
                  }
                }
              );

              // Simpleswap
              db.query(
                "SELECT * FROM simpleswap_transactions",
                (error, result) => {
                  if (result.length > 0) {
                    const currentTimestamp = Date.now(); // Current timestamp
                    result.map(async (swap, index) => {
                      if (
                        swap.status != "finished" &&
                        swap.status != "success" &&
                        swap.status != "Complete"
                      ) {
                        try {
                          const isValid = is48HoursDifference(
                            currentTimestamp,
                            swap.time,
                            "Simpleswap",
                            swap.transaction_id
                          );
                          if (isValid && swap.status != "finished") {
                            db.query(
                              "DELETE FROM simpleswap_transactions WHERE transaction_id=?",
                              [swap.transaction_id],
                              (error, result) => {
                                if (error) {
                                }
                              }
                            );
                          } else {
                            const url = `https://api.simpleswap.io/get_exchange?api_key=${process.env.SIMPLESWAP}&id=${swap.transaction_id}`;

                            const options = {
                              method: "GET",
                              headers: {
                                "Content-Type": "application/json",
                                Accept: "application/json",
                              },
                            };

                            const response = await fetch(url, options);
                            const data = await response.json();
                            if (
                              data.status &&
                              (data.status == "confirming" ||
                                data.status == "confirmation" ||
                                data.status == "confirmed")
                            ) {
                              db.query(
                                `UPDATE simpleswap_transactions SET start_time=NOW() WHERE transaction_id=?`[
                                  swap.transaction_id
                                ],
                                (error, result) => {
                                  if (error) {
                                  }
                                }
                              );
                            }
                            let keys = Object.keys(data.currencies); // Get the keys as an array
                            let keyAtIndex = keys[1]; // Get the key at the specified index
                            let innerObject = data.currencies[keyAtIndex]; // Access the inner object using the key

                            if (data.status && data.tx_to && data.tx_to != "") {
                              let tx_explorer = null;

                              tx_explorer = getTxExplorerLink(
                                swap.get_coin_network,
                                data.tx_to
                              );

                              if (!tx_explorer) {
                                if (
                                  innerObject.tx_explorer !== null ||
                                  innerObject.tx_explorer !== ""
                                ) {
                                  tx_explorer = replaceOrAppendHash(
                                    innerObject.tx_explorer,
                                    data.tx_to
                                  );
                                }
                              }

                              db.query(
                                `UPDATE simpleswap_transactions SET status=?, tx_hash=?, tx_hash_link=?, sell_amount=?, get_amount=?, completion_time=NOW() WHERE transaction_id=?`,
                                [
                                  data.status,
                                  data.tx_to,
                                  tx_explorer,
                                  data.amount_from,
                                  data.amount_to,
                                  swap.transaction_id,
                                ],
                                (error, result) => {
                                  if (error) {
                                  }
                                }
                              );
                            } else if (data.status) {
                              db.query(
                                `UPDATE simpleswap_transactions SET status=?, completion_time=NOW() WHERE transaction_id=?`,
                                [data.status, swap.transaction_id],
                                (error, result) => {
                                  if (error) {
                                  }
                                }
                              );
                            } else {
                            }
                          }
                        } catch (error) {
                        }
                      }
                    });
                  }
                }
              );

              // Easybit
              db.query(
                "SELECT * FROM easybit_transactions",
                (error, result) => {
                  if (result.length > 0) {
                    const currentTimestamp = Date.now(); // Current timestamp
                    result.map(async (swap, index) => {
                      if (
                        swap.status != "finished" &&
                        swap.status != "success" &&
                        swap.status != "Complete"
                      ) {
                        try {
                          // This Logic checks if transaction failed and its been 48 hours then delete record
                          const isValid = is48HoursDifference(
                            currentTimestamp,
                            swap.time,
                            "Easybit",
                            swap.transaction_id
                          );
                          if (isValid && swap.status != "finished") {
                            db.query(
                              "DELETE FROM easybit_transactions WHERE transaction_id=?",
                              [swap.transaction_id],
                              (error, result) => {
                                if (error) {
                                }
                              }
                            );
                          } else {
                            // If transation is not finished then check for status
                            const url = `https://api.easybit.com/orderStatus?id=${swap.transaction_id}`;

                            const options = {
                              method: "GET",
                              headers: {
                                "Content-Type": "application/json",
                                "API-KEY": process.env.EASYBIT,
                              },
                            };

                            const response = await fetch(url, options);
                            const data = await response.json();
                            if (
                              data.data.status &&
                              (data.data.status == "confirming" ||
                                data.data.status == "confirmation" ||
                                data.data.status == "confirmed" ||
                                data.data.status == "Confirming Deposit")
                            ) {
                              db.query(
                                `UPDATE easybit_transactions SET start_time=NOW() WHERE transaction_id=?`[
                                  swap.transaction_id
                                ],
                                (error, result) => {
                                  if (error) {
                                  }
                                }
                              );
                            }

                            if (
                              data.data.status &&
                              data.data.hashOut &&
                              data.data.hashOut != ""
                            ) {
                              let tx_explorer = null;

                              tx_explorer = getTxExplorerLink(
                                swap.get_coin_network,
                                data.tx_to
                              );

                              db.query(
                                `UPDATE easybit_transactions SET status=?, tx_hash=?, tx_hash_link=?, sell_amount=?, get_amount=?, completion_time=NOW() WHERE transaction_id=?`,
                                [
                                  data.data.status,
                                  data.data.hashOut,
                                  tx_explorer,
                                  swap.sell_amount,
                                  data.data.receiveAmount,
                                  swap.transaction_id,
                                ],
                                (error, result) => {
                                  if (error) {
                                  }
                                }
                              );
                            } else if (data.data.status) {
                              db.query(
                                `UPDATE easybit_transactions SET status=?, completion_time=NOW() WHERE transaction_id=?`,
                                [data.data.status, swap.transaction_id],
                                (error, result) => {
                                  if (error) {
                                  }
                                }
                              );
                            } else {
                            }
                          }
                        } catch (error) {
                        }
                      }
                    });
                  }
                }
              );
            } catch (error) {
              // Do not do anything
            }
          }
        );
      }
    }
  );
}
