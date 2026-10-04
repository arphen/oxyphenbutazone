# Testing on real phones

The automated tests use desktop Chromium. These checks need real devices (the weakest points are iPhone Safari,
local-network discovery and screen locking). Please note what happens at each step.

1. **Install** (both phones, online): open the site, add it to the Home Screen, open it from the icon. Turn on airplane
   mode and reopen it: it should still start. *Report: does it start offline on iPhone? on Android?*
2. **Same network** (one phone's hotspot or the same Wi-Fi, no internet): Host on one phone, Join on the other with
   **copy/paste first** (e.g. AirDrop/Notes/messenger), then with **QR scanning**. *Report: which direction connected;
   how long it took; any error text.*
3. **Camera**: does the in-app scanner focus on the QR from about 20–30 cm? does the invite QR scan with the native camera?
4. **Play**: place tiles, play a word, pass, exchange. *Report anything slow, fiddly or wrong.*
5. **Lock the host's screen for 30 s**, unlock: does the game recover? (Wake Lock should prevent locking while hosting.)
6. **Close and reopen the host app** mid-game: *Continue it*, invite again, guest rejoins: is the game intact?
7. **Remote (optional)**: one phone on Wi-Fi, one on 5G, tick *different networks*. It may fail behind carrier NAT.
