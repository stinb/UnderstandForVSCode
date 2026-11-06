# Screenshot of one window only (by process name and title fragment), brought to
# the front first, so nothing else on the desktop is captured.
param([string]$ProcessName = 'Code', [string]$TitlePart = '', [string]$Out = 'C:\tests\userver742Output\shot.png')
Add-Type -AssemblyName System.Drawing
Add-Type @"
using System; using System.Runtime.InteropServices;
public class W {
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h, out R r);
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr h, int cmd);
  public struct R { public int L, T, Rt, B; }
}
"@
$p = Get-Process $ProcessName -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowHandle -ne 0 -and ($TitlePart -eq '' -or $_.MainWindowTitle -like "*$TitlePart*") } | Select-Object -First 1
if (-not $p) { "no window for $ProcessName '$TitlePart'"; exit 1 }
[W]::ShowWindow($p.MainWindowHandle, 9) | Out-Null   # restore if minimized
[W]::SetForegroundWindow($p.MainWindowHandle) | Out-Null
Start-Sleep -Milliseconds 800
$r = New-Object W+R
[W]::GetWindowRect($p.MainWindowHandle, [ref]$r) | Out-Null
$w = $r.Rt - $r.L; $h = $r.B - $r.T
$bmp = New-Object System.Drawing.Bitmap $w, $h
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.CopyFromScreen($r.L, $r.T, 0, 0, $bmp.Size)
$bmp.Save($Out, [System.Drawing.Imaging.ImageFormat]::Png)
"saved $Out ($w x $h) title: $($p.MainWindowTitle)"
