const versionPath = new URL("../VERSION", import.meta.url);

const [command, arg] = Deno.args;

const readVersion = async () => {
  const raw = await Deno.readTextFile(versionPath);
  return raw.trim();
};

const writeVersion = async (value: string) => {
  await Deno.writeTextFile(versionPath, `${value}\n`);
};

const parseSemver = (value: string) => {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(value);
  if (!match) return null;
  return {
    major: Number(match[1]),
    minor: Number(match[2]),
    patch: Number(match[3]),
  };
};

const bump = (value: string, part: string) => {
  const parsed = parseSemver(value);
  if (!parsed) {
    throw new Error(
      `Version "${value}" tidak valid. Format yang didukung: MAJOR.MINOR.PATCH`,
    );
  }
  const next = { ...parsed };
  if (part === "major") {
    next.major += 1;
    next.minor = 0;
    next.patch = 0;
  } else if (part === "minor") {
    next.minor += 1;
    next.patch = 0;
  } else if (part === "patch") {
    next.patch += 1;
  } else {
    throw new Error(`Argumen bump tidak dikenal: ${part}`);
  }
  return `${next.major}.${next.minor}.${next.patch}`;
};

const usage = () => {
  console.log(
    [
      "Usage:",
      "  deno task version:dump",
      "  deno task version:bump -- [major|minor|patch]",
      "  deno task version",
    ].join("\n"),
  );
};

const color = {
  reset: "\x1b[0m",
  dim: "\x1b[2m",
  cyan: "\x1b[36m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
};

const explainKinds = (current: string) => {
  const samplePatch = bump(current, "patch");
  const sampleMinor = bump(current, "minor");
  const sampleMajor = bump(current, "major");
  console.log(`${color.cyan}Pilihan bump:${color.reset}`);
  console.log(
    `0. batal - tidak melakukan apa-apa. ${color.dim}(${current})${color.reset}`,
  );
  console.log(
    `1. patch - perbaikan kecil/bugfix, tidak mengubah fitur. ${color.green}(${current} → ${samplePatch})${color.reset}`,
  );
  console.log(
    `2. minor - tambah fitur baru, kompatibel ke belakang. ${color.yellow}(${current} → ${sampleMinor})${color.reset}`,
  );
  console.log(
    `3. mayor - perubahan besar, bisa breaking. ${color.red}(${current} → ${sampleMajor})${color.reset}`,
  );
};

const normalizeKind = (value: string) => {
  const v = value.trim().toLowerCase();
  if (v === "0" || v === "batal" || v === "cancel") return "cancel";
  if (v === "1" || v === "patch") return "patch";
  if (v === "2" || v === "minor") return "minor";
  if (v === "3" || v === "major" || v === "mayor") return "major";
  return "";
};

if (!command) {
  const current = await readVersion();
  console.log(`Versi sekarang: ${current}`);
  explainKinds(current);
  const answer = prompt("Pilih bump (0/1/2/3):") ?? "";
  const kind = normalizeKind(answer);
  if (!kind) {
    console.error("Pilihan tidak valid.");
    Deno.exit(1);
  }
  if (kind === "cancel") {
    console.log("Dibatalkan.");
    Deno.exit(0);
  }
  const next = bump(current, kind);
  await writeVersion(next);
  console.log(`Versi baru: ${next}`);
} else if (command === "dump") {
  console.log(await readVersion());
} else if (command === "bump") {
  if (!arg) {
    usage();
    Deno.exit(1);
  }
  const current = await readVersion();
  const next = bump(current, arg);
  await writeVersion(next);
  console.log(next);
} else {
  usage();
  Deno.exit(1);
}
