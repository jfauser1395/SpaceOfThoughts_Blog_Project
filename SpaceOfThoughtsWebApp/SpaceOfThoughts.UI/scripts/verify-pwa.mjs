import { createHash } from "node:crypto";
import { access, readFile, stat } from "node:fs/promises";
import { isDeepStrictEqual } from "node:util";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { inflateSync } from "node:zlib";

const uiRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const publicRoot = resolve(uiRoot, "public");
const browserRoot = resolve(uiRoot, "dist", "space-of-thoughts", "browser");

const paths = {
  packageJson: resolve(uiRoot, "package.json"),
  sourceManifest: resolve(publicRoot, "manifest.webmanifest"),
  ngswConfig: resolve(uiRoot, "ngsw-config.json"),
  builtManifest: resolve(browserRoot, "manifest.webmanifest"),
  ngsw: resolve(browserRoot, "ngsw.json"),
};

const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const ADAM7_PASSES = [
  [0, 0, 8, 8],
  [4, 0, 8, 8],
  [0, 4, 4, 8],
  [2, 0, 4, 4],
  [0, 2, 2, 4],
  [1, 0, 2, 2],
  [0, 1, 1, 2],
];

function invariant(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function describePath(filePath) {
  return relative(uiRoot, filePath).split(sep).join("/");
}

async function readJson(filePath) {
  let contents;

  try {
    contents = await readFile(filePath, "utf8");
  } catch (error) {
    throw new Error(
      `Cannot read ${describePath(filePath)}. Run a production build first (${error.code ?? error.message}).`,
    );
  }

  try {
    return JSON.parse(contents);
  } catch (error) {
    throw new Error(
      `${describePath(filePath)} is not valid JSON: ${error.message}`,
    );
  }
}

function normalizeOpaqueHexColor(value, label) {
  invariant(
    typeof value === "string",
    `${label} must be a hexadecimal CSS color.`,
  );

  const match = /^#([0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.exec(
    value.trim(),
  );
  invariant(
    match,
    `${label} must be an opaque #RGB, #RGBA, #RRGGBB, or #RRGGBBAA color.`,
  );

  let hex = match[1].toLowerCase();
  if (hex.length === 3 || hex.length === 4) {
    hex = [...hex].map((character) => character.repeat(2)).join("");
  }

  if (hex.length === 8) {
    invariant(hex.slice(6) === "ff", `${label} must be fully opaque.`);
    hex = hex.slice(0, 6);
  }

  return `#${hex}`;
}

function manifestPurpose(icon) {
  invariant(
    typeof icon.purpose === "string",
    `Icon ${icon.src ?? "<unknown>"} must declare purpose.`,
  );
  return icon.purpose.trim().toLowerCase().split(/\s+/).filter(Boolean);
}

function manifestSizes(icon) {
  invariant(
    typeof icon.sizes === "string",
    `Icon ${icon.src ?? "<unknown>"} must declare sizes.`,
  );
  return icon.sizes.trim().toLowerCase().split(/\s+/).filter(Boolean);
}

function localArtifactPath(root, source, label) {
  invariant(
    typeof source === "string" && source.length > 0,
    `${label} must have a non-empty src.`,
  );

  let url;
  try {
    url = new URL(source, "https://pwa.local/");
  } catch (error) {
    throw new Error(`${label} has an invalid src (${error.message}).`);
  }

  invariant(
    url.origin === "https://pwa.local",
    `${label} must reference a same-origin file.`,
  );
  invariant(
    url.search === "" && url.hash === "",
    `${label} must not use a query string or fragment.`,
  );

  let pathname;
  try {
    pathname = decodeURIComponent(url.pathname);
  } catch (error) {
    throw new Error(`${label} has an invalid encoded path (${error.message}).`);
  }

  const filePath = resolve(root, `.${pathname.split("/").join(sep)}`);
  const relativePath = relative(root, filePath);
  invariant(
    relativePath !== "" &&
      !relativePath.startsWith(`..${sep}`) &&
      relativePath !== ".." &&
      !isAbsolute(relativePath),
    `${label} resolves outside its artifact root.`,
  );

  return { filePath, pathname };
}

function parsePng(buffer, label) {
  invariant(buffer.length >= 33, `${label} is too short to be a PNG.`);
  invariant(
    buffer.subarray(0, 8).equals(PNG_SIGNATURE),
    `${label} has an invalid PNG signature.`,
  );

  let offset = 8;
  let ihdr;
  let transparency;
  const idatChunks = [];

  while (offset < buffer.length) {
    invariant(
      offset + 12 <= buffer.length,
      `${label} contains a truncated PNG chunk.`,
    );

    const length = buffer.readUInt32BE(offset);
    const type = buffer.toString("ascii", offset + 4, offset + 8);
    const dataStart = offset + 8;
    const dataEnd = dataStart + length;
    const chunkEnd = dataEnd + 4;
    invariant(
      chunkEnd <= buffer.length,
      `${label} contains a truncated ${type} chunk.`,
    );

    const data = buffer.subarray(dataStart, dataEnd);
    if (type === "IHDR") {
      invariant(!ihdr, `${label} contains multiple IHDR chunks.`);
      invariant(length === 13, `${label} has an invalid IHDR length.`);
      ihdr = {
        width: data.readUInt32BE(0),
        height: data.readUInt32BE(4),
        bitDepth: data[8],
        colorType: data[9],
        compression: data[10],
        filter: data[11],
        interlace: data[12],
      };
    } else if (type === "tRNS") {
      transparency = Buffer.from(data);
    } else if (type === "IDAT") {
      idatChunks.push(Buffer.from(data));
    } else if (type === "IEND") {
      break;
    }

    offset = chunkEnd;
  }

  invariant(ihdr, `${label} is missing its IHDR chunk.`);
  invariant(
    ihdr.width > 0 && ihdr.height > 0,
    `${label} has invalid dimensions.`,
  );
  invariant(
    ihdr.compression === 0,
    `${label} uses an unsupported PNG compression method.`,
  );
  invariant(
    ihdr.filter === 0,
    `${label} uses an unsupported PNG filter method.`,
  );
  invariant(
    ihdr.interlace === 0 || ihdr.interlace === 1,
    `${label} uses an invalid PNG interlace method.`,
  );
  invariant(idatChunks.length > 0, `${label} is missing image data.`);

  return { ...ihdr, idatChunks, transparency };
}

function channelCount(colorType, label) {
  const channels = new Map([
    [0, 1],
    [2, 3],
    [3, 1],
    [4, 2],
    [6, 4],
  ]).get(colorType);
  invariant(channels, `${label} uses unsupported PNG color type ${colorType}.`);
  return channels;
}

function validateBitDepth(colorType, bitDepth, label) {
  const validDepths = {
    0: [1, 2, 4, 8, 16],
    2: [8, 16],
    3: [1, 2, 4, 8],
    4: [8, 16],
    6: [8, 16],
  }[colorType];
  invariant(
    validDepths?.includes(bitDepth),
    `${label} uses invalid bit depth ${bitDepth} for color type ${colorType}.`,
  );
}

function passSize(total, start, step) {
  return total <= start ? 0 : Math.ceil((total - start) / step);
}

function pngPasses(png) {
  const passDefinitions = png.interlace === 0 ? [[0, 0, 1, 1]] : ADAM7_PASSES;
  return passDefinitions
    .map(([xStart, yStart, xStep, yStep]) => ({
      xStart,
      yStart,
      xStep,
      yStep,
      width: passSize(png.width, xStart, xStep),
      height: passSize(png.height, yStart, yStep),
    }))
    .filter((pass) => pass.width > 0 && pass.height > 0);
}

function paethPredictor(left, above, upperLeft) {
  const prediction = left + above - upperLeft;
  const leftDistance = Math.abs(prediction - left);
  const aboveDistance = Math.abs(prediction - above);
  const upperLeftDistance = Math.abs(prediction - upperLeft);

  if (leftDistance <= aboveDistance && leftDistance <= upperLeftDistance)
    return left;
  if (aboveDistance <= upperLeftDistance) return above;
  return upperLeft;
}

function unfilterRow(filtered, previous, bytesPerPixel, filterType, label) {
  const row = Buffer.allocUnsafe(filtered.length);

  for (let index = 0; index < filtered.length; index += 1) {
    const left = index >= bytesPerPixel ? row[index - bytesPerPixel] : 0;
    const above = previous?.[index] ?? 0;
    const upperLeft =
      index >= bytesPerPixel ? (previous?.[index - bytesPerPixel] ?? 0) : 0;

    let predictor;
    switch (filterType) {
      case 0:
        predictor = 0;
        break;
      case 1:
        predictor = left;
        break;
      case 2:
        predictor = above;
        break;
      case 3:
        predictor = Math.floor((left + above) / 2);
        break;
      case 4:
        predictor = paethPredictor(left, above, upperLeft);
        break;
      default:
        throw new Error(`${label} uses invalid PNG row filter ${filterType}.`);
    }

    row[index] = (filtered[index] + predictor) & 0xff;
  }

  return row;
}

function sampleAt(row, pixel, channel, channels, bitDepth) {
  if (bitDepth < 8) {
    const bitOffset = pixel * bitDepth;
    const shift = 8 - bitDepth - (bitOffset % 8);
    return (row[Math.floor(bitOffset / 8)] >> shift) & ((1 << bitDepth) - 1);
  }

  const sampleOffset = (pixel * channels + channel) * (bitDepth / 8);
  return bitDepth === 8 ? row[sampleOffset] : row.readUInt16BE(sampleOffset);
}

function pixelIsOpaque(row, pixel, png, channels) {
  const maxSample = (1 << Math.min(png.bitDepth, 16)) - 1;

  if (png.colorType === 4 || png.colorType === 6) {
    return (
      sampleAt(row, pixel, channels - 1, channels, png.bitDepth) === maxSample
    );
  }

  if (!png.transparency) return true;

  if (png.colorType === 0) {
    invariant(
      png.transparency.length === 2,
      "Grayscale PNG has an invalid tRNS chunk.",
    );
    return (
      sampleAt(row, pixel, 0, channels, png.bitDepth) !==
      png.transparency.readUInt16BE(0)
    );
  }

  if (png.colorType === 2) {
    invariant(
      png.transparency.length === 6,
      "Truecolor PNG has an invalid tRNS chunk.",
    );
    return [0, 1, 2].some(
      (channel) =>
        sampleAt(row, pixel, channel, channels, png.bitDepth) !==
        png.transparency.readUInt16BE(channel * 2),
    );
  }

  const paletteIndex = sampleAt(row, pixel, 0, channels, png.bitDepth);
  return (png.transparency[paletteIndex] ?? 255) === 255;
}

function assertFullyOpaque(png, label) {
  const channels = channelCount(png.colorType, label);
  validateBitDepth(png.colorType, png.bitDepth, label);

  if (
    (png.colorType === 0 || png.colorType === 2 || png.colorType === 3) &&
    !png.transparency
  ) {
    return;
  }

  if (png.colorType === 3 && png.transparency.every((alpha) => alpha === 255)) {
    return;
  }

  const bitsPerPixel = channels * png.bitDepth;
  const bytesPerPixel = Math.max(1, Math.ceil(bitsPerPixel / 8));
  const passes = pngPasses(png);
  const expectedInflatedBytes = passes.reduce(
    (total, pass) =>
      total + pass.height * (1 + Math.ceil((pass.width * bitsPerPixel) / 8)),
    0,
  );

  let inflated;
  try {
    inflated = inflateSync(Buffer.concat(png.idatChunks), {
      maxOutputLength: expectedInflatedBytes + 1,
    });
  } catch (error) {
    throw new Error(
      `${label} has invalid compressed image data: ${error.message}`,
    );
  }
  invariant(
    inflated.length === expectedInflatedBytes,
    `${label} has an unexpected amount of decoded image data.`,
  );

  let offset = 0;
  for (const pass of passes) {
    const rowBytes = Math.ceil((pass.width * bitsPerPixel) / 8);
    let previous;

    for (let passY = 0; passY < pass.height; passY += 1) {
      const filterType = inflated[offset];
      offset += 1;
      const filtered = inflated.subarray(offset, offset + rowBytes);
      offset += rowBytes;
      const row = unfilterRow(
        filtered,
        previous,
        bytesPerPixel,
        filterType,
        label,
      );

      for (let passX = 0; passX < pass.width; passX += 1) {
        if (!pixelIsOpaque(row, passX, png, channels)) {
          const x = pass.xStart + passX * pass.xStep;
          const y = pass.yStart + passY * pass.yStep;
          throw new Error(
            `${label} contains a transparent pixel at (${x}, ${y}); install icons must be fully opaque.`,
          );
        }
      }

      previous = row;
    }
  }
}

async function verifyPng(root, icon, requiredSize, manifestLabel) {
  const iconLabel = `${manifestLabel} icon ${icon.src}`;
  const { filePath, pathname } = localArtifactPath(root, icon.src, iconLabel);

  let buffer;
  try {
    buffer = await readFile(filePath);
  } catch (error) {
    throw new Error(
      `${iconLabel} is missing at ${describePath(filePath)} (${error.code ?? error.message}).`,
    );
  }

  const png = parsePng(buffer, iconLabel);
  invariant(
    png.width === requiredSize && png.height === requiredSize,
    `${iconLabel} declares ${requiredSize}x${requiredSize} but its IHDR is ${png.width}x${png.height}.`,
  );
  assertFullyOpaque(png, iconLabel);

  return pathname;
}

async function verifyManifest(manifest, root, label) {
  invariant(
    manifest && typeof manifest === "object" && !Array.isArray(manifest),
    `${label} must contain an object.`,
  );
  invariant(manifest.id === "/", `${label} id must be "/".`);
  invariant(manifest.start_url === "/", `${label} start_url must be "/".`);
  invariant(manifest.scope === "/", `${label} scope must be "/".`);
  invariant(
    manifest.display === "standalone",
    `${label} display must be "standalone".`,
  );

  const themeColor = normalizeOpaqueHexColor(
    manifest.theme_color,
    `${label} theme_color`,
  );
  const backgroundColor = normalizeOpaqueHexColor(
    manifest.background_color,
    `${label} background_color`,
  );
  invariant(
    themeColor === backgroundColor,
    `${label} theme_color and background_color must match.`,
  );

  invariant(Array.isArray(manifest.icons), `${label} icons must be an array.`);

  const requirements = [
    { purpose: "any", size: 192 },
    { purpose: "any", size: 512 },
    { purpose: "maskable", size: 512 },
  ];
  const selected = [];

  for (const requirement of requirements) {
    const icon = manifest.icons.find((candidate) => {
      invariant(
        candidate && typeof candidate === "object" && !Array.isArray(candidate),
        `${label} contains an invalid icon.`,
      );
      const purposes = manifestPurpose(candidate);
      const sizes = manifestSizes(candidate);
      return (
        purposes.length === 1 &&
        purposes[0] === requirement.purpose &&
        sizes.includes(`${requirement.size}x${requirement.size}`)
      );
    });

    invariant(
      icon,
      `${label} needs a separate purpose=${requirement.purpose} ${requirement.size}x${requirement.size} icon.`,
    );
    invariant(
      icon.type?.toLowerCase() === "image/png",
      `${label} icon ${icon.src} must declare type image/png.`,
    );
    selected.push({ ...requirement, icon });
  }

  const iconSources = selected.map(({ icon }) => icon.src);
  invariant(
    new Set(iconSources).size === selected.length,
    `${label} must use separate files for each required icon.`,
  );

  const pathnames = [];
  for (const { icon, size } of selected) {
    pathnames.push(await verifyPng(root, icon, size, label));
  }

  return pathnames;
}

async function verifyCoreWorkers() {
  for (const filename of ["ngsw-worker.js", "safety-worker.js"]) {
    const filePath = resolve(browserRoot, filename);
    try {
      await access(filePath);
      const metadata = await stat(filePath);
      invariant(
        metadata.isFile() && metadata.size > 0,
        `${describePath(filePath)} must be a non-empty file.`,
      );
    } catch (error) {
      if (error instanceof Error && !error.code) throw error;
      throw new Error(
        `Missing Angular service-worker runtime: ${describePath(filePath)}.`,
      );
    }
  }
}

function verifyNavigationRules(ngswConfig, ngsw) {
  invariant(
    Array.isArray(ngswConfig.navigationUrls),
    "ngsw-config.json navigationUrls must be an array.",
  );
  for (const exclusion of ["!/api", "!/api/**"]) {
    invariant(
      ngswConfig.navigationUrls.includes(exclusion),
      `ngsw-config.json must include navigation exclusion ${exclusion}.`,
    );
  }

  invariant(
    Array.isArray(ngsw.navigationUrls),
    "Generated ngsw.json must contain navigationUrls.",
  );
  const negativeRules = ngsw.navigationUrls.filter(
    (rule) => rule?.positive === false && typeof rule.regex === "string",
  );
  const compiledRules = negativeRules.map((rule) => {
    try {
      return new RegExp(rule.regex);
    } catch (error) {
      throw new Error(
        `Generated ngsw.json contains invalid navigation regex ${rule.regex}: ${error.message}`,
      );
    }
  });

  for (const url of ["/api", "/api/posts"]) {
    invariant(
      compiledRules.some((regex) => regex.test(url)),
      `Generated ngsw.json does not exclude navigation request ${url}.`,
    );
  }
}

function hashAlgorithmFor(digest, url) {
  invariant(
    typeof digest === "string" && /^[0-9a-f]+$/i.test(digest),
    `ngsw.json hashTable has an invalid digest for ${url}.`,
  );
  const algorithm = new Map([
    [40, "sha1"],
    [64, "sha256"],
    [128, "sha512"],
  ]).get(digest.length);
  invariant(
    algorithm,
    `ngsw.json hashTable uses an unsupported digest length for ${url}.`,
  );
  return algorithm;
}

async function verifyHashTable(ngsw, expectedUrls) {
  invariant(
    ngsw.hashTable &&
      typeof ngsw.hashTable === "object" &&
      !Array.isArray(ngsw.hashTable),
    "Generated ngsw.json must contain a hashTable object.",
  );
  const entries = Object.entries(ngsw.hashTable).sort(([left], [right]) =>
    left.localeCompare(right),
  );
  invariant(
    entries.length > 0,
    "Generated ngsw.json hashTable must not be empty.",
  );

  for (const expectedUrl of expectedUrls) {
    invariant(
      Object.hasOwn(ngsw.hashTable, expectedUrl),
      `ngsw.json hashTable is missing ${expectedUrl}.`,
    );
  }

  for (const [url, expectedDigest] of entries) {
    const { filePath } = localArtifactPath(
      browserRoot,
      url,
      `ngsw.json hashTable entry ${url}`,
    );
    let contents;
    try {
      contents = await readFile(filePath);
    } catch (error) {
      throw new Error(
        `ngsw.json hashes missing artifact ${describePath(filePath)} (${error.code ?? error.message}).`,
      );
    }

    const algorithm = hashAlgorithmFor(expectedDigest, url);
    const actualDigest = createHash(algorithm).update(contents).digest("hex");
    invariant(
      actualDigest === expectedDigest.toLowerCase(),
      `ngsw.json has a stale ${algorithm} digest for ${url}.`,
    );
  }

  invariant(
    Array.isArray(ngsw.assetGroups) && ngsw.assetGroups.length > 0,
    "Generated ngsw.json must contain assetGroups.",
  );
  for (const group of ngsw.assetGroups) {
    invariant(
      typeof group?.name === "string",
      "Generated ngsw.json contains an invalid asset group.",
    );
    invariant(
      Array.isArray(group.urls),
      `Generated ngsw.json asset group ${group.name} must contain urls.`,
    );
    for (const url of group.urls) {
      invariant(
        Object.hasOwn(ngsw.hashTable, url),
        `Asset group ${group.name} references unhashed URL ${url}.`,
      );
    }
  }

  return entries.length;
}

async function main() {
  // Read in a fixed order so a broken artifact set always reports the same first failure.
  const packageJson = await readJson(paths.packageJson);
  const sourceManifest = await readJson(paths.sourceManifest);
  const ngswConfig = await readJson(paths.ngswConfig);
  const builtManifest = await readJson(paths.builtManifest);
  const ngsw = await readJson(paths.ngsw);

  invariant(
    typeof packageJson.version === "string" && packageJson.version.length > 0,
    "package.json must declare a version.",
  );
  invariant(
    ngswConfig.appData?.version === packageJson.version,
    `ngsw-config.json appData.version (${ngswConfig.appData?.version ?? "missing"}) must equal package.json version (${packageJson.version}).`,
  );
  invariant(
    ngsw.appData?.version === packageJson.version,
    `Generated ngsw.json appData.version (${ngsw.appData?.version ?? "missing"}) must equal package.json version (${packageJson.version}).`,
  );
  invariant(
    isDeepStrictEqual(ngsw.appData, ngswConfig.appData),
    "Generated ngsw.json appData must match ngsw-config.json appData.",
  );
  invariant(
    isDeepStrictEqual(builtManifest, sourceManifest),
    "Built manifest.webmanifest is stale or differs from public/manifest.webmanifest.",
  );

  const sourceIconUrls = await verifyManifest(
    sourceManifest,
    publicRoot,
    "public/manifest.webmanifest",
  );
  const builtIconUrls = await verifyManifest(
    builtManifest,
    browserRoot,
    "built manifest.webmanifest",
  );

  await verifyCoreWorkers();
  verifyNavigationRules(ngswConfig, ngsw);

  invariant(
    ngsw.configVersion === 1,
    "Generated ngsw.json must use Angular service-worker configVersion 1.",
  );
  invariant(
    ngsw.index === "/index.html",
    "Generated ngsw.json index must be /index.html.",
  );

  const expectedHashedUrls = new Set([
    "/index.html",
    "/manifest.webmanifest",
    ...builtIconUrls,
  ]);
  const hashCount = await verifyHashTable(ngsw, expectedHashedUrls);

  invariant(
    isDeepStrictEqual(sourceIconUrls, builtIconUrls),
    "Built manifest icon paths must match public/manifest.webmanifest icon paths.",
  );

  console.log(
    `PWA verification passed: ${hashCount} hashed artifacts, 2 worker runtimes, and 3 opaque install icons.`,
  );
}

main().catch((error) => {
  console.error(`PWA verification failed: ${error.message}`);
  process.exitCode = 1;
});
