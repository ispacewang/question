# MSIX 打包 & 微软商店发布指南

## 前置条件

### 1. 安装 Windows 10 SDK
electron-builder 的 appx 目标需要以下工具：
- `makeappx.exe` — 打包 MSIX
- `makepri.exe` — 资源索引
- `signtool.exe` — 代码签名

**安装方式（任选其一）：**
```
# 方式 A：Visual Studio Installer → 勾选 "Windows 10 SDK"
# 方式 B：独立下载 https://developer.microsoft.com/windows/downloads/windows-sdk/

安装后 SDK 默认路径：
C:\Program Files (x86)\Windows Kits\10\bin\<version>\
```

验证安装：
```powershell
where makeappx
# 应输出: C:\Program Files (x86)\Windows Kits\10\bin\...\x64\makeappx.exe
```

### 2. 生成测试证书（本地测试用）

在 Windows PowerShell (管理员) 中运行：
```powershell
New-SelfSignedCertificate -Type Custom `
  -Subject "CN=SelfSigned" `
  -KeyUsage DigitalSignature `
  -FriendlyName "答题小助手测试证书" `
  -CertStoreLocation "Cert:\CurrentUser\My" `
  -TextExtension @("2.5.29.37={text}1.3.6.1.5.5.7.3.3", "2.5.29.19={text}")

# 导出为 .pfx 文件
$cert = Get-ChildItem Cert:\CurrentUser\My | Where-Object { $_.Subject -eq "CN=SelfSigned" }
$cert | Export-PfxCertificate -FilePath ".\test-cert.pfx" -Password (ConvertTo-SecureString -String "password" -Force -AsPlainText)
```

将 `test-cert.pfx` 放到项目根目录，然后更新 package.json 中的 appx 配置：
```json
"appx": {
  ...
  "publisher": "CN=SelfSigned",
  "certificateFile": "test-cert.pfx",
  "certificatePassword": "password"
}
```

### 3. 安装测试证书

双击 `test-cert.pfx` → 本地计算机 → 受信任的根证书颁发机构

或者在 PowerShell（管理员）中：
```powershell
Import-PfxCertificate -FilePath ".\test-cert.pfx" -CertStoreLocation Cert:\LocalMachine\Root -Password (ConvertTo-SecureString -String "password" -Force -AsPlainText)
```

## 打包命令

```bash
# 生成 .msix 文件（输出到 release/）
# 会自动运行 generate_tiles.py → electron-builder → patch_appx_manifest.py
npm run build:msix
```

> ⚠️ `build:msix` 现在会自动执行三步：1) 前端构建 2) APPX 打包 3) 清单补丁（添加 Square71x71Logo / Square310x310Logo）

输出文件：`release/答题小助手_2.5.2_x64.appx`（或 .msix）

## 安装测试

双击 `.appx` / `.msix` 文件即可安装（需先安装证书）。

或在 PowerShell 中：
```powershell
Add-AppxPackage -Path ".\release\答题小助手_2.5.2_x64.appx"
```

## 发布到微软商店

### 第 1 步：注册 Partner Center
1. 访问 https://partner.microsoft.com
2. 注册开发者账号（个人 $19 一次性费用）
3. 完成税务信息

### 第 2 步：保留应用名称
1. Partner Center → Windows & Xbox → 新建应用
2. 保留名称 "答题小助手"（或你的英文名）
3. 获取以下标识：
   - **Publisher ID** (如 `CN=12345678-ABCD-...`)
   - **Publisher Display Name**
   - **Package Identity Name** (如 `12345YourPublisher.AnswerHelper`)

### 第 3 步：更新 package.json

将 appx 配置中的开发占位符替换为 Partner Center 信息：
```json
"build": {
  "appId": "com.ispace.quesora",
  "icon": "frontend/public/icon-512x512.png",
  ...
  "appx": {
    "applicationId": "Quesora",
    "displayName": "Quesora",
    "publisherDisplayName": "<Partner Center 中的发布者显示名称>",
    "publisher": "CN=<Partner Center 中的 Publisher ID>",
    "identityName": "<Partner Center 中的 Package Identity Name>",
    "backgroundColor": "#1c1c1e",
    "showNameOnTiles": true,
    "setBuildNumber": false
  }
}
```

**不需要** certificateFile — 微软商店会自动签名。

> ⚠️ 注意：`build.icon` 必须放在根级别（不是 `win.icon`、也不是 `appx.icon`），electron-builder 24.x 的 appx 目标不认 `appx.icon` 属性。

### 第 3.5 步：准备 Tile 图标（关键！）

**这是最常见的审核拒绝原因**——用了默认 Electron 图标。微软商店要求 tile 图标必须**唯一代表你的产品**，不能使用任何默认/通用图标。

electron-builder 的 appx 目标**不会自动从根级 `icon` 生成 tile 图片**。必须手动放置到 `build/appx/` 目录。

#### 3.5.1 基础图标（最少 6 个）

```
E:\question\build\appx\
├── StoreLogo.png           (50×50)     ← 商店/Settings 图标
├── Square44x44Logo.png     (44×44)     ← 任务栏/应用列表图标
├── Square150x150Logo.png   (150×150)   ← 开始菜单中号磁贴
├── Wide310x150Logo.png     (310×150)   ← 开始菜单宽磁贴
├── Square71x71Logo.png     (71×71)     ← 开始菜单小号磁贴
└── Square310x310Logo.png   (310×310)   ← 开始菜单大号磁贴
```

仅这 6 个图标**可能不够**。Windows 在特定上下文（任务栏分组、Alt+Tab、搜索）需要 **unplated** 变体和 HiDPI 缩放变体，缺少会导致回退到默认图标。

#### 3.5.2 完整图标集（48 个，推荐）

用以下 Python 脚本一次性生成所有需要的图标（基础 + 缩放 + unplated）：

```bash
cd E:\question
python generate_tiles.py
```

`generate_tiles.py`（放在项目根目录）：

```python
from PIL import Image
import os

src = Image.open('frontend/public/icon-512x512.png').convert('RGBA')
os.makedirs('build/appx', exist_ok=True)

# 基础 + 所有尺寸
for name, size in [
    ('StoreLogo.png', (50, 50)),
    ('Square44x44Logo.png', (44, 44)),
    ('Square71x71Logo.png', (71, 71)),
    ('Square89x89Logo.png', (89, 89)),
    ('Square107x107Logo.png', (107, 107)),
    ('Square142x142Logo.png', (142, 142)),
    ('Square150x150Logo.png', (150, 150)),
    ('Square284x284Logo.png', (284, 284)),
    ('Square310x310Logo.png', (310, 310)),
    ('Wide310x150Logo.png', (310, 150)),
]:
    src.resize(size, Image.LANCZOS).save(f'build/appx/{name}')

# HiDPI 缩放变体
scales = [100, 125, 150, 200, 400]
for base, (w, h) in [
    ('StoreLogo', (50, 50)),
    ('Square44x44Logo', (44, 44)),
    ('Square71x71Logo', (71, 71)),
    ('Square150x150Logo', (150, 150)),
    ('Square310x310Logo', (310, 310)),
    ('Wide310x150Logo', (310, 150)),
]:
    for s in scales:
        sw, sh = int(w * s / 100), int(h * s / 100)
        src.resize((sw, sh), Image.LANCZOS).save(f'build/appx/{base}.scale-{s}.png')

# Unplated 变体（任务栏/Search/Alt+Tab 等无背景色上下文）
for name, size in [
    ('Square44x44Logo.targetsize-16_altform-unplated.png', (16, 16)),
    ('Square44x44Logo.targetsize-24_altform-unplated.png', (24, 24)),
    ('Square44x44Logo.targetsize-32_altform-unplated.png', (32, 32)),
    ('Square44x44Logo.targetsize-48_altform-unplated.png', (48, 48)),
    ('Square44x44Logo.targetsize-256_altform-unplated.png', (256, 256)),
    ('Square150x150Logo.targetsize-150_altform-unplated.png', (150, 150)),
    ('Wide310x150Logo.targetsize-310x150_altform-unplated.png', (310, 150)),
    ('Square310x310Logo.targetsize-310_altform-unplated.png', (310, 310)),
]:
    src.resize(size, Image.LANCZOS).save(f'build/appx/{name}')

print(f'✅ 生成了 {len(os.listdir("build/appx"))} 个图标文件')
```

> ⚠️ `build/appx/` 与前端代码无关，建议加入 `.gitignore`。**每次修改源图标后必须重新运行此脚本。**

#### 3.5.3 如果审核仍然被拒

如果重建后仍然收到 10.1.1.11 拒绝，请检查 Partner Center **Store listings（商店一览）**：

1. Partner Center → 你的应用 → **Store listings**
2. 检查 **Store logo（商店徽标）** 部分，确保上传了自定义图标：
   - **1:1 Box art**（300×300 推荐）— 用于商店搜索结果
   - 使用 `frontend/public/icon-300x300.png`
3. 确保**至少上传 1 张截图**（不能用占位图）
4. 如果之前留空，微软会自动填充默认占位图 → 必须替换为自定义图片

### 第 4 步：打包并提交
```bash
yarn build:msix
```
1. Partner Center → 你的应用 → 提交
2. 上传 `release/答题小助手_*.appx`
3. 填写描述、截图、隐私政策等
4. 提交审核（通常 1-3 个工作日）

## 注意事项

- ⚠️ 必须在 **Windows** 上打包（不能在 WSL 中运行 electron-builder --win appx）
- ⚠️ Windows 10 SDK 是必需的（`makeappx.exe`）
- ⚠️ 测试证书只能用于本地测试。发布到商店时删除 `certificateFile` 配置
- ⚠️ `driver.js` 在根 package.json dependencies 中，打包 NSIS 时需要；MSIX 也兼容
- ⚠️ `backgroundMaterial: 'mica'` 是 Windows 11 特性，在 Windows 10 上自动降级
- ⚠️ **Tile 图标**必须手动放 `build/appx/`，否则 electron-builder 回退到默认 Electron 图标 → 商店审核拒绝（见第 3.5 步）
