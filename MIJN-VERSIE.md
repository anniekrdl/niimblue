# Mijn versie van NiimBlue

Eigen aanpassingen bovenop [MultiMote/niimblue](https://github.com/MultiMote/niimblue), op branch `redesign`.

## Wat is er anders

- **Vaste layout**: alleen de sticker zoomt (knijpen, ctrl + scrollen of de zoomknoppen), alle knoppen blijven op hun plek.
- **Grotere knoppen met labels**, een toevoegbalk onderaan (Tekst, Icoon, Afbeelding, Vorm, QR, Barcode, Meer).
  Op de telefoon openen menu's als paneel van onderen.
- **Templates**: standaardtemplates die zich aanpassen aan het labelformaat, en je eigen ontwerp opslaan als template.
- **Icons**: meerdere SVG/PNG/JPG-bestanden tegelijk toevoegen (of slepen), ze blijven bewaard.
- **Google Fonts**: zoeken en kiezen via het lettertypemenu. Het font wordt opgeslagen, dus werkt daarna ook offline.
- **Nederlandse vertaling** (taal kiezen via het ⋮-menu rechtsboven).
- **Android-app** met eigen app-ID `nl.anniek.niimblue`, naast de officiële NiimBlues-app te installeren.

Alle bestaande functies zijn er nog: undo/redo en raster staan nu op het tekenvlak, taal/versie/debug in het ⋮-menu.

## Ontwikkelen

```
npm install
npm run dev
```

Open het adres uit de terminal in Chrome of Edge.

## Android-app bouwen

Nodig: Android SDK en JDK 21.

```
cd standalone-apps/capacitor
npm install
npm run build-www
npx cap sync android
cd android
$env:JAVA_HOME = "C:\Program Files\Java\jdk-21.0.11"   # PowerShell
.\gradlew.bat assembleDebug
```

De app staat dan in `standalone-apps/capacitor/android/app/build/outputs/apk/debug/app-debug.apk`.

### Installeren op de telefoon

- **Via USB**: zet op de telefoon *Ontwikkelaarsopties → USB-foutopsporing* aan, sluit aan en run
  `adb install -r app-debug.apk`.
- **Zonder kabel**: zet de apk op Google Drive of stuur hem naar jezelf, open hem op de telefoon en sta
  *Installeren van onbekende apps* toe voor die app.

## Updates van de maker binnenhalen

```
git switch main
git pull upstream main
git push origin main
git switch redesign
git merge main
```

Bij een merge-conflict: de meeste aanpassingen zitten in `LabelDesigner.svelte`, `MainPage.svelte` en
`styles/style.scss`. Nieuwe bestanden (templates, Google Fonts, icon-import) botsen niet.
