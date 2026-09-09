import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import ffmpegPath from 'ffmpeg-static';

const maxAssetBytes = 25 * 1024 * 1024;
const projectRoot = process.cwd();
const musicDirectory = path.join(projectRoot, 'public', 'music');
const backupDirectory = path.join(projectRoot, '.music-source');
const collectionsPath = path.join(projectRoot, 'content', 'collections.json');

function printHelp() {
  console.log(`添加或更新音乐：

npm run music:add -- --file "D:\\Music\\歌曲.flac" --title "歌曲名" --artist "歌手" --note "一句介绍"

参数：
  --file    必填，源音频路径。支持 FFmpeg 可以读取的 FLAC、MP3、WAV、M4A 等格式。
  --title   必填，页面显示的歌曲名，同时用于生成 MP3 文件名。
  --artist  可选，默认“周兴哲”。
  --note    可选，页面显示的一句话介绍。
  --force   可选，覆盖同名歌曲或歌单条目；旧音频会备份到 .music-source。
  --help    显示本说明。
`);
}

function parseArguments(values) {
  const result = { force: false };
  for (let index = 0; index < values.length; index += 1) {
    const argument = values[index];
    if (argument === '--force') {
      result.force = true;
      continue;
    }
    if (!argument.startsWith('--'))
      throw new Error(`无法识别参数：${argument}`);
    const value = values[index + 1];
    if (!value || value.startsWith('--'))
      throw new Error(`${argument} 后面缺少内容。`);
    result[argument.slice(2)] = value;
    index += 1;
  }
  return result;
}

function safeFileStem(title) {
  const stem = title
    .trim()
    .replace(/[<>:"/\\|?*\p{Cc}]/gu, '-')
    .replace(/[. ]+$/g, '');
  if (!stem) throw new Error('歌曲名无法生成有效文件名。');
  return stem;
}

function samePath(left, right) {
  return path.resolve(left).toLowerCase() === path.resolve(right).toLowerCase();
}

function moveToBackup(file) {
  fs.mkdirSync(backupDirectory, { recursive: true });
  const parsed = path.parse(file);
  const timestamp = new Date().toISOString().replaceAll(/[:.]/g, '-');
  const target = path.join(
    backupDirectory,
    `${parsed.name}-${timestamp}${parsed.ext}`,
  );
  fs.renameSync(file, target);
  return target;
}

if (process.argv.includes('--help') || process.argv.length === 2) {
  printHelp();
  process.exit(0);
}

const options = parseArguments(process.argv.slice(2));
if (!options.file || !options.title)
  throw new Error(
    '必须同时填写 --file 和 --title。运行 npm run music:add -- --help 查看示例。',
  );

const source = path.resolve(options.file);
if (!fs.existsSync(source) || !fs.statSync(source).isFile())
  throw new Error(`找不到源音频：${source}`);
if (['.ncm', '.ncp'].includes(path.extname(source).toLowerCase()))
  throw new Error(
    'NCM/NCP 不是标准音频文件。请先从拥有授权的来源取得可播放的 FLAC、MP3、WAV 或 M4A。',
  );
if (!ffmpegPath || !fs.existsSync(ffmpegPath))
  throw new Error('FFmpeg 尚未安装。请先运行 npm install。');

const title = options.title.trim();
const artist = (options.artist || '周兴哲').trim();
const note = options.note?.trim();
const fileName = `${safeFileStem(title)}.mp3`;
const publicAudioPath = `/music/${fileName}`;
const output = path.join(musicDirectory, fileName);
const collections = JSON.parse(fs.readFileSync(collectionsPath, 'utf8'));
const existingIndex = collections.music.findIndex(
  (track) => track.title === title && track.artist === artist,
);

if (existingIndex >= 0 && !options.force)
  throw new Error('歌单中已经有同名歌曲。如需更新音频，请追加 --force。');
if (fs.existsSync(output) && !samePath(source, output) && !options.force)
  throw new Error(`目标文件已经存在：${output}。如需替换，请追加 --force。`);

fs.mkdirSync(musicDirectory, { recursive: true });
const temporaryOutput = path.join(
  musicDirectory,
  `.music-${process.pid}-${Date.now()}.mp3`,
);
const conversion = spawnSync(
  ffmpegPath,
  [
    '-hide_banner',
    '-loglevel',
    'error',
    '-y',
    '-i',
    source,
    '-map_metadata',
    '0',
    '-vn',
    '-c:a',
    'libmp3lame',
    '-b:a',
    '192k',
    '-id3v2_version',
    '3',
    temporaryOutput,
  ],
  { stdio: 'inherit' },
);

if (conversion.status !== 0 || !fs.existsSync(temporaryOutput)) {
  if (fs.existsSync(temporaryOutput)) fs.unlinkSync(temporaryOutput);
  throw new Error('音频转换失败，请确认源文件能够正常播放。');
}
if (fs.statSync(temporaryOutput).size > maxAssetBytes) {
  fs.unlinkSync(temporaryOutput);
  throw new Error(
    '转换结果仍超过 25 MiB，暂时不能作为 Cloudflare 静态资源部署。',
  );
}

const backups = [];
const sourceIsInsideMusic = samePath(path.dirname(source), musicDirectory);
if (sourceIsInsideMusic) backups.push(moveToBackup(source));
if (fs.existsSync(output) && !samePath(source, output))
  backups.push(moveToBackup(output));
fs.renameSync(temporaryOutput, output);

const item = {
  title,
  artist,
  ...(note ? { note } : {}),
  audio: publicAudioPath,
};
if (existingIndex >= 0) collections.music[existingIndex] = item;
else collections.music.push(item);
fs.writeFileSync(collectionsPath, `${JSON.stringify(collections, null, 2)}\n`);

console.log(`\n已生成：public/music/${fileName}`);
console.log(
  `已${existingIndex >= 0 ? '更新' : '添加'}歌单：${title} · ${artist}`,
);
for (const backup of backups)
  console.log(`原文件备份：${path.relative(projectRoot, backup)}`);
console.log('\n发布前依次运行：');
console.log('  npm test');
console.log('  npm run build');
console.log('  git add public/music content/collections.json');
console.log(`  git commit -m "music: add ${title}"`);
console.log('  git push');
