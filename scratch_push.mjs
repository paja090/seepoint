import fs from "fs";
import { execSync } from "child_process";

const env = fs.readFileSync(".env.preview", "utf-8");
const urlLine = env.split("\n").find(line => line.startsWith("POSTGRES_URL_NON_POOLING="));
if (!urlLine) throw new Error("No url line");

const url = urlLine.substring("POSTGRES_URL_NON_POOLING=".length).replace(/"/g, "").trim();

console.log("Found URL");
execSync(`npx.cmd prisma db push`, {
  env: { ...process.env, DATABASE_URL: url },
  stdio: "inherit"
});
