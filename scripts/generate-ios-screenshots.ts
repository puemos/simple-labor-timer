import { spawn, type ChildProcess } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { mkdir, mkdtemp, rename, rm, stat } from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';

type CliOptions = {
  bundleId?: string;
  device?: string;
  scheme?: string;
  skipBuild: boolean;
};

type CommandResult = {
  code: number;
  stdout: string;
  stderr: string;
};

type SimulatorDevice = {
  name: string;
  udid: string;
  state: string;
  isAvailable: boolean;
};

type ExpoConfig = {
  scheme?: string;
  ios?: {
    bundleIdentifier?: string;
  };
};

type Shot = {
  key: string;
  fileName: string;
  caption: [string, string];
  settleMs: number;
};

const repoRoot = process.cwd();
const outputRoot = path.join(repoRoot, 'metadata/screenshots/en-US/ios/iphone-6.9');
const rawDir = path.join(outputRoot, 'raw');
const promoDir = path.join(outputRoot, 'promo');
const outputWidth = 1320;
const outputHeight = 2868;
const defaultDeviceName = 'iPhone 16 Pro Max';
const defaultPort = 8081;
const launchSettleMs = 20_000;

const shots: Shot[] = [
  {
    key: 'timer-active',
    fileName: '01-one-tap-timer.png',
    caption: ['Start timing', 'with one tap'],
    settleMs: 6_000,
  },
  {
    key: 'rhythm',
    fileName: '02-rhythm-at-a-glance.png',
    caption: ['See the rhythm', 'as it develops'],
    settleMs: 7_000,
  },
  {
    key: 'call-rule',
    fileName: '03-call-rule-match.png',
    caption: ['Know when your', 'saved rule matches'],
    settleMs: 6_000,
  },
  {
    key: 'history',
    fileName: '04-review-history.png',
    caption: ['Review every', 'contraction'],
    settleMs: 6_000,
  },
  {
    key: 'share',
    fileName: '05-private-share.png',
    caption: ['Share a private', 'update'],
    settleMs: 7_000,
  },
];

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const config = readExpoConfig();

  await assertTool('xcrun', ['--version']);
  await assertTool('magick', ['-version']);
  await mkdir(rawDir, { recursive: true });
  await mkdir(promoDir, { recursive: true });

  const device = await findDevice(options.device ?? defaultDeviceName);
  log(`Using simulator ${device.name} (${device.udid})`);
  await bootDevice(device.udid);
  await setStableSimulatorUi(device.udid);

  if (!options.skipBuild) {
    await regenerateNativeProject();
    await installIosApp(device.udid);
  } else {
    log('Skipping native build/install because --skip-build was passed');
  }

  const installedApps = await listInstalledApps(device.udid);
  const bundleId = detectBundleId(installedApps, options.bundleId ?? config.ios?.bundleIdentifier);
  const schemeCandidates = uniqueValues([
    options.scheme,
    config.scheme,
    bundleId,
    options.bundleId,
    config.ios?.bundleIdentifier,
    'app.itiscoming.contractions',
    'simplelabortimer',
  ]);
  if (schemeCandidates.length === 0) {
    throw new Error('No URL scheme candidate was found. Pass --scheme <scheme>.');
  }

  const port = await findAvailablePort(defaultPort);
  const metro = startMetro(port);
  const tempDir = await mkdtemp(path.join(tmpdir(), 'simple-labor-timer-screenshots-'));

  try {
    await waitForMetro(port);
    const scheme = await launchDevClient(device.udid, schemeCandidates, port, bundleId);

    for (const shot of shots) {
      await captureShot(device.udid, scheme, shot, tempDir);
    }

    for (const shot of shots) {
      await composePromo(shot, tempDir);
    }

    await verifyOutputs();
    log(`Saved raw screenshots to ${rawDir}`);
    log(`Saved promo screenshots to ${promoDir}`);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
    await stopMetro(metro);
  }
}

function parseArgs(args: string[]): CliOptions {
  const options: CliOptions = { skipBuild: false };
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    switch (arg) {
      case '--':
        break;
      case '--skip-build':
        options.skipBuild = true;
        break;
      case '--device':
        options.device = requireValue(args, ++index, arg);
        break;
      case '--bundle-id':
        options.bundleId = requireValue(args, ++index, arg);
        break;
      case '--scheme':
        options.scheme = requireValue(args, ++index, arg);
        break;
      case '--help':
      case '-h':
        printHelp();
        process.exit(0);
      default:
        throw new Error(`Unknown option: ${arg}`);
    }
  }
  return options;
}

function requireValue(args: string[], index: number, flag: string): string {
  const value = args[index];
  if (!value || value.startsWith('--')) {
    throw new Error(`${flag} requires a value`);
  }
  return value;
}

function printHelp() {
  console.log(`Usage: pnpm screenshots:ios [-- --skip-build] [-- --device <udid-or-name>] [-- --bundle-id <id>] [-- --scheme <scheme>]

Captures separated raw simulator screenshots and framed 1320 x 2868 promo PNGs for App Store Connect.

Options:
  --skip-build       Use the app already installed on the simulator.
  --device <value>   Simulator UDID or name. Defaults to "${defaultDeviceName}".
  --bundle-id <id>   Installed app bundle id override.
  --scheme <scheme>  URL scheme override for dev-client and shot deep links.`);
}

function readExpoConfig(): ExpoConfig {
  const appJsonPath = path.join(repoRoot, 'app.json');
  const parsed = JSON.parse(readFileSync(appJsonPath, 'utf8')) as { expo?: ExpoConfig };
  return parsed.expo ?? {};
}

async function assertTool(command: string, args: string[]) {
  const result = await run(command, args, { quiet: true, allowFailure: true });
  if (result.code !== 0) {
    throw new Error(`Required tool not available: ${command}`);
  }
}

async function findDevice(selector: string): Promise<SimulatorDevice> {
  const result = await run('xcrun', ['simctl', 'list', 'devices', 'available', '--json'], { quiet: true });
  const parsed = JSON.parse(result.stdout) as { devices: Record<string, SimulatorDevice[]> };
  const devices = Object.values(parsed.devices)
    .flat()
    .filter((device) => device.isAvailable);
  const normalizedSelector = selector.toLowerCase();
  const matches = devices.filter((device) => {
    return device.udid === selector || device.name.toLowerCase() === normalizedSelector;
  });
  const fuzzyMatches = matches.length
    ? matches
    : devices.filter((device) => device.name.toLowerCase().includes(normalizedSelector));

  if (fuzzyMatches.length === 0) {
    throw new Error(`No available iOS simulator matched "${selector}".`);
  }

  return fuzzyMatches.sort((left, right) => scoreDevice(right, selector) - scoreDevice(left, selector))[0];
}

function scoreDevice(device: SimulatorDevice, selector: string): number {
  let score = 0;
  if (device.udid === selector) score += 100;
  if (device.name === selector) score += 50;
  if (device.state === 'Booted') score += 10;
  return score;
}

async function bootDevice(udid: string) {
  await run('xcrun', ['simctl', 'boot', udid], { allowFailure: true, quiet: true });
  await run('xcrun', ['simctl', 'bootstatus', udid, '-b']);
}

async function setStableSimulatorUi(udid: string) {
  await run('xcrun', ['simctl', 'ui', udid, 'appearance', 'light']);
  await run(
    'xcrun',
    [
      'simctl',
      'status_bar',
      udid,
      'override',
      '--time',
      '9:41',
      '--batteryState',
      'charged',
      '--batteryLevel',
      '100',
      '--cellularBars',
      '4',
      '--wifiBars',
      '3',
    ],
    { allowFailure: true },
  );
}

async function regenerateNativeProject() {
  log('Regenerating the ignored iOS native project');
  await run('pnpm', ['exec', 'expo', 'prebuild', '--platform', 'ios', '--clean', '--pnpm']);
}

async function installIosApp(udid: string) {
  log('Building and installing the iOS dev app');
  await run('pnpm', ['exec', 'expo', 'run:ios', '--device', udid, '--no-bundler']);
}

async function listInstalledApps(udid: string): Promise<string> {
  const result = await run('xcrun', ['simctl', 'listapps', udid], { quiet: true });
  return result.stdout;
}

function detectBundleId(listAppsOutput: string, preferredBundleId?: string): string | undefined {
  const candidates = uniqueValues([
    preferredBundleId,
    'app.simplelabortimer',
    'app.itiscoming.contractions',
  ]);

  for (const candidate of candidates) {
    if (listAppsOutput.includes(`"${candidate}" =`)) {
      return candidate;
    }
  }

  const userAppPattern = /"([^"]+)" =\s+\{([\s\S]*?)\n    \};/g;
  let match: RegExpExecArray | null;
  while ((match = userAppPattern.exec(listAppsOutput))) {
    const [, bundleId, body] = match;
    if (
      body.includes('ApplicationType = User') &&
      /CFBundleDisplayName = "?((Simple Labor Timer)|(Contraction Timer))"?;/.test(body)
    ) {
      return bundleId;
    }
  }

  return preferredBundleId;
}

function startMetro(port: number): ChildProcess {
  log(`Starting Expo dev server on localhost:${port}`);
  const child = spawn('pnpm', ['exec', 'expo', 'start', '--dev-client', '--localhost', '--clear', '--port', String(port)], {
    cwd: repoRoot,
    detached: true,
    env: commandEnv(),
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stdout.on('data', (chunk) => process.stdout.write(chunk));
  child.stderr.on('data', (chunk) => process.stderr.write(chunk));
  return child;
}

async function stopMetro(child: ChildProcess) {
  if (child.exitCode !== null || child.signalCode) return;
  signalProcessGroup(child, 'SIGTERM');
  await waitForExit(child, 3_000);
  if (child.exitCode === null && !child.signalCode) {
    signalProcessGroup(child, 'SIGKILL');
    await waitForExit(child, 1_000);
  }
}

function signalProcessGroup(child: ChildProcess, signal: NodeJS.Signals) {
  if (!child.pid) return;
  try {
    process.kill(-child.pid, signal);
  } catch {
    child.kill(signal);
  }
}

function waitForExit(child: ChildProcess, ms: number): Promise<void> {
  if (child.exitCode !== null || child.signalCode) {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ms);
    child.once('exit', () => {
      clearTimeout(timer);
      resolve();
    });
  });
}

async function waitForMetro(port: number) {
  const deadline = Date.now() + 120_000;
  const statusUrl = `http://127.0.0.1:${port}/status`;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(statusUrl);
      const body = await response.text();
      if (body.includes('packager-status:running')) {
        log('Expo dev server is ready');
        return;
      }
    } catch {
      // Keep polling until Metro is listening.
    }
    await sleep(1_000);
  }
  throw new Error(`Expo dev server did not become ready at ${statusUrl}`);
}

async function launchDevClient(
  udid: string,
  schemeCandidates: string[],
  port: number,
  bundleId?: string,
): Promise<string> {
  if (bundleId) {
    await run('xcrun', ['simctl', 'terminate', udid, bundleId], { allowFailure: true, quiet: true });
    await sleep(1_000);
  }

  const devServerUrl = `http://127.0.0.1:${port}`;
  for (const scheme of schemeCandidates) {
    const url = `${scheme}://expo-development-client/?url=${encodeURIComponent(devServerUrl)}`;
    const result = await run('xcrun', ['simctl', 'openurl', udid, url], { allowFailure: true, quiet: true });
    if (result.code === 0) {
      log(`Launched dev client with URL scheme "${scheme}"`);
      await sleep(launchSettleMs);
      await foregroundApp(udid, bundleId);
      return scheme;
    }
  }

  throw new Error(`Could not open the dev client with any URL scheme: ${schemeCandidates.join(', ')}`);
}

async function captureShot(udid: string, scheme: string, shot: Shot, tempDir: string) {
  log(`Capturing ${shot.fileName}`);
  const shotUrl = `${scheme}://?shot=${encodeURIComponent(shot.key)}`;
  await run('xcrun', ['simctl', 'openurl', udid, shotUrl]);
  await sleep(shot.settleMs);

  const rawPath = path.join(rawDir, shot.fileName);
  await run('xcrun', ['simctl', 'io', udid, 'screenshot', rawPath]);
  await flattenPng(rawPath, path.join(tempDir, `${shot.key}-raw.png`));
}

async function foregroundApp(udid: string, bundleId?: string) {
  if (!bundleId) return;
  await run('xcrun', ['simctl', 'launch', udid, bundleId], { allowFailure: true, quiet: true });
}

async function flattenPng(filePath: string, tempPath: string) {
  await run('magick', [filePath, '-alpha', 'off', '-colorspace', 'sRGB', `PNG24:${tempPath}`], { quiet: true });
  await rename(tempPath, filePath);
}

async function composePromo(shot: Shot, tempDir: string) {
  log(`Composing ${shot.fileName}`);
  const rawPath = path.join(rawDir, shot.fileName);
  const promoPath = path.join(promoDir, shot.fileName);
  const resizedPath = path.join(tempDir, `${shot.key}-resized.png`);
  const maskPath = path.join(tempDir, `${shot.key}-mask.png`);
  const displayPath = path.join(tempDir, `${shot.key}-display.png`);

  const displayWidth = 976;
  const displayHeight = 2121;
  const frameWidth = 1024;
  const frameHeight = 2169;
  const frameX = 148;
  const frameY = 560;
  const displayX = 172;
  const displayY = 584;

  await run(
    'magick',
    [
      rawPath,
      '-resize',
      `${displayWidth}x${displayHeight}^`,
      '-gravity',
      'center',
      '-extent',
      `${displayWidth}x${displayHeight}`,
      resizedPath,
    ],
    { quiet: true },
  );
  await run(
    'magick',
    [
      '-size',
      `${displayWidth}x${displayHeight}`,
      'xc:none',
      '-fill',
      'white',
      '-draw',
      `roundrectangle 0,0 ${displayWidth - 1},${displayHeight - 1} 66,66`,
      maskPath,
    ],
    { quiet: true },
  );
  await run('magick', [resizedPath, maskPath, '-alpha', 'off', '-compose', 'CopyOpacity', '-composite', displayPath], {
    quiet: true,
  });

  const titleFont = firstExisting([
    '/Library/Fonts/SF-Pro-Display-Bold.otf',
    '/System/Library/Fonts/Supplemental/Arial Bold.ttf',
  ]);
  const labelFont = firstExisting([
    '/Library/Fonts/SF-Pro-Text-Semibold.otf',
    '/System/Library/Fonts/Supplemental/Arial Bold.ttf',
  ]);

  await run(
    'magick',
    [
      '-size',
      `${outputWidth}x${outputHeight}`,
      'xc:#F7EFE7',
      '(',
      '-size',
      `${frameWidth}x${frameHeight}`,
      'xc:none',
      '-fill',
      'rgba(80,57,43,0.18)',
      '-draw',
      `roundrectangle 0,0 ${frameWidth - 1},${frameHeight - 1} 98,98`,
      ')',
      '-geometry',
      `+${frameX}+${frameY + 18}`,
      '-compose',
      'over',
      '-composite',
      '(',
      '-size',
      `${frameWidth}x${frameHeight}`,
      'xc:none',
      '-fill',
      '#1C1714',
      '-draw',
      `roundrectangle 0,0 ${frameWidth - 1},${frameHeight - 1} 92,92`,
      ')',
      '-geometry',
      `+${frameX}+${frameY}`,
      '-compose',
      'over',
      '-composite',
      '(',
      '-size',
      `${frameWidth - 30}x${frameHeight - 30}`,
      'xc:none',
      '-fill',
      '#FAF3EC',
      '-draw',
      `roundrectangle 0,0 ${frameWidth - 31},${frameHeight - 31} 78,78`,
      ')',
      '-geometry',
      `+${frameX + 15}+${frameY + 15}`,
      '-compose',
      'over',
      '-composite',
      displayPath,
      '-geometry',
      `+${displayX}+${displayY}`,
      '-compose',
      'over',
      '-composite',
      ...(labelFont ? ['-font', labelFont] : []),
      '-pointsize',
      '42',
      '-fill',
      '#7C5B45',
      '-gravity',
      'North',
      '-annotate',
      '+0+170',
      'SIMPLE LABOR TIMER',
      ...(titleFont ? ['-font', titleFont] : []),
      '-pointsize',
      '82',
      '-fill',
      '#211714',
      '-annotate',
      '+0+245',
      shot.caption[0],
      '-annotate',
      '+0+340',
      shot.caption[1],
      '-strip',
      `PNG24:${promoPath}`,
    ],
    { quiet: true },
  );
}

async function verifyOutputs() {
  for (const folder of [rawDir, promoDir]) {
    for (const shot of shots) {
      const filePath = path.join(folder, shot.fileName);
      const file = await stat(filePath);
      if (file.size <= 0) {
        throw new Error(`Screenshot is empty: ${filePath}`);
      }

      const identify = await run(
        'magick',
        ['identify', '-format', '%m %w %h %[colorspace] %[type]', filePath],
        { quiet: true },
      );
      const [format, width, height, colorspace, type] = identify.stdout.trim().split(/\s+/);
      if (format !== 'PNG' || Number(width) !== outputWidth || Number(height) !== outputHeight) {
        throw new Error(`Unexpected screenshot geometry for ${filePath}: ${identify.stdout}`);
      }
      if (!['RGB', 'sRGB'].includes(colorspace) || !type.startsWith('TrueColor')) {
        throw new Error(`Unexpected screenshot color mode for ${filePath}: ${identify.stdout}`);
      }
    }
  }
}

async function findAvailablePort(startPort: number): Promise<number> {
  for (let port = startPort; port < startPort + 20; port += 1) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available localhost port found from ${startPort} to ${startPort + 19}`);
}

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = createServer();
    server.once('error', () => resolve(false));
    server.once('listening', () => {
      server.close(() => resolve(true));
    });
    server.listen(port, '127.0.0.1');
  });
}

function firstExisting(paths: string[]): string | undefined {
  return paths.find((item) => existsSync(item));
}

function uniqueValues(values: Array<string | undefined>): string[] {
  return [...new Set(values.filter((value): value is string => Boolean(value)))];
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function run(
  command: string,
  args: string[],
  options: { allowFailure?: boolean; quiet?: boolean } = {},
): Promise<CommandResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: repoRoot,
      env: commandEnv(),
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk: Buffer) => {
      const text = chunk.toString();
      stdout += text;
      if (!options.quiet) process.stdout.write(text);
    });
    child.stderr.on('data', (chunk: Buffer) => {
      const text = chunk.toString();
      stderr += text;
      if (!options.quiet) process.stderr.write(text);
    });
    child.on('error', reject);
    child.on('close', (code) => {
      const result = { code: code ?? 0, stdout, stderr };
      if (result.code !== 0 && !options.allowFailure) {
        reject(new Error(`${command} ${args.join(' ')} failed with exit code ${result.code}\n${stderr || stdout}`));
        return;
      }
      resolve(result);
    });
  });
}

function log(message: string) {
  console.log(`[screenshots:ios] ${message}`);
}

function commandEnv(): NodeJS.ProcessEnv {
  return {
    ...process.env,
    EXPO_NO_TELEMETRY: '1',
    LANG: 'en_US.UTF-8',
    LC_ALL: 'en_US.UTF-8',
    LC_CTYPE: 'en_US.UTF-8',
  };
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
