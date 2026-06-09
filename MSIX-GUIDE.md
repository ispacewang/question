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
yarn build:msix

# 或
npm run build:msix
```

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
"appx": {
  "applicationId": "answer-helper",
  "displayName": "答题小助手",
  "publisherDisplayName": "<Partner Center 中的发布者显示名称>",
  "publisher": "CN=<Partner Center 中的 Publisher ID>",
  "identityName": "<Partner Center 中的 Package Identity Name>",
  "backgroundColor": "#1c1c1e",
  "showNameOnTiles": true,
  "setBuildNumber": false
}
```

**不需要** certificateFile — 微软商店会自动签名。

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
