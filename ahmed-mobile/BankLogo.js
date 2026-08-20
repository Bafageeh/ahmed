import React, { useMemo, useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';

const BANKS = [
  { aliases: ['الانماء', 'الإنماء', 'alinma'], domain: 'alinma.com' },
  { aliases: ['الراجحي', 'مصرف الراجحي', 'alrajhi', 'al rajhi'], domain: 'alrajhibank.com.sa' },
  { aliases: ['الاهلي', 'الأهلي', 'البنك الاهلي', 'البنك الأهلي', 'snb', 'saudi national bank'], domain: 'alahli.com' },
  { aliases: ['البلاد', 'بنك البلاد', 'bank albilad', 'albilad'], domain: 'bankalbilad.com' },
  { aliases: ['الرياض', 'بنك الرياض', 'riyad bank', 'riyadbank'], domain: 'riyadbank.com' },
  { aliases: ['العربي', 'البنك العربي', 'anb', 'arab national bank'], domain: 'anb.com.sa' },
  { aliases: ['الجزيرة', 'بنك الجزيرة', 'bank aljazira', 'aljazira'], domain: 'bankaljazira.com' },
  { aliases: ['الفرنسي', 'السعودي الفرنسي', 'بنك السعودي الفرنسي', 'bsf', 'banque saudi fransi'], domain: 'bsf.sa' },
  { aliases: ['ساب', 'البنك السعودي الأول', 'sabb', 'sab', 'saudi awaal bank'], domain: 'sab.com' },
  { aliases: ['السعودي للاستثمار', 'بنك الاستثمار', 'saib', 'saudi investment bank'], domain: 'saib.com.sa' },
  { aliases: ['ميم', 'meem'], domain: 'meem.com.sa' },
  { aliases: ['د360', 'd360'], domain: 'd360.com' },
];

function normalize(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[أإآ]/g, 'ا')
    .replace(/\s+/g, ' ')
    .trim();
}

function bankDomain(bankName) {
  const value = normalize(bankName);
  const match = BANKS.find((bank) => bank.aliases.some((alias) => value.includes(normalize(alias))));
  return match?.domain || null;
}

export default function BankLogo({ bankName, size = 40 }) {
  const [failed, setFailed] = useState(false);
  const domain = useMemo(() => bankDomain(bankName), [bankName]);
  const source = domain
    ? { uri: `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=128` }
    : null;

  if (!source || failed) {
    const letter = String(bankName || 'ب').trim().charAt(0) || 'ب';
    return (
      <View style={[styles.fallback, { width: size, height: size, borderRadius: Math.round(size / 3) }]}>
        <Text style={[styles.fallbackText, { fontSize: Math.max(15, Math.round(size * 0.44)) }]}>{letter}</Text>
      </View>
    );
  }

  return (
    <Image
      source={source}
      style={{ width: size, height: size }}
      resizeMode="contain"
      onError={() => setFailed(true)}
      accessibilityLabel={`شعار ${bankName || 'البنك'}`}
    />
  );
}

const styles = StyleSheet.create({
  fallback: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ede9fe',
  },
  fallbackText: {
    color: '#6d28d9',
    fontWeight: '900',
  },
});
