const { spawn } = require("child_process");
const path = require("path");

const root = process.cwd();
const viteBin = path.join(root, "node_modules", "vite", "bin", "vite.js");

const children = [];

function run(name, command, args) {
  const child = spawn(command, args, {
    cwd: root,
    stdio: "inherit",
    shell: false
  });

  child.on("exit", (code) => {
    if (code !== 0) {
      console.error(`[${name}] exited with code ${code}`);
    }
  });

  children.push(child);
  return child;
}

function shutdown() {
  for (const child of children) {
    if (!child.killed) {
      child.kill("SIGTERM");
    }
  }
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

run("api", process.execPath, ["server.cjs"]);
run("vite", process.execPath, [viteBin]);
