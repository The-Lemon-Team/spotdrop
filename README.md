# 🎵 SpotDrop

<p align="center">
  <strong>Your music didn’t die with your subscription. Turn your Spotify JSON export into a living, free music streaming player in seconds.</strong>
</p>

<p align="center">
  <a href="#-quick-start">🚀 Quick Start</a> •
  <a href="#-how-it-works">⚡ How It Works</a> •
  <a href="#-get-your-spotify-export">📥 Get Spotify Export</a> •
  <a href="#-features">✨ Features</a> •
  <a href="#-self-hosting">🐳 Docker</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Spotify_Export-Drop_%26_Play-1ED760?style=for-the-badge&logo=spotify&logoColor=white" alt="Spotify Export" />
  <img src="https://img.shields.io/badge/Zero_API_Keys-No_Dev_Account-FF0000?style=for-the-badge&logo=youtube" alt="Zero API Keys" />
  <img src="https://img.shields.io/badge/Privacy-100%25_Client--Side-00E5FF?style=for-the-badge" alt="Privacy" />
  <img src="https://img.shields.io/badge/License-MIT-green?style=for-the-badge" alt="MIT License" />
</p>

---

## 💡 The Problem

When you download your personal data from Spotify (via GDPR / Privacy settings), you receive a `.zip` archive containing:
- `YourLibrary.json` — all your liked tracks and albums.
- `Playlist1.json` — all your carefully curated playlists.

**The catch?** You can't play them. They are just static text files. If your subscription ended, your region got restricted, or you simply want to own your music library, those files are usually left useless on your drive.

## 🚀 The Solution: SpotDrop

**SpotDrop turns static Spotify JSON files into a rich, interactive, cloud-free streaming player.**

Simply drag and drop your `YourLibrary.json` or `Playlist1.json` onto SpotDrop. It autonomously matches every track against high-quality audio streams in real-time — **no Spotify Premium, no Spotify API credentials, and no Google API keys required.**

```text
[ Spotify JSON Export ] ──( Drag & Drop )──► [ SpotDrop ] ──► [ Instant Free Music Player ]
                                                      │
                                                      └──► Shareable URL for your friends!
```

---

## ✨ Why SpotDrop?

| Feature | SpotDrop | Other Spotify Clients |
| :--- | :---: | :---: |
| **Active Spotify Premium Needed?** | ❌ **No (Free forever)** | ⚠️ Often Required |
| **API Keys / Developer Accounts?** | ❌ **Zero setup** | ⚠️ Complex Google/Spotify setup |
| **Setup Time** | ⚡ **5 seconds (Drag & Drop)** | ⏱️ 15–30 minutes |
| **Personal Shareable Link** | ✅ **Yes (`/p/:your-id`)** | ❌ Rare |
| **Privacy & Local Database** | ✅ **100% Client-Side (IndexedDB)** | ⚠️ Cloud logins |
| **Custom Version Picker (Live/Acoustic)**| ✅ **Yes (Pin preferred versions)**| ❌ Fixed streams |

---

## ⚡ Key Features

* 📂 **Drop & Play:** Instant onboarding. Drop your Spotify JSON files directly in the browser and start listening immediately.
* 🔗 **Unique Shareable URLs:** Every dropped export generates an isolated, independent SpotDrop library. Share your link with friends so they can listen to your curated playlists too.
* 🎯 **Autonomous Track Matching:** High-accuracy engine finds the optimal audio version on the fly.
* 🎛️ **Version Picker (Pin Any Track):** Prefer an acoustic version, a legendary live concert, or a specific studio mix? Pick and pin your preferred audio track with one click.
* 🏷️ **Smart Tags & Playlists:** Automatically converts your Spotify playlist names into searchable tags (`#rock`, `#favorites`, `#chill`).
* 🔒 **Zero Telemetry & Absolute Privacy:** Your listening habits and personal JSON stay in your browser. No third-party accounts, no tracking.

---

## 📥 How to Get Your Spotify Export in 4 Steps

1. Go to your **[Spotify Account Privacy Page](https://www.spotify.com/account/privacy/)**.
2. Scroll down to **"Download your data"** and request your account data.
3. In a few days, Spotify will email you a `.zip` link containing `YourLibrary.json` and `Playlist1.json`.
4. Open **SpotDrop** $\rightarrow$ Drop the files $\rightarrow$ Enjoy your music!

---

## 🐳 Quick Start & Self-Hosting

### Run with Docker (Recommended)
```bash
docker run -d \
  -p 3001:3001 \
  --name spotdrop \
  ghcr.io/the-lemon-team/spotdrop:latest
```
Open `http://localhost:3001` in your browser.

### Run with Node.js
```bash
# Clone the repository
git clone git@github.com:The-Lemon-Team/spotdrop.git
cd spotdrop/web

# Install dependencies and start
npm install
npm run build
npm start
```

---

## 🗺️ Roadmap

- [x] Spotify JSON Export Parser (`YourLibrary.json` & `Playlist1.json`)
- [x] Client-Side YouTube Audio Stream Matching
- [x] Unique Shareable Profile URLs (`/p/:id`)
- [x] Version Picker & Pinning
- [ ] Direct export to portable YouTube playlist format (without Google API key)
- [ ] PWA offline support for mobile browsers

---

## 📄 License

MIT © [The Lemon Team](https://github.com/The-Lemon-Team)
