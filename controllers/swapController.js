import prisma from "../database/prisma.js";
import axios from "axios";
import crypto from "crypto";

class swapController {
  // This controller is responsible for updating swap coins into swap_crypto table
  static addCoins = async (req, res) => {
    try {
      // ---------- API CALLS ----------
      // Changelly API
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

      const changellyMessage = {
        jsonrpc: "2.0",
        id: "test",
        method: "getCurrenciesFull",
        params: {},
      };

      const signature = crypto.sign(
        "sha256",
        Buffer.from(JSON.stringify(changellyMessage)),
        {
          key: privateKey,
          type: "pkcs8",
          format: "der",
        }
      );

      // Changelly API
      const changellyResp = await axios.post(
        "https://api.changelly.com/v2",
        changellyMessage,
        {
          headers: {
            "Content-Type": "application/json",
            "X-Api-Key": crypto
              .createHash("sha256")
              .update(publicKey)
              .digest("base64"),
            "X-Api-Signature": signature.toString("base64"),
          },
        }
      );

      // ChangeNow API
      const changenowResp = await axios.get(
        `https://api.changenow.io/v2/exchange/currencies?active=true`,
        {
          headers: {
            "x-changenow-api-key": process.env.CHANGENOW,
          },
        }
      );

      // Changehero API
      const changeheroMessage = {
        jsonrpc: "2.0",
        method: "getCurrenciesFull",
        params: {},
      };

      const changeheroResp = await axios.post(
        "https://api.changehero.io/v2/",
        changeheroMessage,
        {
          headers: {
            "Content-Type": "application/json",
            "api-key": process.env.CHANGEHERO,
          },
        }
      );

      // Exolix API
      const exolixResp = await axios.get(
        "https://exolix.com/api/v2/currencies?withNetworks=true&all=true"
      );

      // StealthEX API
      const stealthexResp = await axios.get(
        `https://api.stealthex.io/api/v2/currency?api_key=${process.env.STEALTHEX}`
      );

      // Godex API
      const godexResp = await axios.get("https://api.godex.io/api/v1/coins");

      // LetsExchange API
      const letsexchangeResp = await axios.get(
        "https://api.letsexchange.io/api/v1/coins",
        {
          headers: {
            Authorization: process.env.LETSEXCHANGE,
          },
        }
      );

      // SimpleSwap API
      const simpleswapResp = await axios.get(
        `https://api.simpleswap.io/get_all_currencies?api_key=${process.env.SIMPLESWAP}`
      );

      // EasyBit API
      const easybitResp = await axios.get(
        "https://api.easybit.com/currencyList",
        {
          headers: {
            "API-KEY": process.env.EASYBIT,
          },
        }
      );

      let coins = [];
      let mappedCoins = [];

      // ---------- BUILD COIN OBJECTS ----------

      // Process Changelly coins
      if (changellyResp.data.result) {
        for (const c of changellyResp.data.result) {
          coins.push({
            standardTicker: c.ticker.toLowerCase() + c.blockchain.toLowerCase(),
            ticker: c.name,
            requiresExtraId: c.extraIdName ? true : false,
            name: c.fullName,
            network: c.blockchain || c.name,
            shortName: c.ticker.toLowerCase(),
            image: c.image || null,
            swapPartner: "changelly",
            mappedPartners: [],
            data: c,
            coinType: "other",
            isApproved: false,
            isStandard: false,
          });
        }
      }

      // return res.json({ coins: changellyResp.data.result });

      // Process ChangeNow coins
      if (changenowResp.data) {
        for (const c of changenowResp.data) {
          coins.push({
            standardTicker: c.ticker.toLowerCase() + c.network.toLowerCase(),
            ticker: c.ticker,
            requiresExtraId: c.isExtraIdSupported,
            name: c.name,
            network: c.network || c.ticker,
            shortName: c.ticker.toLowerCase(),
            image: c.image || null,
            swapPartner: "changenow",
            mappedPartners: [],
            data: c,
            coinType: "other",
            isApproved: false,
            isStandard: false,
          });
        }
      }

      // return res.json({ coins: changenowResp.data });

      // Process Changehero coins
      if (changeheroResp.data.result) {
        for (const c of changeheroResp.data.result) {
          let ticker = c.name;
          let network = c.blockchain || c.name;

          coins.push({
            standardTicker: ticker.toLowerCase() + network.toLowerCase(),
            ticker: ticker,
            requiresExtraId: c.extraIdName ? true : false,
            name: c.fullName,
            network: network,
            shortName: ticker.toLowerCase(),
            image: c.image || null,
            swapPartner: "changehero",
            mappedPartners: [],
            data: c,
            coinType: "other",
            isApproved: false,
            isStandard: false,
          });
        }
      }

      // return res.json({ coins: changeheroResp.data });

      // Process Exolix coins
      if (exolixResp.data.data) {
        for (const c of exolixResp.data.data) {
          const networks = c.networks || [];
          if (networks.length > 0) {
            for (const network of networks) {
              let standardTicker =
                c.code.toLowerCase() + network.network.toLowerCase();

              coins.push({
                standardTicker: standardTicker,
                ticker: c.code,
                requiresExtraId: network.memoNeeded,
                name: c.name,
                network: network.network,
                image: c.icon || null,
                swapPartner: "exolix",
                mappedPartners: [],
                data: c,
                coinType: "other",
                isApproved: false,
                isStandard: false,
              });
            }
          }
        }
      }

      // return res.json({ coins: exolixResp.data });

      // Process StealthEX coins
      if (stealthexResp.data) {
        for (const c of stealthexResp.data) {
          coins.push({
            standardTicker: c.symbol.toLowerCase() + c.network.toLowerCase(),
            ticker: c.symbol,
            requiresExtraId: c.has_extra_id ? true : false,
            name: c.name,
            network: c.network || c.symbol,
            image: c.image || null,
            swapPartner: "stealthex",
            mappedPartners: [],
            data: c,
            coinType: "other",
            isApproved: false,
            isStandard: false,
          });
        }
      }

      // return res.json({ coins: stealthexResp.data });

      // Process Godex coins
      if (godexResp.data) {
        for (const c of godexResp.data) {
          const networks = c.networks || [];
          if (networks.length > 0) {
            for (const network of networks) {
              let standardTicker =
                c.code.toLowerCase() + network.code.toLowerCase();

              coins.push({
                standardTicker: standardTicker,
                ticker: c.code,
                requiresExtraId: network.has_extra === 1 ? true : false,
                name: c.name,
                network: network.code,
                image: null,
                swapPartner: "godex",
                mappedPartners: [],
                data: c,
                coinType: "other",
                isApproved: false,
                isStandard: false,
              });
            }
          }
        }
      }

      // return res.json({ coins: godexResp.data });

      // Process LetsExchange coins
      if (letsexchangeResp.data) {
        for (const c of letsexchangeResp.data) {
          coins.push({
            standardTicker: c.code.toLowerCase() + c.network_code.toLowerCase(),
            ticker: c.code,
            requiresExtraId: c.has_extra === 1 ? true : false,
            name: c.name,
            network: c.network_code || c.code,
            image: c.icon || null,
            swapPartner: "letsexchange",
            mappedPartners: [],
            data: c,
            coinType: "other",
            isApproved: false,
            isStandard: false,
          });
        }
      }

      // return res.json({ coins: letsexchangeResp.data });

      // Process SimpleSwap coins
      if (simpleswapResp.data) {
        for (const c of simpleswapResp.data) {
          coins.push({
            standardTicker: c.symbol.toLowerCase() + c.network.toLowerCase(),
            ticker: c.symbol,
            requiresExtraId: c.has_extra_id,
            name: c.name,
            network: c.network || c.symbol,
            image: c.image || null,
            swapPartner: "simpleswap",
            mappedPartners: [],
            data: c,
            coinType: "other",
            isApproved: false,
            isStandard: false,
          });
        }
      }

      // Process EasyBit coins
      if (easybitResp.data && easybitResp.data.data) {
        for (const c of easybitResp.data.data) {
          const networkList = c.networkList || [];
          if (networkList.length > 0) {
            for (const network of networkList) {
              let standardTicker =
                c.currency.toLowerCase() + network.network.toLowerCase();

              coins.push({
                standardTicker: standardTicker,
                ticker: c.currency,
                requiresExtraId: network.hasTag,
                name: c.name,
                network: network.network,
                image: null,
                swapPartner: "easybit",
                mappedPartners: [],
                data: c,
                coinType: "other",
                isApproved: false,
                isStandard: false,
              });
            }
          }
        }
      }

      // return res.json({ coins: easybitResp.data });

      // ---------- EXTRACT ALL NETWORK NAMES ----------
      let allNetworks = new Set();
      for (const coin of coins) {
        if (coin.network) {
          allNetworks.add(coin.network.toLowerCase());
        }
      }

      // ---------- PROCESS SHORTNAME ----------
      for (const coin of coins) {
        let coinName = coin.ticker;
        let shortName = coinName;

        // Check if coin name ends with any network name and remove it
        for (const network of allNetworks) {
          const networkLower = network.toLowerCase();
          const coinNameLower = coinName.toLowerCase();

          if (
            coinNameLower.endsWith(networkLower) &&
            coinNameLower !== networkLower
          ) {
            // Remove network name from the end of coin name
            shortName = coinName
              .substring(0, coinName.length - network.length)
              .trim();
            break;
          }
        }

        coin.shortName = shortName || coinName;
      }

      let coinKeys = new Set();
      let standardCoinKeys = new Set();

      // ---------- GROUP SIMILAR COINS ----------
      for (const coin of coins) {
        console.log("Processing coin:", {
          standardTicker: coin.standardTicker,
          ticker: coin.ticker,
          network: coin.network,
          swapPartner: coin.swapPartner,
        });

        if (!coin.standardTicker || !coin.network) {
          console.log(
            "Skipping coin with missing standardTicker or network:",
            coin
          );
          continue;
        }

        const key = coin.standardTicker;

        if (coinKeys.has(key)) continue;
        let alikeCoins = coins.filter((c) => c.standardTicker === key);

        if (alikeCoins.length > 1) {
          let baseCoin = {
            ...alikeCoins[0],
            mappedPartners: [],
          };

          let requiresExtraIdFlag = false;

          for (const a of alikeCoins) {
            // Check if any coin requires extra ID
            if (a.requiresExtraId === true) {
              requiresExtraIdFlag = true;
            }

            baseCoin.mappedPartners.push({
              swapPartner: a.swapPartner,
              standardTicker: a.standardTicker,
              ticker: a.ticker,
              name: a.name,
              network: a.network,
              coinType: a.coinType,
              requiresExtraId: a.requiresExtraId,
              payInNotifications: [],
              payOutNotifications: [],
            });
          }

          baseCoin.swapPartner = null;
          baseCoin.data = null;
          baseCoin.isStandard = true;
          baseCoin.isApproved = true; // Standard coins are approved by default
          baseCoin.requiresExtraId = requiresExtraIdFlag;

          coinKeys.add(key);
          standardCoinKeys.add(key);
          mappedCoins.push(baseCoin);
        }
      }

      // ---------- COUNTERS ----------
      let updatedStandard = 0;
      let insertedStandard = 0;
      let insertedNormal = 0;

      // ---------- PROCESS STANDARD COINS ----------
      for (const m of mappedCoins) {
        const coin = await prisma.swap_crypto.findMany({
          where: {
            standardTicker: m.standardTicker,
            isStandard: true,
          },
        });

        if (coin.length > 1) {
          return res.status(500).json({
            success: false,
            message: "Multiple mapped standard coins found",
            error: "Duplicate standard coins in database",
          });
        }

        if (coin.length === 1) {
          // Update existing standard coin
          let dbPartners = JSON.parse(coin[0].mappedPartners || "[]");

          const missingPartners = m.mappedPartners.filter(
            (mp) => !dbPartners.some((db) => db.swapPartner === mp.swapPartner)
          );

          if (missingPartners.length > 0) {
            const combinedPartners = dbPartners.concat(missingPartners);

            await prisma.swap_crypto.update({
              where: { id: coin[0].id },
              data: {
                mappedPartners: JSON.stringify(combinedPartners),
              },
            });
            updatedStandard++;
          }
        } else {
          // Insert new standard coin
          await prisma.swap_crypto.create({
            data: {
              standardTicker: m.standardTicker,
              ticker: m.ticker.toLowerCase(),
              name: m.name,
              network: m.network,
              shortName:
                m.shortName && m.shortName.length > 1
                  ? m.shortName.toLowerCase()
                  : m.ticker.toLowerCase(),
              image: m.image,
              swapPartner: m.swapPartner,
              mappedPartners: JSON.stringify(m.mappedPartners),
              coinType: m.coinType || "other",
              requiresExtraId: m.requiresExtraId,
              isApproved: true,
              isStandard: true,
            },
          });
          insertedStandard++;
        }
      }

      // ---------- PROCESS NON-STANDARD COINS ----------
      for (const c of coins) {
        // Skip coins that are part of standard coins
        // const key = c.standardTicker;
        // if (standardCoinKeys.has(key)) {
        //   continue;
        // }

        const coin = await prisma.swap_crypto.findMany({
          where: {
            standardTicker: c.standardTicker,
            swapPartner: c.swapPartner,
            isStandard: false,
          },
        });

        if (coin.length === 0) {
          await prisma.swap_crypto.create({
            data: {
              standardTicker: c.standardTicker,
              ticker: c.ticker.toLowerCase(),
              name: c.name,
              network: c.network,
              shortName:
                c.shortName && c.shortName.length > 1
                  ? c.shortName.toLowerCase()
                  : c.ticker.toLowerCase(),
              image: c.image,
              swapPartner: c.swapPartner,
              data: JSON.stringify(c.data),
              coinType: c.coinType || "other",
              requiresExtraId: c.requiresExtraId,
              isApproved: false,
              isStandard: false,
            },
          });

          insertedNormal++;
        }
      }

      return res.status(201).json({
        success: true,
        message: `Coins processed successfully. Total Inserted: ${
          insertedStandard + insertedNormal
        }, Total Updated: ${updatedStandard}.`,
        updatedStandard,
        insertedStandard,
        insertedNormal,
        totalInserted: insertedStandard + insertedNormal,
        totalUpdated: updatedStandard,
      });
    } catch (error) {
      // ---------- ERROR HANDLING ----------
      return res.status(500).json({
        success: false,
        error: error.message || "Unexpected server error",
        message: "Something went wrong while processing coin data",
      });
    }
  };

  // This controller is responsible for getting standard coin data
  static getStandardCoin = async (req, res) => {
    try {
      const { standardCoinId } = req.query;

      // ---------- VALIDATE INPUT ----------
      if (!standardCoinId) {
        return res.status(400).json({
          success: false,
          message: "standardCoinId is required",
        });
      }

      // ---------- FETCH STANDARD COIN ----------
      const standardCoin = await prisma.swap_crypto.findFirst({
        where: {
          id: parseInt(standardCoinId),
          isStandard: true,
        },
      });

      if (!standardCoin) {
        return res.status(404).json({
          success: false,
          message: "Standard coin not found",
        });
      }

      const coin = standardCoin;
      const mappedPartners = JSON.parse(coin.mappedPartners || "[]");

      return res.status(200).json({
        success: true,
        coin: {
          id: coin.id,
          standardTicker: coin.standardTicker,
          name: coin.name,
          network: coin.network,
          shortName: coin.shortName,
          image: coin.image,
          coinType: coin.coinType,
          requiresExtraId: coin.requiresExtraId,
          isApproved: coin.isApproved,
          mappedPartners: mappedPartners,
        },
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: error.message || "Unexpected server error",
        message: "Something went wrong while fetching standard coin",
      });
    }
  };

  // This controller is responsible for updating standard coin data
  static updateStandardCoin = async (req, res) => {
    try {
      const { standardCoinId, shortName, coinType, image } = req.body;

      console.log(req.body);

      // ---------- VALIDATE INPUT ----------
      if (!standardCoinId) {
        return res.status(400).json({
          success: false,
          message: "standardCoinId is required",
        });
      }

      // Validate coinType if provided
      const validCoinTypes = ["popular", "popular&stable", "other"];
      if (coinType && !validCoinTypes.includes(coinType)) {
        return res.status(400).json({
          success: false,
          message: `Invalid coinType. Must be one of: ${validCoinTypes.join(
            ", "
          )}`,
        });
      }

      // ---------- FETCH STANDARD COIN ----------
      const standardCoin = await prisma.swap_crypto.findFirst({
        where: {
          id: parseInt(standardCoinId),
          isStandard: true,
        },
      });

      if (!standardCoin) {
        return res.status(404).json({
          success: false,
          message: "Standard coin not found",
        });
      }

      const coin = standardCoin;

      // ---------- BUILD UPDATE DATA ----------
      const updateData = {};
      if (shortName !== undefined) updateData.shortName = shortName;
      if (coinType !== undefined) updateData.coinType = coinType;
      if (image !== undefined) updateData.image = image;

      if (Object.keys(updateData).length === 0) {
        return res.status(400).json({
          success: false,
          message: "No fields to update",
        });
      }

      // ---------- UPDATE STANDARD COIN ----------

      await prisma.swap_crypto.update({
        where: { id: parseInt(standardCoinId) },
        data: updateData,
      });

      // ---------- FETCH UPDATED COIN ----------
      const updatedCoin = await prisma.swap_crypto.findUnique({
        where: { id: parseInt(standardCoinId) },
      });

      return res.status(200).json({
        success: true,
        message: "Standard coin updated successfully",
        coin: {
          id: updatedCoin.id,
          standardTicker: updatedCoin.standardTicker,
          name: updatedCoin.name,
          network: updatedCoin.network,
          shortName: updatedCoin.shortName,
          image: updatedCoin.image,
          coinType: updatedCoin.coinType,
          requiresExtraId: updatedCoin.requiresExtraId,
          isApproved: updatedCoin.isApproved,
          mappedPartners: JSON.parse(updatedCoin.mappedPartners || "[]"),
        },
      });
    } catch (error) {
      console.log(error);
      return res.status(500).json({
        success: false,
        error: error.message || "Unexpected server error",
        message: "Something went wrong while updating standard coin",
      });
    }
  };

  // This controller is responsible for approving/disapproving coins
  static updateCoinApprovalStatus = async (req, res) => {
    try {
      const { coinId, isApproved } = req.body;

      // ---------- VALIDATE INPUT ----------
      if (!coinId) {
        return res.status(400).json({
          success: false,
          message: "coinId is required",
        });
      }

      if (isApproved === undefined || isApproved === null) {
        return res.status(400).json({
          success: false,
          message: "isApproved is required (true or false)",
        });
      }

      // Validate isApproved is boolean
      if (typeof isApproved !== "boolean") {
        return res.status(400).json({
          success: false,
          message: "isApproved must be a boolean value (true or false)",
        });
      }

      // ---------- FETCH COIN ----------
      const coin = await prisma.swap_crypto.findUnique({
        where: { id: parseInt(coinId) },
      });

      if (!coin) {
        return res.status(404).json({
          success: false,
          message: "Coin not found",
        });
      }

      // ---------- UPDATE COIN APPROVAL STATUS ----------
      const updatedCoin = await prisma.swap_crypto.update({
        where: { id: parseInt(coinId) },
        data: {
          isApproved: isApproved,
        },
      });

      return res.status(200).json({
        success: true,
        message: `Coin ${isApproved ? "approved" : "disapproved"} successfully`,
        coin: {
          id: updatedCoin.id,
          standardTicker: updatedCoin.standardTicker,
          ticker: updatedCoin.ticker,
          name: updatedCoin.name,
          network: updatedCoin.network,
          isApproved: updatedCoin.isApproved,
          isStandard: updatedCoin.isStandard,
          swapPartner: updatedCoin.swapPartner,
        },
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: error.message || "Unexpected server error",
        message: "Something went wrong while updating coin approval status",
      });
    }
  };

  // This controller merges coins (both standard and unstandard) into a target standard coin's mappedPartners
  static mergeCoinsToMappedPartners = async (req, res) => {
    try {
      const { standardCoinId, coinIds } = req.body;

      // ---------- VALIDATE INPUT ----------
      if (!standardCoinId) {
        return res.status(400).json({
          success: false,
          message: "standardCoinId is required",
        });
      }

      if (!coinIds || !Array.isArray(coinIds) || coinIds.length === 0) {
        return res.status(400).json({
          success: false,
          message: "coinIds array is required and must not be empty",
        });
      }

      // ---------- FETCH TARGET STANDARD COIN ----------
      const targetCoin = await prisma.swap_crypto.findFirst({
        where: {
          id: parseInt(standardCoinId),
          isStandard: true,
        },
      });

      if (!targetCoin) {
        return res.status(404).json({
          success: false,
          message: "Target standard coin not found",
        });
      }

      // ---------- FETCH ALL COINS BY IDS ----------
      const coins = await prisma.swap_crypto.findMany({
        where: {
          id: { in: coinIds.map((id) => parseInt(id)) },
        },
      });

      if (coins.length === 0) {
        return res.status(404).json({
          success: false,
          message: "No coins found with the provided IDs",
        });
      }

      // ---------- SEPARATE STANDARD AND UNSTANDARD COINS ----------
      const standardCoins = coins.filter((coin) => coin.isStandard === true);
      const unstandardCoins = coins.filter((coin) => coin.isStandard === false);

      // ---------- GET CURRENT MAPPED PARTNERS ----------
      let currentMappedPartners = JSON.parse(
        targetCoin.mappedPartners || "[]"
      );
      let addedFromStandardCount = 0;
      let addedFromUnstandardCount = 0;
      let skippedCount = 0;
      let addedPartners = [];
      let skippedPartners = [];
      let disapprovedStandardCoins = [];

      // ---------- MERGE MAPPED PARTNERS FROM STANDARD COINS ----------
      for (const standardCoin of standardCoins) {
        const sourceMappedPartners = JSON.parse(
          standardCoin.mappedPartners || "[]"
        );

        for (const partner of sourceMappedPartners) {
          // Check if this partner already exists in target's mappedPartners
          const existingPartner = currentMappedPartners.find(
            (mp) => mp.swapPartner === partner.swapPartner
          );

          if (!existingPartner) {
            // Copy complete partner object from source coin
            currentMappedPartners.push({
              ...partner,
            });
            addedFromStandardCount++;
            addedPartners.push(partner.swapPartner);
          } else {
            skippedCount++;
            skippedPartners.push(partner.swapPartner);
          }
        }

        // Set source standard coin's isApproved to false
        await prisma.swap_crypto.update({
          where: { id: standardCoin.id },
          data: { isApproved: false },
        });

        disapprovedStandardCoins.push({
          id: standardCoin.id,
          standardTicker: standardCoin.standardTicker,
          name: standardCoin.name,
        });
      }

      // ---------- ADD UNSTANDARD COINS TO MAPPED PARTNERS ----------
      for (const unstandardCoin of unstandardCoins) {
        // Check if this partner already exists in mappedPartners
        const existingPartner = currentMappedPartners.find(
          (mp) => mp.swapPartner === unstandardCoin.swapPartner
        );

        if (!existingPartner) {
          // Create mapped partner object from unstandard coin
          currentMappedPartners.push({
            swapPartner: unstandardCoin.swapPartner,
            standardTicker: unstandardCoin.standardTicker,
            ticker: unstandardCoin.ticker,
            name: unstandardCoin.name,
            network: unstandardCoin.network,
            coinType: unstandardCoin.coinType || "other",
            requiresExtraId: unstandardCoin.requiresExtraId,
            payInNotifications: [],
            payOutNotifications: [],
          });
          addedFromUnstandardCount++;
          addedPartners.push(unstandardCoin.swapPartner);
        } else {
          skippedCount++;
          skippedPartners.push(unstandardCoin.swapPartner);
        }
      }

      // ---------- HANDLE CASE WHERE NO NEW PARTNERS WERE ADDED ----------
      const totalAdded = addedFromStandardCount + addedFromUnstandardCount;
      if (totalAdded === 0) {
        return res.status(200).json({
          success: true,
          message:
            "No new partners were added (all already exist in mappedPartners)",
          addedFromStandardCount: 0,
          addedFromUnstandardCount: 0,
          totalAdded: 0,
          skippedCount,
          skippedPartners,
          disapprovedStandardCoins:
            disapprovedStandardCoins.length > 0
              ? disapprovedStandardCoins
              : undefined,
          coin: {
            id: targetCoin.id,
            standardTicker: targetCoin.standardTicker,
            name: targetCoin.name,
            network: targetCoin.network,
            mappedPartners: currentMappedPartners,
          },
        });
      }

      // ---------- UPDATE TARGET STANDARD COIN WITH NEW MAPPED PARTNERS ----------
      await prisma.swap_crypto.update({
        where: { id: parseInt(standardCoinId) },
        data: {
          mappedPartners: JSON.stringify(currentMappedPartners),
        },
      });

      // ---------- FETCH UPDATED COIN ----------
      const updatedCoin = await prisma.swap_crypto.findUnique({
        where: { id: parseInt(standardCoinId) },
      });

      return res.status(200).json({
        success: true,
        message: `Successfully merged ${totalAdded} partner${
          totalAdded !== 1 ? "s" : ""
        } to mapped partners (${addedFromStandardCount} from standard coins, ${addedFromUnstandardCount} from unstandard coins)`,
        addedFromStandardCount,
        addedFromUnstandardCount,
        totalAdded,
        skippedCount,
        addedPartners,
        skippedPartners:
          skippedPartners.length > 0 ? skippedPartners : undefined,
        disapprovedStandardCoins:
          disapprovedStandardCoins.length > 0
            ? disapprovedStandardCoins
            : undefined,
        coin: {
          id: updatedCoin.id,
          standardTicker: updatedCoin.standardTicker,
          name: updatedCoin.name,
          network: updatedCoin.network,
          mappedPartners: JSON.parse(updatedCoin.mappedPartners || "[]"),
        },
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: error.message || "Unexpected server error",
        message: "Something went wrong while merging coins to mapped partners",
      });
    }
  };

  // This controller is responsible for updating notifications in mappedPartners
  static updateMappedPartnersNotifications = async (req, res) => {
    try {
      const {
        standardCoinId,
        swapPartner,
        payInNotifications,
        payOutNotifications,
      } = req.body;

      // ---------- VALIDATE INPUT ----------
      if (!standardCoinId) {
        return res.status(400).json({
          success: false,
          message: "standardCoinId is required",
        });
      }

      if (!swapPartner) {
        return res.status(400).json({
          success: false,
          message: "swapPartner is required",
        });
      }

      // At least one notification array must be provided
      if (
        payInNotifications === undefined &&
        payOutNotifications === undefined
      ) {
        return res.status(400).json({
          success: false,
          message:
            "At least one of payInNotifications or payOutNotifications must be provided",
        });
      }

      // Validate payInNotifications if provided
      if (payInNotifications !== undefined && payInNotifications !== null) {
        if (!Array.isArray(payInNotifications)) {
          return res.status(400).json({
            success: false,
            message: "payInNotifications must be an array",
          });
        }
      }

      // Validate payOutNotifications if provided
      if (payOutNotifications !== undefined && payOutNotifications !== null) {
        if (!Array.isArray(payOutNotifications)) {
          return res.status(400).json({
            success: false,
            message: "payOutNotifications must be an array",
          });
        }
      }

      // ---------- FETCH STANDARD COIN ----------
      const standardCoin = await prisma.swap_crypto.findFirst({
        where: {
          id: parseInt(standardCoinId),
          isStandard: true,
        },
      });

      if (!standardCoin) {
        return res.status(404).json({
          success: false,
          message: "Standard coin not found",
        });
      }

      // ---------- UPDATE MAPPED PARTNER NOTIFICATIONS ----------
      let currentMappedPartners = JSON.parse(
        standardCoin.mappedPartners || "[]"
      );

      const partnerIndex = currentMappedPartners.findIndex(
        (mp) => mp.swapPartner === swapPartner
      );

      if (partnerIndex === -1) {
        return res.status(404).json({
          success: false,
          message: `Partner '${swapPartner}' not found in mappedPartners`,
        });
      }

      // Remove old notification fields if they exist
      delete currentMappedPartners[partnerIndex].payInNotification;
      delete currentMappedPartners[partnerIndex].payOutNotification;

      // Initialize notification arrays if they don't exist
      if (!currentMappedPartners[partnerIndex].payInNotifications) {
        currentMappedPartners[partnerIndex].payInNotifications = [];
      }
      if (!currentMappedPartners[partnerIndex].payOutNotifications) {
        currentMappedPartners[partnerIndex].payOutNotifications = [];
      }

      // Update payInNotifications if provided
      if (payInNotifications !== undefined) {
        currentMappedPartners[partnerIndex].payInNotifications =
          payInNotifications;
      }

      // Update payOutNotifications if provided
      if (payOutNotifications !== undefined) {
        currentMappedPartners[partnerIndex].payOutNotifications =
          payOutNotifications;
      }

      // ---------- UPDATE STANDARD COIN ----------
      await prisma.swap_crypto.update({
        where: { id: parseInt(standardCoinId) },
        data: {
          mappedPartners: JSON.stringify(currentMappedPartners),
        },
      });

      // ---------- FETCH UPDATED COIN ----------
      const updatedCoin = await prisma.swap_crypto.findUnique({
        where: { id: parseInt(standardCoinId) },
      });

      return res.status(200).json({
        success: true,
        message: `Notifications updated successfully for partner '${swapPartner}'`,
        updatedPartner: {
          swapPartner: currentMappedPartners[partnerIndex].swapPartner,
          payInNotifications:
            currentMappedPartners[partnerIndex].payInNotifications,
          payOutNotifications:
            currentMappedPartners[partnerIndex].payOutNotifications,
        },
        coin: {
          id: updatedCoin.id,
          standardTicker: updatedCoin.standardTicker,
          name: updatedCoin.name,
          network: updatedCoin.network,
          mappedPartners: JSON.parse(updatedCoin.mappedPartners || "[]"),
        },
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: error.message || "Unexpected server error",
        message: "Something went wrong while updating notifications",
      });
    }
  };

  // This controller is responsible for deleting standard coins
  static deleteStandardCoin = async (req, res) => {
    try {
      const { standardCoinId } = req.body;

      // ---------- VALIDATE INPUT ----------
      if (!standardCoinId) {
        return res.status(400).json({
          success: false,
          message: "standardCoinId is required",
        });
      }

      // ---------- FETCH STANDARD COIN ----------
      const standardCoin = await prisma.swap_crypto.findFirst({
        where: {
          id: parseInt(standardCoinId),
          isStandard: true,
        },
      });

      if (!standardCoin) {
        return res.status(404).json({
          success: false,
          message: "Standard coin not found",
        });
      }

      // ---------- DELETE STANDARD COIN ----------
      await prisma.swap_crypto.delete({
        where: { id: parseInt(standardCoinId) },
      });

      return res.status(200).json({
        success: true,
        message: `Successfully destandardized coin. The standard coin has been removed.`,
        deletedStandardCoinId: standardCoinId,
        releasedPartnersCount: mappedPartners.length,
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: error.message || "Unexpected server error",
        message: "Something went wrong while destandardizing coin",
      });
    }
  };

  // This controller is responsible for searching of standard and unstandard coins
  static searchCoins = async (req, res) => {
    try {
      const { searchTerm, isStandard, page = 1, limit = 10 } = req.query;

      // ---------- VALIDATE INPUT ----------
      if (
        isStandard === undefined ||
        isStandard === null ||
        isStandard === ""
      ) {
        return res.status(400).json({
          success: false,
          message: "isStandard parameter is required for search",
        });
      }

      const pageNum = parseInt(page);
      const limitNum = parseInt(limit);
      const offset = (pageNum - 1) * limitNum;
      const isStandardValue = parseInt(isStandard) === 1;

      // ---------- BUILD WHERE CLAUSE ----------
      const whereClause = {
        isStandard: isStandardValue,
      };

      // Add search term filter if provided
      // Note: MySQL is case-insensitive by default for LIKE operations
      if (searchTerm && searchTerm.trim() !== "") {
        whereClause.OR = [
          {
            ticker: {
              contains: searchTerm.trim(),
            },
          },
          {
            name: {
              contains: searchTerm.trim(),
            },
          },
          {
            network: {
              contains: searchTerm.trim(),
            },
          },
        ];
      }

      // ---------- EXECUTE QUERIES ----------
      const totalCoins = await prisma.swap_crypto.count({
        where: whereClause,
      });

      const coins = await prisma.swap_crypto.findMany({
        where: whereClause,
        orderBy: [
          {
            coinType: "asc", // This won't give exact priority, but we'll sort in memory
          },
          {
            ticker: "asc",
          },
        ],
        skip: offset,
        take: limitNum,
      });

      // ---------- SORT WITH PRIORITY ----------
      // Priority: coinType > exact match > starts with > alphabetical
      let sortedCoins = coins;
      if (searchTerm && searchTerm.trim() !== "") {
        const searchTermLower = searchTerm.trim().toLowerCase();
        sortedCoins = coins.sort((a, b) => {
          // 1. coinType priority
          const coinTypeOrder = {
            popular: 0,
            "popular&stable": 1,
            stable: 2,
            other: 3,
          };
          const aCoinTypeOrder = coinTypeOrder[a.coinType] ?? 4;
          const bCoinTypeOrder = coinTypeOrder[b.coinType] ?? 4;
          if (aCoinTypeOrder !== bCoinTypeOrder)
            return aCoinTypeOrder - bCoinTypeOrder;

          const aTickerLower = a.ticker.toLowerCase();
          const bTickerLower = b.ticker.toLowerCase();
          const aNameLower = (a.name || "").toLowerCase();
          const bNameLower = (b.name || "").toLowerCase();
          const aNetworkLower = (a.network || "").toLowerCase();
          const bNetworkLower = (b.network || "").toLowerCase();

          // 2. Exact ticker match
          if (
            aTickerLower === searchTermLower &&
            bTickerLower !== searchTermLower
          )
            return -1;
          if (
            aTickerLower !== searchTermLower &&
            bTickerLower === searchTermLower
          )
            return 1;

          // 3. Exact name match
          if (aNameLower === searchTermLower && bNameLower !== searchTermLower)
            return -1;
          if (aNameLower !== searchTermLower && bNameLower === searchTermLower)
            return 1;

          // 4. Exact network match
          if (
            aNetworkLower === searchTermLower &&
            bNetworkLower !== searchTermLower
          )
            return -1;
          if (
            aNetworkLower !== searchTermLower &&
            bNetworkLower === searchTermLower
          )
            return 1;

          // 5. Ticker starts with search term
          if (
            aTickerLower.startsWith(searchTermLower) &&
            !bTickerLower.startsWith(searchTermLower)
          )
            return -1;
          if (
            !aTickerLower.startsWith(searchTermLower) &&
            bTickerLower.startsWith(searchTermLower)
          )
            return 1;

          // 6. Name starts with search term
          if (
            aNameLower.startsWith(searchTermLower) &&
            !bNameLower.startsWith(searchTermLower)
          )
            return -1;
          if (
            !aNameLower.startsWith(searchTermLower) &&
            bNameLower.startsWith(searchTermLower)
          )
            return 1;

          // 7. Network starts with search term
          if (
            aNetworkLower.startsWith(searchTermLower) &&
            !bNetworkLower.startsWith(searchTermLower)
          )
            return -1;
          if (
            !aNetworkLower.startsWith(searchTermLower) &&
            bNetworkLower.startsWith(searchTermLower)
          )
            return 1;

          // 8. Default alphabetical sort
          return aTickerLower.localeCompare(bTickerLower);
        });
      } else {
        // Sort by coinType priority when no search term
        const coinTypeOrder = {
          popular: 0,
          "popular&stable": 1,
          stable: 2,
          other: 3,
        };
        sortedCoins = coins.sort((a, b) => {
          const aCoinTypeOrder = coinTypeOrder[a.coinType] ?? 4;
          const bCoinTypeOrder = coinTypeOrder[b.coinType] ?? 4;
          if (aCoinTypeOrder !== bCoinTypeOrder)
            return aCoinTypeOrder - bCoinTypeOrder;
          return a.ticker.toLowerCase().localeCompare(b.ticker.toLowerCase());
        });
      }

      // ---------- PARSE MAPPED PARTNERS ----------
      const parsedCoins = sortedCoins.map((coin) => ({
        ...coin,
        mappedPartners: coin.mappedPartners
          ? JSON.parse(coin.mappedPartners)
          : [],
      }));

      // ---------- CALCULATE PAGINATION INFO ----------
      const totalPages = Math.ceil(totalCoins / limitNum);

      return res.status(200).json({
        success: true,
        coins: parsedCoins,
        pagination: {
          currentPage: pageNum,
          totalPages: totalPages,
          totalCount: totalCoins,
          limit: limitNum,
          hasNextPage: pageNum < totalPages,
          hasPreviousPage: pageNum > 1,
        },
      });
    } catch (error) {
      return res.status(500).json({
        success: false,
        error: error.message || "Unexpected server error",
        message: "Something went wrong while searching coins",
      });
    }
  };
}

export default swapController;
