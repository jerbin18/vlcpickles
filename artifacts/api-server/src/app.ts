import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import path from "node:path";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// API routes
app.use("/api", router);

// React frontend
const frontendPath = path.resolve(
  process.cwd(),
  "artifacts",
  "vlc-pickles",
  "dist",
  "public",
);

app.use(express.static(frontendPath));

// React client-side routes
app.get("*", (_req, res) => {
  res.sendFile(path.join(frontendPath, "index.html"));
});

export default app;