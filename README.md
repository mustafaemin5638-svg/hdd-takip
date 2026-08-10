# HDD TAKİP

Windows masaüstü uygulaması: disk S/N, boyut, depolama ve kime satıldığını takip eder. Yeni sürüm GitHub Releases üzerinden diğer PC'lere otomatik gelir.

## Kurulum (diğer PC'ler)

1. Senden gelen `HDD-TAKIP-Setup-x.y.z.exe` dosyasını çalıştır.
2. Masaüstü / Başlat menüsünden **HDD TAKIP** aç.
3. GitHub kurmana gerek yok; internet yeterli.

Güncelleme gelince üstte **Yeni sürüm mevcut** çıkar → **Güncelle** → bitince **Yeniden Başlat**.

## Geliştirme (senin PC)

```bash
npm install
npm run electron:dev
```

Sadece tarayıcıda denemek için: `npm run dev` → http://localhost:5173

## .exe üret (yayınlamadan)

```bash
npm run dist
```

Çıktı: `C:\hdd-takip-release\HDD-TAKIP-Setup-1.0.0.exe`

## GitHub otomatik güncelleme

Repo: https://github.com/mustafaemin5638-svg/hdd-takip  
İlk sürüm: https://github.com/mustafaemin5638-svg/hdd-takip/releases/tag/v1.0.0

Yeni özellik onaylanınca yayınlamak için (GitHub CLI girişliyken):

```powershell
npm run release
```

Bu komut sürümü yükseltir (1.0.0 → 1.0.1), `.exe` üretir ve GitHub Release'e yükler. Diğer PC'lerdeki uygulama **Yeni sürüm mevcut** der.

İsteğe bağlı sürüm tipi:

```bash
node scripts/release.mjs patch
node scripts/release.mjs minor
node scripts/release.mjs major
node scripts/release.mjs 1.2.0
```

## Özellikler

- Stoğa ekle: S/N, boyut (2.5" / 3.5"), depolama, tarih (Gün/Ay/Yıl)
- Satış: S/N + kime verildi + tarih
- Sorgulama: S/N ile stok / satış / alıcı
- Liste: stokta / satılan filtre
- Otomatik güncelleme (paketli `.exe` + GitHub Release)

## Notlar

- Stok verisi her PC'de yerel tutulur (senkron yok).
- İlk kurulumda Windows SmartScreen uyarısı çıkabilir (kod imzası yoksa): **Ek bilgi → Yine de çalıştır**.
