# Device Protocol Reference

The AJAZZ AKP05 communicates over USB HID using a custom "CRT" protocol. This document covers the protocol details for contributors working on the Electron main process.

## Device Identification

| Property | Value |
|---|---|
| Vendor ID | `0x0300` |
| Product ID (AKP05) | `0x3006` |
| Product ID (AKP05E) | `0x3004` |
| Product ID (AKP05E Pro) | `0x3013` |
| HID Usage Page | `0xFFA0` |

## Hardware Layout

```
┌─────────────────────────────────────────────────┐
│                                                 │
│    [Key 0] [Key 1] [Key 2] [Key 3] [Key 4]      │
│                                                 │
│    [Key 5] [Key 6] [Key 7] [Key 8] [Key 9]      │
│                                                 │
│  ┌──────────┬──────────┬──────────┬──────────┐  │
│  │ Zone 0   │  Zone 1  │  Zone 2  │  Zone 3. │  │
│  └──────────┴──────────┴──────────┴──────────┘  │
│                   Touch Strip                   │
│                                                 │
│     [Enc 0] [Enc 1] [Enc 2] [Enc 3] [Enc 4]     │
└─────────────────────────────────────────────────┘
```

- **10 LCD keys:** 112x112px each, 2 rows x 5 columns
- **4 rotary encoders:** Clockwise/counter-clockwise rotation + press button
- **1 touch strip:** 4 zones (176x112px each) + left/right swipe gestures

## Report Format

### Output reports (host -> device)

- Total size: **1025 bytes** (1 byte report ID + 1024 bytes data)
- Report ID: `0x00`
- Protocol prefix: `CRT\x00\x00` (bytes `0x43 0x52 0x54 0x00 0x00`)

```
Byte 0:    0x00 (report ID)
Bytes 1-5: 0x43 0x52 0x54 0x00 0x00 (CRT prefix)
Bytes 6+:  Command + arguments
Bytes N+:  Zero-padded to 1024 bytes
```

### Input reports (device -> host)

- Total size: **513 bytes**
- Event control ID at byte offset **9**
- State at byte offset **10** (`0x01` = pressed/active, `0x00` = released)

## Commands

### CONNECT (Heartbeat)

Keep the connection alive. Send every ~10 seconds.

```
Command bytes: 0x43 0x4F 0x4E 0x4E 0x45 0x43 0x54
ASCII:         C    O    N    N    E    C    T
```

### DIS (Wake Screen)

Initialize/wake the device display.

```
Command bytes: 0x44 0x49 0x53
ASCII:         D    I    S
```

### LIG (Set Brightness)

Set LCD brightness level (0-100).

```
Command bytes: 0x4C 0x49 0x47
Arguments:     0x00 0x00 <level>
```

Where `<level>` is 0-100.

### CLE (Clear Key)

Clear the image on a specific key or all keys.

```
Command bytes: 0x43 0x4C 0x45
Arguments:     0x00 0x00 0x00 <output_id>
```

Use `0xFF` as output_id to clear all keys and touch zones.

### BAT (Image Transfer)

Announce an image transfer to a specific output.

```
Command bytes: 0x42 0x41 0x54
Arguments:     <size_byte_0> <size_byte_1> <size_byte_2> <size_byte_3> <output_id>
```

Size is a 4-byte big-endian integer (the JPEG data length). After sending BAT, transmit the JPEG data in sequential 1024-byte chunks (each prefixed with report ID `0x00`). Follow with STP to flush.

### STP (Refresh/Flush)

Commit pending image changes to the display.

```
Command bytes: 0x53 0x54 0x50
ASCII:         S    T    P
```

### HAN (Sleep)

Put the device display to sleep.

```
Command bytes: 0x48 0x41 0x4E
ASCII:         H    A    N
```

## Image Transfer Flow

To display a JPEG on a key or touch zone:

1. Process the image: resize to target dimensions, rotate 180 degrees, encode as JPEG
2. Send **BAT** command with JPEG size and output ID
3. Send JPEG data in 1024-byte chunks (report ID `0x00` + 1024 data bytes)
4. Send **STP** to flush

### Image specifications

| Element | Width | Height | Format | Rotation |
|---|---|---|---|---|
| LCD Key | 112px | 112px | JPEG | 180 deg |
| Touch Zone | 176px | 112px | JPEG | 180 deg |

Images must be rotated 180 degrees before sending -- the display hardware renders them upside-down.

## Output ID Mapping

### LCD Keys

Keys use different IDs for input (reading presses) vs output (writing images):

| Key Index | Input ID | Output ID |
|---|---|---|
| 0 (top-left) | `0x01` | `0x0B` |
| 1 | `0x02` | `0x0C` |
| 2 | `0x03` | `0x0D` |
| 3 | `0x04` | `0x0E` |
| 4 (top-right) | `0x05` | `0x0F` |
| 5 (bottom-left) | `0x06` | `0x06` |
| 6 | `0x07` | `0x07` |
| 7 | `0x08` | `0x08` |
| 8 | `0x09` | `0x09` |
| 9 (bottom-right) | `0x0A` | `0x0A` |

### Touch Strip Zones

| Zone Index | Input ID | Output ID |
|---|---|---|
| 0 (leftmost) | `0x40` | `0x01` |
| 1 | `0x41` | `0x02` |
| 2 | `0x42` | `0x03` |
| 3 (rightmost) | `0x43` | `0x04` |

## Input Event Mapping

### Key Events

Input IDs `0x01`-`0x0A` map to keys 0-9. State `0x01` = key down, `0x00` = key up.

### Encoder Events

| Input ID | Encoder | Direction |
|---|---|---|
| `0xA0` | 0 | CCW |
| `0xA1` | 0 | CW |
| `0x37` | 0 | Press |
| `0x50` | 1 | CCW |
| `0x51` | 1 | CW |
| `0x35` | 1 | Press |
| `0x90` | 2 | CCW |
| `0x91` | 2 | CW |
| `0x33` | 2 | Press |
| `0x70` | 3 | CCW |
| `0x71` | 3 | CW |
| `0x36` | 3 | Press |

Encoder rotation events fire once per detent. Press events use state `0x01`/`0x00` for press/release.

### Touch Events

Touch zone IDs `0x40`-`0x43` map to zones 0-3. State `0x01` = press, `0x00` = release.

### Swipe Gestures

| Input ID | Direction |
|---|---|
| `0x38` | Swipe Left |
| `0x39` | Swipe Right |

## Connection Lifecycle

1. **Discover** -- Enumerate HID devices matching VID `0x0300` and usage page `0xFFA0`
2. **Open** -- Open the HID device by path
3. **Wake** -- Send DIS command to initialize display
4. **Heartbeat** -- Send CONNECT command every ~10 seconds to keep connection alive
5. **Configure** -- Send images and listen for input events
6. **Disconnect** -- Stop heartbeat, close HID device

If the heartbeat stops, the device will eventually reset its display.
