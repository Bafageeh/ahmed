import React, { useEffect, useMemo, useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { SNB_LOGO_DATA_URI } from './snbLogoData';

const BANKS = [
  { aliases: ['الانماء', 'الإنماء', 'بنك الانماء', 'بنك الإنماء', 'مصرف الانماء', 'مصرف الإنماء', 'alinma'], domain: 'alinma.com' },
  { aliases: ['الراجحي', 'بنك الراجحي', 'مصرف الراجحي', 'alrajhi', 'al rajhi'], domain: 'alrajhibank.com.sa' },
  { aliases: ['الاهلي', 'الأهلي', 'البنك الاهلي', 'البنك الأهلي', 'البنك الاهلي السعودي', 'البنك الأهلي السعودي', 'snb', 'saudi national bank'], domain: 'alahli.com' },
  { aliases: ['البلاد', 'بنك البلاد', 'bank albilad', 'albilad'], domain: 'bankalbilad.com' },
  { aliases: ['الرياض', 'بنك الرياض', 'riyad bank', 'riyadbank'], domain: 'riyadbank.com' },
  { aliases: ['العربي', 'البنك العربي', 'البنك العربي الوطني', 'anb', 'arab national bank'], domain: 'anb.com.sa' },
  { aliases: ['الجزيرة', 'بنك الجزيرة', 'bank aljazira', 'aljazira'], domain: 'bankaljazira.com' },
  { aliases: ['الفرنسي', 'البنك الفرنسي', 'السعودي الفرنسي', 'البنك السعودي الفرنسي', 'بنك السعودي الفرنسي', 'bsf', 'banque saudi fransi'], domain: 'bsf.sa' },
  { aliases: ['ساب', 'الأول', 'الاول', 'البنك السعودي الأول', 'البنك السعودي الاول', 'sabb', 'sab', 'saudi awaal bank'], domain: 'sab.com' },
  { aliases: ['السعودي للاستثمار', 'البنك السعودي للاستثمار', 'بنك الاستثمار', 'saib', 'saudi investment bank'], domain: 'saib.com.sa' },
  { aliases: ['الخليج الدولي', 'بنك الخليج الدولي', 'بنك الخليج الدولي - السعودية', 'gib', 'gib saudi'], domain: 'gib.com' },
  { aliases: ['اس تي سي', 'إس تي سي', 'بنك اس تي سي', 'بنك إس تي سي', 'stc bank', 'stcbank'], domain: 'stcbank.com.sa' },
  { aliases: ['فيجن', 'بنك فيجن', 'vision bank', 'visionbank'], domain: 'visionbank.com.sa' },
  { aliases: ['د360', 'د 360', 'بنك د360', 'بنك d360', 'd360'], domain: 'd360.com' },
  { aliases: ['ايزي', 'آيزي', 'ايزي بنك', 'آيزي بنك', 'ez bank', 'ezbank'], domain: 'ezbank.sa' },
  { aliases: ['ميم', 'meem'], domain: 'meem.com.sa' },
];

const SNB_ALIASES = ['الاهلي', 'الأهلي', 'البنك الاهلي', 'البنك الأهلي', 'البنك الاهلي السعودي', 'البنك الأهلي السعودي', 'snb', 'saudi national bank'];

function normalize(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[أإآ]/g, 'ا')
    .replace(/\s+/g, ' ')
    .trim();
}

function isSnbBank(bankName) {
  const value = normalize(bankName);
  return SNB_ALIASES.some((alias) => value.includes(normalize(alias)));
}

function bankDomain(bankName) {
  const value = normalize(bankName);
  const match = BANKS.find((bank) => bank.aliases.some((alias) => value.includes(normalize(alias))));
  return match ? match.domain : null;
}

export default function BankLogo({ bankName, size = 40 }) {
  const [failed, setFailed] = useState(false);
  const snb = useMemo(() => isSnbBank(bankName), [bankName]);
  const domain = useMemo(() => bankDomain(bankName), [bankName]);

  useEffect(() => {
    setFailed(false);
  }, [domain, bankName, snb]);

  const source = snb
    ? { uri: SNB_LOGO_DATA_URI }
    : domain
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
