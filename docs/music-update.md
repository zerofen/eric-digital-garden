# 音乐更新指南

音乐文件保存在 `public/music/`，歌名、歌手、介绍和文件地址保存在 `content/collections.json`。建议使用下面的自动命令，它会转换格式、控制 Cloudflare 资源大小并更新歌单。

## 第一次使用

打开 PowerShell，执行：

```powershell
Set-Location 'F:\Eric0\Blog'
git pull --rebase
npm install
```

## 添加一首歌

源文件可以放在下载目录，也可以先放进 `public/music/`。运行：

```powershell
npm run music:add -- --file 'D:\Music\歌曲.flac' --title '歌曲名' --artist '周兴哲' --note '写一句自己的介绍'
```

该命令会执行这些工作：

1. 把 FLAC、MP3、WAV 或 M4A 转成 192 kbps 标准 MP3。
2. 将成品写入 `public/music/歌曲名.mp3`。
3. 检查单曲是否低于 Cloudflare 的 25 MiB 静态资源上限。
4. 把歌曲信息写入 `content/collections.json`。
5. 如果源文件本来就在 `public/music/`，将原始文件移到不上传的 `.music-source/` 备份目录。

NCM、NCP 不是标准音频文件，仅修改后缀不能转换。需要使用拥有授权的标准 FLAC、MP3、WAV 或 M4A 文件。

## 更新已有歌曲

更换同名歌曲的音频或介绍时追加 `--force`：

```powershell
npm run music:add -- --file 'D:\Music\歌曲新版.flac' --title '歌曲名' --artist '周兴哲' --note '新的介绍' --force
```

旧文件会自动保存到 `.music-source/`。

## 本地检查

```powershell
npm run lint
npm run check
npm test
npm run build
npm run preview
```

浏览器打开 `http://127.0.0.1:4173/music/`。确认歌曲可以播放、拖动进度条可以跳转、通过顶部导航切局部切换页面时音乐不会停止。

## 上传并发布

检查通过后执行：

```powershell
git add package.json package-lock.json scripts/add-music.mjs content/collections.json public/music docs/music-update.md
git commit -m "music: add 歌曲名"
git push
```

推送到 `main` 后，Cloudflare 会自动构建和部署。通常等待一到两分钟，然后打开：

```text
https://eric.sryze.cc/music/
```

如果只是修改歌名、歌手、介绍或外部链接，不更换音频文件，也可以进入网站管理员模式，打开“音乐”栏目编辑并保存。管理员页面目前只管理歌曲信息；新的音频文件仍需通过上面的命令上传到 GitHub。

## 常见问题

- **改成 `.mp3` 后不能播放**：文件内部仍可能是 FLAC 或其他格式，请运行 `music:add` 完成真正转码。
- **Cloudflare 构建失败并提示资源过大**：单个文件必须低于 25 MiB。
- **歌名里有中文或空格**：可以正常使用，命令会生成对应的 UTF-8 文件路径。
- **切换页面后音乐停止**：应使用网站顶部导航进行站内切换；刷新页面、关闭标签页或直接输入新网址会重新载入浏览器文档，浏览器会停止当前音频。
