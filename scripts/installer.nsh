/**
 * scripts/installer.nsh — NSIS 自定义安装脚本
 * 添加 AI 模型选择页面，包含资源占用提示
 *
 * 集成方式: electron-builder 的 nsis.include
 */

!include nsDialogs.nsh
!include LogicLib.nsh

Var Dialog
Var Checkbox_Model05B
Var Checkbox_Model15B
Var Checkbox_Model05B_State
Var Checkbox_Model15B_State
Var Label_Title
Var Label_Desc
Var Label_Model05B_Info
Var Label_Model15B_Info

; 模型选择页面
Page custom ModelSelectionPage ModelSelectionLeave

Function ModelSelectionPage
  ; 默认都选中
  StrCpy $Checkbox_Model05B_State ${BST_CHECKED}
  StrCpy $Checkbox_Model15B_State ${BST_CHECKED}

  nsDialogs::Create 1018
  Pop $Dialog
  ${If} $Dialog == error
    Abort
  ${EndIf}

  ; ── 标题 ──
  ${NSD_CreateLabel} 0 0 100% 20u "🤖 AI 模型选择"
  Pop $Label_Title
  CreateFont $0 "$(^Font)" "12" "700"
  SendMessage $Label_Title ${WM_SETFONT} $0 0

  ${NSD_CreateLabel} 0 25u 100% 30u "选择要安装的 AI 答题助手模型。未选中的模型可在应用内在线下载。"
  Pop $Label_Desc

  ; ── 0.5B 轻量版 ──
  ${NSD_CreateCheckbox} 0 65u 100% 14u "🟢 轻量版 Qwen2.5 0.5B — 推荐低配机器"
  Pop $Checkbox_Model05B
  ${NSD_SetState} $Checkbox_Model05B $Checkbox_Model05B_State

  ${NSD_CreateLabel} 20u 82u 90% 30u "   💾 磁盘: ~510 MB  |  🧠 内存: 1.0-1.5 GB$\n   ⚡ 速度: 快 (10-20 tokens/s)  |  基础中文答疑"
  Pop $Label_Model05B_Info

  ; ── 1.5B 标准版 ──
  ${NSD_CreateCheckbox} 0 120u 100% 14u "🟡 标准版 Qwen2.5 1.5B — 推荐，回答质量更好"
  Pop $Checkbox_Model15B
  ${NSD_SetState} $Checkbox_Model15B $Checkbox_Model15B_State

  ${NSD_CreateLabel} 20u 137u 90% 30u "   💾 磁盘: ~1.25 GB  |  🧠 内存: 2.5-3.5 GB$\n   ⚡ 速度: 中等 (5-10 tokens/s)  |  良好中文答疑"
  Pop $Label_Model15B_Info

  ; ── 提醒 ──
  ${NSD_CreateLabel} 0 180u 100% 24u "⚠ 模型文件较大，安装包体积会相应增加。$\n   未选中的模型可在应用内通过「设置 → AI 模型」在线下载。"
  Pop $0

  nsDialogs::Show
FunctionEnd

Function ModelSelectionLeave
  ${NSD_GetState} $Checkbox_Model05B $Checkbox_Model05B_State
  ${NSD_GetState} $Checkbox_Model15B $Checkbox_Model15B_State

  ; 至少选一个
  ${If} $Checkbox_Model05B_State != ${BST_CHECKED}
  ${AndIf} $Checkbox_Model15B_State != ${BST_CHECKED}
    MessageBox MB_OK|MB_ICONEXCLAMATION "请至少选择一个 AI 模型，否则 AI 答疑功能将不可用。"
    Abort
  ${EndIf}
FunctionEnd

; ══════════════════════════════════════════
; 安装完成后写入选中的模型配置
; ══════════════════════════════════════════
!macro writeModelConfig
  ; 写入 installed_models.json 到安装目录
  FileOpen $0 "$INSTDIR\installed_models.json" w
  FileWrite $0 "{$\n"
  ${If} $Checkbox_Model05B_State == ${BST_CHECKED}
    FileWrite $0 '  "0.5B": true,$\n'
  ${Else}
    FileWrite $0 '  "0.5B": false,$\n'
  ${EndIf}
  ${If} $Checkbox_Model15B_State == ${BST_CHECKED}
    FileWrite $0 '  "1.5B": true$\n'
  ${Else}
    FileWrite $0 '  "1.5B": false$\n'
  ${EndIf}
  FileWrite $0 "}$\n"
  FileClose $0
!macroend

; 在安装完成前写入配置
!macro customInstall
  !insertmacro writeModelConfig
!macroend
