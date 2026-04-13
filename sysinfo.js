const os = require("os");
const fs = require("fs");
const { execSync } = require("child_process");

/* =================================================
   helpers
================================================= */

function safe(cmd) {
  try {
    return execSync(cmd, { stdio: ["ignore", "pipe", "ignore"] })
      .toString()
      .trim();
  } catch {
    return null;
  }
}

const gb = (x) => (x / 1024 / 1024 / 1024).toFixed(1);

/* =================================================
   UI engine (perfect borders)
================================================= */

const width = 34;
const line = "─".repeat(width);

function center(text) {
  const pad = Math.floor((width - text.length) / 2);
  return " ".repeat(pad) + text + " ".repeat(width - text.length - pad);
}

function row(key, value) {
  const content = `${key.padEnd(5)} ${value}`;
  const trimmed =
    content.length > width ? content.slice(0, width - 1) + "…" : content;

  console.log(`│ ${trimmed.padEnd(width - 1)}│`);
}

function top(title) {
  console.log(`╭${line}╮`);
  console.log(`│${center(title)}│`);
  console.log(`├${line}┤`);
}

function mid() {
  console.log(`├${line}┤`);
}

function bottom() {
  console.log(`╰${line}╯\n`);
}

function bar(pct, size = 12) {
  const filled = Math.round((pct / 100) * size);
  return "[" + "█".repeat(filled) + "░".repeat(size - filled) + "]";
}

/* =================================================
   system helpers
================================================= */

function shortCPU() {
  let model = os.cpus()[0].model.split("@")[0];

  const m = model.match(/(i[3579]-\d+|Ryzen\s*\d+\s*\d+|M\d|Xeon\s*\S+)/i);
  if (m) return m[0] + " CPU";

  return model.replace(/Intel\(R\)|Core\(TM\)|AMD|Processor/gi, "").trim();
}

function cpuUsage() {
  const first = os.cpus();
  const idle1 = first.reduce((a, c) => a + c.times.idle, 0);
  const total1 = first.reduce(
    (a, c) => a + Object.values(c.times).reduce((x, y) => x + y),
    0
  );

  const start = Date.now();
  while (Date.now() - start < 120) {}

  const second = os.cpus();
  const idle2 = second.reduce((a, c) => a + c.times.idle, 0);
  const total2 = second.reduce(
    (a, c) => a + Object.values(c.times).reduce((x, y) => x + y),
    0
  );

  const idle = idle2 - idle1;
  const total = total2 - total1;

  return Math.round((1 - idle / total) * 100);
}

function diskInfo() {
  try {
    if (process.platform === "win32") {
      const out = safe(
        'wmic logicaldisk where "DeviceID=\'C:\'" get Size,FreeSpace /value'
      );
      const size = parseInt(out.match(/Size=(\d+)/)?.[1]);
      const free = parseInt(out.match(/FreeSpace=(\d+)/)?.[1]);
      return { used: size - free, size };
    }

    const { blocks, bfree, bsize } = fs.statfsSync(process.cwd());
    const size = blocks * bsize;
    const free = bfree * bsize;
    return { used: size - free, size };
  } catch {
    return null;
  }
}

function temperature() {
  if (process.platform === "linux") {
    const t = safe("cat /sys/class/thermal/thermal_zone0/temp");
    if (t) return (parseInt(t) / 1000).toFixed(0) + "°C";
  }

  if (process.platform === "win32") {
    const t = safe(
      "wmic /namespace:\\\\root\\wmi PATH MSAcpi_ThermalZoneTemperature get CurrentTemperature /value"
    );
    const raw = parseInt(t?.match(/=(\d+)/)?.[1]);
    if (raw) return Math.round(raw / 10 - 273.15) + "°C";
  }

  return null;
}

function localIP() {
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const n of nets[name]) {
      if (n.family === "IPv4" && !n.internal) return n.address;
    }
  }
  return "unknown";
}

function processCount() {
  if (process.platform === "win32") {
    return safe("tasklist | find /c /v \"\"") || "?";
  }
  return safe("ps -e | wc -l") || "?";
}

/* =================================================
   main
================================================= */

function run() {
  const total = os.totalmem();
  const free = os.freemem();
  const used = total - free;

  const memPct = Math.round((used / total) * 100);
  const cpuPct = cpuUsage();

  const d = diskInfo();
  const diskPct = d ? Math.round((d.used / d.size) * 100) : 0;

  const ip = localIP();
  const temp = temperature();

  top("SYFO");

  row("Host", os.hostname());
  row("OS", `${os.platform()} ${os.release()}`);
  row("Arch", os.arch());
  row("CPU", shortCPU());
  if (temp) row("Temp", temp);
  row("Up", `${Math.floor(os.uptime() / 3600)}h`);

  mid();

  row("CPU", `${bar(cpuPct)} ${cpuPct}%`);
  row("Mem", `${bar(memPct)} ${memPct}%`);
  if (d) row("Disk", `${bar(diskPct)} ${diskPct}%`);

  mid();

  row("Proc", processCount());
  row("IP", `${ip} ${ip === "unknown" ? "offline" : "online"}`);
  row("User", os.userInfo().username);
  row("Time", new Date().toLocaleTimeString());

  bottom();
}

module.exports = { run };
