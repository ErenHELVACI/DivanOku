#!/usr/bin/env bash
# PDF kaynaklı kitaplar için 2. adım: metin katmanını UTF-8 olarak dokum/<kitap>/ altına döker.
# Kullanım: bash ayristirici/dokum-pdf.sh <kitap>
# Önemli: -enc UTF-8 şart. Varsayılan kodlama ş, ğ, İ, ı gibi harfleri sessizce düşürür.
set -euo pipefail
kitap="$1"
pdf="kaynak/$kitap/kaynak.pdf"
mkdir -p "dokum/$kitap"
pdftotext -enc UTF-8 -layout "$pdf" "dokum/$kitap/metin-layout.txt"   # girinti korunur (şiirler, dipnotlar)
pdftotext -enc UTF-8 "$pdf" "dokum/$kitap/metin.txt"                  # sütunlar okuma sırasıyla (sözlük)
echo "$kitap: dokum/$kitap/metin-layout.txt ve metin.txt yazıldı ($(grep -c '' "dokum/$kitap/metin-layout.txt") satır)"
