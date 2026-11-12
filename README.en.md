# Stethos

English | [日本語](./README.md)

> No install needed. Read live vehicle data from BLE OBD2 adapters right in your browser via Web Bluetooth.

**Stethos** reads your car's status in your phone's browser from a BLE (Bluetooth 5.1) adapter plugged into the car's OBD-II port. No app install needed — just open the URL.

**Open the app: <https://s1v.github.io/Stethos/>**

---

## Features
- **Home**: vehicle (estimated make/model year, VIN) and "Car status" (trouble codes, check engine light, battery, coolant temperature) at a glance, plus mini gauges for speed, RPM, coolant temperature and voltage
- **Status**: real-time display of the items your car supports (up to 184 items — speed, RPM, coolant, boost, fuel, emissions, odometer, etc.) by category. Only the selected category is fetched. Tap an item for its description; units such as °C/°F and kPa/bar/psi can be switched. Battery items (12V battery voltage, estimated charge with the engine off, alternator charging check, hybrid battery level on supported cars) are also here
- **My page**: build your own screens with any status items in any position, including gauges and graphs (multiple presets, saved on the device)
- **Settings**: language, multi-PID communication on/off, status text size (S/M/L), reset My page
- **Diagnostics**: list of trouble codes (DTCs) with descriptions, clearing codes
- **Language**: switch between 日本語 / English on the top screen and in Settings (chosen from your browser language on first launch)

## What you need
| Item | Requirement |
|---|---|
| Car | OBD-II compliant vehicle |
| Adapter | **ELM327-compatible BLE (Bluetooth Low Energy) adapter** |
| Phone / PC | See "Supported browsers" below |

> Bluetooth Classic and Wi-Fi adapters do not work. Look for "BLE", "Bluetooth 4.0 or later" or "iPhone compatible" in the product description.

### Supported browsers
| Device | Browser |
|---|---|
| Android | **Chrome** (Edge / Samsung Internet also OK) |
| iPhone / iPad | **Bluefy** (free on the App Store) * Safari and Chrome for iOS do not work |
| PC | Chrome / Edge |

## How to use
1. Plug the adapter into the car's OBD port (usually under the driver's side dashboard)
2. Turn the engine (ignition) ON
3. Close other OBD apps (an adapter connects to only one app at a time)
4. Open Stethos and press "**Connect**"
5. Select your adapter (named "OBDII", "OBDBLE", etc.) from the list

### Add to Home screen
- Android (Chrome): menu → "Add to Home screen"
- It then runs full-screen like an app and can start offline

### If the "Enter UUID" screen appears
Your adapter isn't registered in the app. Follow the on-screen guide to enter the adapter's "service UUID" (you can find it with the free app "nRF Connect"). Once a connection succeeds it is saved, so **you won't need to enter it again**.

## Troubleshooting
| Symptom | What to check |
|---|---|
| "This browser does not support…" | Use Chrome on Android or Bluefy on iPhone |
| Adapter doesn't appear in the list | Ignition ON? Is another app connected to the adapter? Are Bluetooth and Location (Android) on? |
| "No response from ELM327" | You may have selected a device that isn't ELM327-compatible |
| "No response from the vehicle" | Is the ignition ON? Is the adapter fully inserted? |
| Few status items | Unsupported items are grouped under "Items this car does not support" (supported items vary by car) |
| Status updates slowly | Adapters are slow (several to a dozen-odd items per second). Turning on multi-PID in Settings may help |
| Connection drops | Turning off the screen or switching apps disconnects |

## Safety & notes
- **Do not operate the screen while driving.** Let a passenger check it.
- Cleared trouble codes will come back if the cause isn't fixed. Clearing right before an inspection is not recommended.
- Generic OBD mainly reads engine (emission-related) information. Not all faults can be detected.
- Battery wear (life) cannot be measured via OBD. Displayed charge and charging status are estimates from voltage.
- This app comes with no warranty. Use the information for reference only.
- Some text may still appear in Japanese if a translation is missing. Reports are welcome.

## Privacy
- Data read from your car is **processed only on your device** and never sent elsewhere.
- The only exception: when you press "Look up model" on Home, the VIN is sent to the public service of the US NHTSA.
- Only UUIDs of adapters that connected successfully, looked-up vehicle info, your settings and My page layout are stored in your browser.

## Adapter & bug reports
- If your adapter connected successfully, please report it. Press "**Report this adapter**" in "UUID management" or "Settings" to open a GitHub report form with the UUID filled in. You can also write one directly via [**Adapter report**](https://github.com/s1v/Stethos/issues/new?template=adapter-report.yml). After review it will be registered so others can connect without input.
- For bugs, use [**Bug report**](https://github.com/s1v/Stethos/issues/new?template=bug-report.yml). Reports in English are welcome.

---
"ELM327" is a product name of ELM Electronics. This app supports "ELM327-compatible" adapters.
For developer information see [docs/SPEC.md](./docs/SPEC.md) (Japanese).
