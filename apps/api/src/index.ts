import express, { Request, Response } from "express";
import cors from "cors";
import dotenv from "dotenv";
import merchantsRouter from "./routes/merchants";
import eventsRouter from "./routes/events";
import categoriesRouter from "./routes/categories";

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

app.get("/health", (_req: Request, res: Response) => {
  res.status(200).json({ status: "ok" });
});

app.use("/merchants", merchantsRouter);
app.use("/events", eventsRouter);
app.use("/categories", categoriesRouter);

const PORT = Number(process.env.PORT) || 8080;
const HOST = "0.0.0.0";

app.listen(PORT, HOST, () => {
  console.log(`Server running at http://${HOST}:${PORT}`);
});