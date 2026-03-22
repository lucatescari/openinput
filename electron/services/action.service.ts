import { shell, BrowserWindow } from 'electron';
import { exec } from 'child_process';
import * as path from 'path';
import type { ActionConfig } from '../../shared/types/action.types';
import { IPC_CHANNELS } from '../../shared/types/ipc.types';
import { getCommunityPlugin } from '../plugins/plugin-loader';

/**
 * Toggle state for hotkey_switch actions.
 * Keyed by a stable action identity (label or stringified hotkey).
 */
const hotkeyToggleState = new Map<string, boolean>();

/**
 * Execute an action based on its configuration.
 * Dispatches to type-specific handlers.
 */
export async function executeAction(action: ActionConfig): Promise<void> {
  switch (action.type) {
    case 'hotkey':
      await executeHotkey(action);
      break;
    case 'hotkey_switch':
      await executeHotkeySwitch(action);
      break;
    case 'launch_app':
      await executeLaunchApp(action);
      break;
    case 'close_app':
      await executeCloseApp(action);
      break;
    case 'media':
      await executeMedia(action);
      break;
    case 'system':
      await executeSystem(action);
      break;
    case 'open_url':
      await executeOpenUrl(action);
      break;
    case 'open_file':
      await executeOpenFile(action);
      break;
    case 'text':
      await executeText(action);
      break;
    case 'multi_action':
      await executeMultiAction(action);
      break;
    case 'plugin':
      await executePluginAction(action);
      break;
    case 'none':
      break;
  }
}

/** Simulate a keyboard shortcut via osascript (macOS) or xdotool (Linux) */
async function executeHotkey(action: ActionConfig): Promise<void> {
  if (!action.hotkey) return;

  const { modifiers, key } = action.hotkey;

  if (process.platform === 'darwin') {
    // Build osascript keystroke command
    const modParts: string[] = [];
    for (const mod of modifiers) {
      switch (mod.toLowerCase()) {
        case 'command':
        case 'cmd':
        case 'meta':
          modParts.push('command down');
          break;
        case 'control':
        case 'ctrl':
          modParts.push('control down');
          break;
        case 'option':
        case 'alt':
          modParts.push('option down');
          break;
        case 'shift':
          modParts.push('shift down');
          break;
      }
    }

    const usingClause =
      modParts.length > 0 ? ` using {${modParts.join(', ')}}` : '';

    // Use key code for special keys, keystroke for regular keys
    const specialKeys: Record<string, number> = {
      return: 36,
      enter: 36,
      tab: 48,
      space: 49,
      delete: 51,
      backspace: 51,
      escape: 53,
      esc: 53,
      up: 126,
      down: 125,
      left: 123,
      right: 124,
      f1: 122,
      f2: 120,
      f3: 99,
      f4: 118,
      f5: 96,
      f6: 97,
      f7: 98,
      f8: 100,
      f9: 101,
      f10: 109,
      f11: 103,
      f12: 111,
    };

    const keyLower = key.toLowerCase();
    let script: string;
    if (keyLower in specialKeys) {
      script = `tell application "System Events" to key code ${specialKeys[keyLower]}${usingClause}`;
    } else {
      // Escape single quotes in the key
      const escaped = key.replace(/'/g, "'\\''");
      script = `tell application "System Events" to keystroke "${escaped}"${usingClause}`;
    }

    await runCommand(`osascript -e '${script}'`);
  } else if (process.platform === 'linux') {
    // xdotool approach
    const parts: string[] = [];
    for (const mod of modifiers) {
      switch (mod.toLowerCase()) {
        case 'command':
        case 'cmd':
        case 'meta':
          parts.push('super');
          break;
        case 'control':
        case 'ctrl':
          parts.push('ctrl');
          break;
        case 'alt':
        case 'option':
          parts.push('alt');
          break;
        case 'shift':
          parts.push('shift');
          break;
      }
    }
    parts.push(key);
    await runCommand(`xdotool key ${parts.join('+')}`);
  } else if (process.platform === 'win32') {
    // PowerShell SendKeys approach
    const psModMap: Record<string, string> = {
      ctrl: '^',
      control: '^',
      alt: '%',
      option: '%',
      shift: '+',
      command: '^',
      cmd: '^',
      meta: '^',
    };
    let combo = '';
    for (const mod of modifiers) {
      combo += psModMap[mod.toLowerCase()] ?? '';
    }

    const psSpecialKeys: Record<string, string> = {
      enter: '{ENTER}',
      return: '{ENTER}',
      tab: '{TAB}',
      escape: '{ESC}',
      esc: '{ESC}',
      space: ' ',
      delete: '{DELETE}',
      backspace: '{BACKSPACE}',
      up: '{UP}',
      down: '{DOWN}',
      left: '{LEFT}',
      right: '{RIGHT}',
      f1: '{F1}',
      f2: '{F2}',
      f3: '{F3}',
      f4: '{F4}',
      f5: '{F5}',
      f6: '{F6}',
      f7: '{F7}',
      f8: '{F8}',
      f9: '{F9}',
      f10: '{F10}',
      f11: '{F11}',
      f12: '{F12}',
    };

    const keyLower = key.toLowerCase();
    const psKey = psSpecialKeys[keyLower] ?? key;
    combo += psKey;

    await runCommand(
      `powershell -Command "$wsh = New-Object -ComObject WScript.Shell; $wsh.SendKeys('${combo}')"`,
    );
  }
}

/** Toggle between two hotkeys on each press */
async function executeHotkeySwitch(action: ActionConfig): Promise<void> {
  if (!action.hotkey || !action.hotkey2) return;

  // Build a stable key for this switch action
  const stateKey = `${action.hotkey.modifiers.join('+')}+${action.hotkey.key}|${action.hotkey2.modifiers.join('+')}+${action.hotkey2.key}`;
  const useSecond = hotkeyToggleState.get(stateKey) ?? false;

  const hotkey = useSecond ? action.hotkey2 : action.hotkey;
  hotkeyToggleState.set(stateKey, !useSecond);

  await executeHotkey({ ...action, type: 'hotkey', hotkey });
}

/** Launch an application */
async function executeLaunchApp(action: ActionConfig): Promise<void> {
  if (!action.appPath) {
    console.warn('[action] launch_app: no appPath configured');
    notifyUser('No application selected — configure the app path first.', 'error');
    return;
  }
  const error = await shell.openPath(action.appPath);
  if (error) {
    console.error(`[action] launch_app failed: ${error}`);
    notifyUser(`Failed to launch: ${error}`, 'error');
  }
}

/** Close/quit a running application */
async function executeCloseApp(action: ActionConfig): Promise<void> {
  if (!action.appPath) return;

  // Extract app name from path (works with both / and \ separators)
  const appName = path.basename(action.appPath)
    .replace(/\.app$/i, '')
    .replace(/\.exe$/i, '');
  if (!appName) return;

  if (process.platform === 'darwin') {
    // Graceful quit via AppleScript
    await runCommand(
      `osascript -e 'tell application "${appName.replace(/'/g, "'\\''")}" to quit'`,
    );
  } else if (process.platform === 'linux') {
    await runCommand(`pkill -f "${appName}"`);
  } else if (process.platform === 'win32') {
    await runCommand(`taskkill /IM "${appName}.exe" /F`);
  }
}

/** Type out a text string */
async function executeText(action: ActionConfig): Promise<void> {
  if (!action.text) return;

  if (process.platform === 'darwin') {
    // Use osascript to type text — handle special chars by escaping
    const escaped = action.text
      .replace(/\\/g, '\\\\')
      .replace(/"/g, '\\"');
    await runCommand(
      `osascript -e 'tell application "System Events" to keystroke "${escaped}"'`,
    );
  } else if (process.platform === 'linux') {
    // xdotool type with delay for reliability
    const escaped = action.text.replace(/'/g, "'\\''");
    await runCommand(`xdotool type --delay 12 '${escaped}'`);
  } else if (process.platform === 'win32') {
    // PowerShell SendKeys — escape special chars
    const psEscaped = action.text
      .replace(/[+^%~(){}[\]]/g, '{$&}');
    await runCommand(
      `powershell -Command "$wsh = New-Object -ComObject WScript.Shell; $wsh.SendKeys('${psEscaped}')"`,
    );
  }
}

/** Execute a media control key */
async function executeMedia(action: ActionConfig): Promise<void> {
  if (!action.mediaAction) return;

  if (process.platform === 'darwin') {
    // Media key codes for macOS via osascript + NX_KEYTYPE
    const mediaKeys: Record<string, number> = {
      play_pause: 16,
      next_track: 17,
      prev_track: 18,
      volume_up: 0,
      volume_down: 1,
      mute: 7,
    };

    const keyCode = mediaKeys[action.mediaAction];
    if (keyCode === undefined) return;

    if (
      action.mediaAction === 'volume_up' ||
      action.mediaAction === 'volume_down' ||
      action.mediaAction === 'mute'
    ) {
      // Volume keys via osascript
      const volScripts: Record<string, string> = {
        volume_up: 'set volume output volume ((output volume of (get volume settings)) + 6.25)',
        volume_down: 'set volume output volume ((output volume of (get volume settings)) - 6.25)',
        mute: 'set volume output muted (not (output muted of (get volume settings)))',
      };
      try {
        await runCommand(`osascript -e '${volScripts[action.mediaAction]}'`);
      } catch (err) {
        const msg = (err as Error).message ?? '';
        if (msg.includes('missing value')) {
          // macOS reports "missing value" when volume is controlled by an
          // external audio device (e.g. audio interface, mixer).
          notifyUser(
            'Volume is controlled by your external audio device and cannot be changed from software.',
            'error',
          );
        } else {
          throw err;
        }
      }
    } else {
      // Play/pause, next, prev via NX system-defined media key events (JXA)
      const jxa = (nxKey: number) =>
        `osascript -l JavaScript -e '` +
        `ObjC.import("Cocoa");` +
        `var k=${nxKey};` +
        `var d=$.NSEvent.otherEventWithTypeLocationModifierFlagsTimestampWindowNumberContextSubtypeData1Data2(14,{x:0,y:0},0xa00,0,0,null,8,(k<<16)|(0xa<<8),-1);` +
        `$.CGEventPost(0,d.CGEvent);` +
        `var u=$.NSEvent.otherEventWithTypeLocationModifierFlagsTimestampWindowNumberContextSubtypeData1Data2(14,{x:0,y:0},0xb00,0,0,null,8,(k<<16)|(0xb<<8),-1);` +
        `$.CGEventPost(0,u.CGEvent);` +
        `'`;
      await runCommand(jxa(keyCode));
    }
  } else if (process.platform === 'linux') {
    const xdotoolKeys: Record<string, string> = {
      play_pause: 'XF86AudioPlay',
      next_track: 'XF86AudioNext',
      prev_track: 'XF86AudioPrev',
      volume_up: 'XF86AudioRaiseVolume',
      volume_down: 'XF86AudioLowerVolume',
      mute: 'XF86AudioMute',
    };
    const xKey = xdotoolKeys[action.mediaAction];
    if (xKey) {
      await runCommand(`xdotool key ${xKey}`);
    }
  } else if (process.platform === 'win32') {
    // Use PowerShell with .NET SendKeys for media keys and
    // AudioDeviceCmdlets/core audio COM for volume
    const mediaKeyMap: Record<string, string> = {
      play_pause: '0xB3',  // VK_MEDIA_PLAY_PAUSE
      next_track: '0xB0',  // VK_MEDIA_NEXT_TRACK
      prev_track: '0xB1',  // VK_MEDIA_PREV_TRACK
      volume_up: '0xAF',   // VK_VOLUME_UP
      volume_down: '0xAE', // VK_VOLUME_DOWN
      mute: '0xAD',        // VK_VOLUME_MUTE
    };
    const vk = mediaKeyMap[action.mediaAction];
    if (vk) {
      // Use keybd_event via PowerShell to send virtual key codes
      await runCommand(
        `powershell -Command "Add-Type -TypeDefinition 'using System;using System.Runtime.InteropServices;public class K{[DllImport(\\\"user32.dll\\\")]public static extern void keybd_event(byte k,byte s,uint f,UIntPtr e);}'; [K]::keybd_event(${vk},0,0,[UIntPtr]::Zero); [K]::keybd_event(${vk},0,2,[UIntPtr]::Zero)"`,
      );
    }
  }
}

/** Execute a system action */
async function executeSystem(action: ActionConfig): Promise<void> {
  if (!action.systemAction) return;

  if (process.platform === 'darwin') {
    if (action.systemAction === 'brightness_up') {
      await runCommand(
        `osascript -e 'tell application "System Events" to key code 144'`,
      );
    } else if (action.systemAction === 'brightness_down') {
      await runCommand(
        `osascript -e 'tell application "System Events" to key code 145'`,
      );
    }
  } else if (process.platform === 'win32') {
    // Windows: adjust brightness via WMI
    if (action.systemAction === 'brightness_up') {
      await runCommand(
        `powershell -Command "$b=(Get-CimInstance -Namespace root/WMI -ClassName WmiMonitorBrightness).CurrentBrightness; $n=[Math]::Min(100,$b+10); (Get-CimInstance -Namespace root/WMI -ClassName WmiMonitorBrightnessMethods).WmiSetBrightness(1,$n)"`,
      );
    } else if (action.systemAction === 'brightness_down') {
      await runCommand(
        `powershell -Command "$b=(Get-CimInstance -Namespace root/WMI -ClassName WmiMonitorBrightness).CurrentBrightness; $n=[Math]::Max(0,$b-10); (Get-CimInstance -Namespace root/WMI -ClassName WmiMonitorBrightnessMethods).WmiSetBrightness(1,$n)"`,
      );
    }
  } else if (process.platform === 'linux') {
    // Linux: use xdotool to send brightness keys
    if (action.systemAction === 'brightness_up') {
      await runCommand('xdotool key XF86MonBrightnessUp');
    } else if (action.systemAction === 'brightness_down') {
      await runCommand('xdotool key XF86MonBrightnessDown');
    }
  }
}

/** Open a URL in the default browser */
async function executeOpenUrl(action: ActionConfig): Promise<void> {
  if (!action.url) {
    console.warn('[action] open_url: no URL configured');
    notifyUser('No URL configured — enter a URL first.', 'error');
    return;
  }

  // Auto-prepend https:// if no protocol provided
  let urlStr = action.url;
  if (!/^https?:\/\//i.test(urlStr)) {
    urlStr = `https://${urlStr}`;
  }

  try {
    const parsed = new URL(urlStr);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
      await shell.openExternal(urlStr);
    } else {
      notifyUser(`Invalid URL protocol: ${parsed.protocol}`, 'error');
    }
  } catch {
    console.error(`[action] open_url: invalid URL "${action.url}"`);
    notifyUser(`Invalid URL: ${action.url}`, 'error');
  }
}

/** Open a file with the default application */
async function executeOpenFile(action: ActionConfig): Promise<void> {
  if (!action.filePath) {
    console.warn('[action] open_file: no filePath configured');
    notifyUser('No file selected — configure the file path first.', 'error');
    return;
  }
  const error = await shell.openPath(action.filePath);
  if (error) {
    console.error(`[action] open_file failed: ${error}`);
    notifyUser(`Failed to open file: ${error}`, 'error');
  }
}

/** Execute multiple actions in sequence with optional delay */
async function executeMultiAction(action: ActionConfig): Promise<void> {
  if (!action.actions) return;
  for (const subAction of action.actions) {
    await executeAction(subAction);
    if (action.delayMs && action.delayMs > 0) {
      await sleep(action.delayMs);
    }
  }
}

function runCommand(cmd: string): Promise<string> {
  return new Promise((resolve, reject) => {
    exec(cmd, { timeout: 5000 }, (error, stdout, stderr) => {
      if (error) {
        reject(error);
      } else {
        resolve(stdout);
      }
    });
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Execute a community plugin action by delegating to its execute() handler. */
async function executePluginAction(action: ActionConfig): Promise<void> {
  if (!action.pluginId || !action.pluginActionId) {
    console.warn('[action] plugin: missing pluginId or pluginActionId');
    return;
  }

  const plugin = getCommunityPlugin(action.pluginId);
  if (!plugin) {
    notifyUser(`Plugin "${action.pluginId}" is not installed`, 'error');
    return;
  }

  if (!plugin.execute) {
    console.warn(`[action] plugin "${action.pluginId}" has no execute handler`);
    return;
  }

  try {
    await plugin.execute(action.pluginActionId, action as unknown as Record<string, unknown>);
  } catch (err) {
    console.error(`[action] plugin "${action.pluginId}" action "${action.pluginActionId}" failed:`, err);
    notifyUser(`Plugin action failed: ${(err as Error).message}`, 'error');
  }
}

/**
 * Send a toast notification to the renderer process.
 * Uses BrowserWindow.getAllWindows() to avoid circular imports with main.ts.
 */
function notifyUser(message: string, type: 'success' | 'error' | 'info'): void {
  const win = BrowserWindow.getAllWindows()[0];
  if (win) {
    win.webContents.send(IPC_CHANNELS.NOTIFY_TOAST, { message, type });
  }
}
