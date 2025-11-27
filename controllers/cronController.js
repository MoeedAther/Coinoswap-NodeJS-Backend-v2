import express from "express";
import dotenv from "dotenv";
import prisma from "../database/prisma.js";

dotenv.config();

const app = express();

class CronController {
  static getStatusCronData = async (req, res) => {
    try {
      const { type } = req.body;

      const result = await prisma.cronJob.findUnique({
        where: { type },
      });

      if (!result) {
        return res.json({ cron: false });
      }

      return res.json({
        cron: true,
        second: result.second,
        minute: result.minute,
        hour: result.hour,
        date_of_month: result.date_of_month,
        month: result.month,
        day_of_week: result.day_of_week,
      });
    } catch (error) {
      console.error(error);
      return res.json({ cron: false });
    }
  };

  static setStatusCronData = async (req, res) => {
    try {
      const { type, second, minute, hour, date_of_month, month, day_of_week } =
        req.body;
      console.log(req.body);

      await prisma.cronJob.update({
        where: { type },
        data: {
          second,
          minute,
          hour,
          date_of_month,
          month,
          day_of_week,
        },
      });

      return res.json({ cron: true });
    } catch (error) {
      console.log(error);
      return res.json({ cron: false });
    }
  };
}

export default CronController;
