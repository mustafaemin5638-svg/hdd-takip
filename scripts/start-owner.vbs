' Sessiz yönetici başlatıcı — CMD yok. Kısa yollarla Türkçe klasör sorununu aşar.
Option Explicit
Dim fso, sh, root, scriptDir, nodeExe, mjs, cmd
Set fso = CreateObject("Scripting.FileSystemObject")
Set sh = CreateObject("WScript.Shell")
scriptDir = fso.GetParentFolderName(WScript.ScriptFullName)
root = fso.GetParentFolderName(scriptDir)
sh.CurrentDirectory = root
mjs = root & "\scripts\start-owner.mjs"
nodeExe = "node"
On Error Resume Next
' Tam yol varsa kullan (PATH sorunlarında)
If fso.FileExists("C:\Program Files\nodejs\node.exe") Then
  nodeExe = "C:\Program Files\nodejs\node.exe"
ElseIf fso.FileExists("C:\Program Files (x86)\nodejs\node.exe") Then
  nodeExe = "C:\Program Files (x86)\nodejs\node.exe"
End If
On Error GoTo 0
cmd = """" & nodeExe & """ """ & mjs & """"
' 0 = gizli pencere, False = bekleme
sh.Run cmd, 0, False
