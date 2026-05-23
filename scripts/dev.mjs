import { spawn, execFileSync } from "node:child_process";
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

function commandForPid(pid) {
  return run("ps", ["-p", pid, "-o", "command="]);
}

function cwdForPid(pid) {
  const output = run("lsof", ["-a", "-p", pid, "-d", "cwd", "-Fn"]);
  const cwdLine = output.split("\n").find((line) => line.startsWith("n"));
  return cwdLine ? cwdLine.slice(1) : "";
}

const listeners = pidsListeningOnPort(port).map((pid) => ({
  pid,
  command: commandForPid(pid),
  cwd: cwdForPid(pid),
}));

if (listeners.length) {
  const civicListeners = listeners.filter((item) => item.cwd === rootDir || item.cwd.startsWith(`${rootDir}${path.sep}`));

  if (civicListeners.length) {
    console.log(`CivicSignal is already running on http://localhost:${port}`);
    for (const listener of civicListeners) {
      console.log(`PID ${listener.pid}: ${listener.command || "unknown command"}`);
    }
    console.log("Open the URL above, or run `npm run dev:stop` before starting a fresh server.");
    process.exit(0);
  }

  console.error(`Port ${port} is already in use by another process. CivicSignal will not auto-switch ports.`);
  for (const listener of listeners) {
    console.error(`PID ${listener.pid}: ${listener.command || "unknown command"}`);
  }
  console.error(`Stop that process or start CivicSignal with an explicit port, for example: PORT=3001 npm run dev`);
  process.exit(1);
}

const nextBin = path.join(rootDir, "node_modules", ".bin", process.platform === "win32" ? "next.cmd" : "next");
const child = spawn(nextBin, ["dev", "--port", port], {
  cwd: rootDir,
  env: { ...process.env, PORT: port },
  stdio: "inherit",
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    child.kill(signal);
  });
}

child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exit(code ?? 0);
});
