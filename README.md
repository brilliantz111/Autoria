# Autoria 资讯聚合器

这个仓库做的事情：**每 2 小时自动抓取一次科技 / 金融 / 游戏三大行业的最新资讯**，生成一个 `news.js` 文件。你的工作台（Autoria 的工作台）通过免费 CDN 读取这个文件，所以打开就能看到最新资讯，不再依赖浏览器端那些时好时坏的 RSS 代理。

> 本仓库由 GitHub Actions 全自动运行，建好之后**不需要你做任何维护**。

## 一键接入（只需做一次，约 5 分钟）

### 第 1 步：确认你有 GitHub 账号
没有的话去 https://github.com 注册一个（免费）。

### 第 2 步：新建一个公开仓库
1. 打开 https://github.com/new
2. Repository name 填：`autoria-news`
3. 可见性选 **Public**（必须公开，免费 CDN 才能读到）
4. 点 **Create repository**（**不要**勾选任何初始化选项，保持空仓库即可）

### 第 3 步：把本文件夹里的文件推上去
本仓库**已经初始化好 git 并完成首次提交**，你只需要推送到 GitHub。

**方式 A：GitHub Desktop（推荐，图形界面）**
1. 双击运行已下载好的 `GitHubDesktopSetup-x64.exe` 完成安装，打开后用 GitHub 账号登录
2. 菜单 `File → Add local repository…`
3. 选择本文件夹（`news-repo`）→ 点 **Add**
4. 页面出现"Publish repository"（发布仓库）→ 仓库名填 `autoria-news`，勾选公开 → 点 **Publish repository**

**方式 B：命令行（本机已装 Git）**
```
cd "E:\朱\个人\Autoria的工作台\news-repo"
git remote add origin https://github.com/<你的用户名>/autoria-news.git
git push -u origin main
```
> 首次 push 会弹出 GitHub 登录窗口，用浏览器授权即可（命令行会自动打开）。

两种方式任选其一，完成即推送成功。

### 第 4 步：让定时任务跑起来
推上去后 GitHub 会自动运行一次抓取（几分钟内完成）。可以打开仓库页面的 **Actions** 标签查看进度，也可以点 **Run workflow** 手动再跑一次。等 `news.js` 出现在仓库文件列表里，就说明成功了。

> 公开仓库默认允许 Actions 运行。如果 Actions 标签显示被禁用，到 `Settings → Actions → General` 把 **Allow all actions** 打开即可。

### 第 5 步：告诉工作台去读取
把下面的地址发给 Autoria 的工作台维护者（或在工作台里搜索 `USER/REPO` 替换）：

```
https://cdn.jsdelivr.net/gh/<你的用户名>/autoria-news@main/news.js
```

之后每 2 小时自动更新一次，工作台每次打开都会读到最新资讯。

## 换信息源？
打开 `aggregate.js`，找到 `SOURCES` 配置：
- `type: 'rss'`：填 RSS 地址（如 `https://sspai.com/feed`）
- `type: 'api'`：填公开 JSON 接口，并配 `map` 函数把字段映射成 `{title, link, date, img}`

改完推送即可，Actions 会用新源重新生成。

## 常见问题
- **CDN 显示旧数据？** jsDelivr 在仓库有新提交后几分钟内自动生效，最多等 10 分钟。
- **某个栏目一直是空的？** 看仓库 Actions 最新一次运行的日志，会打印每个源的抓取结果（如 `[tech] 40 条`），失败的源会在日志里标出，据此换源即可。
