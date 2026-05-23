import { execFileSync } from "node:child_process";
import path from "node:path";

const rootDir = process.cwd();
const port = process.env.PORT || "3000";

function run(command, args) {
  try {
    return execFileSync(command, args, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return "";
  }
}

function pidsListeningOnPort(targetPort) {
  const output = run("lsof", ["-ti", `tcp:${targetPort}`, "-sTCP:LISTEN"]);
  return output ? output.split(/\s+/).filter(Boolean) : [];
}

function cwdForPid(pid) {
  const output = run("lsof", ["-a", "-p", pid, "-d", "cwd", "-Fn"]);
  const cwdLine = output.split("\n").find((line) => line.startsWith("n"));
  return cwdLine ? cwdLine.slice(1) : "";
}

const civicPids = pidsListeningOnPort(port).filter((pid) => {
  const cwd = cwdForPid(pid);
  return cwd === rootDir || cwd.startsWith(`${rootDir}${path.sep}`);
});

if (!civicPids.length) {
  console.log(`No CivicSignal dev server is listening on port ${port}.`);
  process.exit(0);
}

let failed = false;

for (const pid of civicPids) {
  try {
    execFileSync("kill", [pid], { stdio: "ignore" });
    console.log(`Stopped CivicSignal dev server PID ${pid} on port ${port}.`);
  } catch {
    failed = true;
    console.error(`Could not stop PID ${pid} from this process. Run: kill ${pid}`);
  }
}

if (failed) process.exit(1);
