import React, { useEffect, useMemo, useState } from 'react';
import { SafeAreaView, ScrollView, Text, TextInput, View } from 'react-native';
import { BottomTabs } from './ta3meed/Ta3meedBottomTabs';
import { FilterSegment, filters } from './ta3meed/Ta3meedFilters';
import { Ta3meedHeader } from './ta3meed/Ta3meedHeader';
import { Ta3meedInvestorAccounts } from './ta3meed/Ta3meedInvestorAccounts';
import { investorOptionsFrom, Ta3meedInvestorFilter } from './ta3meed/Ta3meedInvestorFilter';
import { EmptyCard, Ta3meedCard } from './ta3meed/Ta3meedInvestmentCard';
import { InvestorStats } from './ta3meed/Ta3meedInvestors';
import { SummaryCard } from './ta3meed/Ta3meedSummaryCards';
import { styles } from './ta3meed/ta3meedStyles';
import { investorCodesOf, money, n, searchable, statusOf, today } from './ta3meed/ta3meedUtils';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://ahmed.pm.sa/api';

export default function Ta3meedScreen({ onBack }) {
  const [items, setItems] = useState([]);
  const [summary, setSummary] = useState(null);
  const [filter, setFilter] = useState('all');
  const [investorFilter, setInvestorFilter] = useState('all');
  const [tab, setTab] = useState('investments');
  const [message, setMessage] = useState('');
  const [searchVisible, setSearchVisible] = useState(false);
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState(null);
  const [receivingId, setReceivingId] = useState(null);

  const investors = useMemo(() => investorOptionsFrom(items), [items]);
  const totalInvested = useMemo(() => items.reduce((sum, item) => sum + n(item.principal_amount), 0), [items]);
  const totalProfit = useMemo(() => items.reduce((sum, item) => sum + n(item.expected_profit_amount), 0), [items]);
  const activeCount = useMemo(() => items.filter((item) => statusOf(item, today).key === 'active').length, [items]);
  const filteredItems = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    return items.filter((item) => {
      const status = statusOf(item, today).key;
      const matchesFilter = filter === 'all' || status === filter;
      const matchesInvestor = investorFilter === 'all' || investorCodesOf(item).includes(investorFilter);
      const matchesSearch = !keyword || searchable(item).includes(keyword);
      return matchesFilter && matchesInvestor && matchesSearch;
    });
  }, [items, filter, investorFilter, search]);

  const loadData = async () => {
    setMessage('جاري تحميل تعميد...');
    try {
      const investmentsResponse = await fetch(`${API_URL}/ta3meed/investments`);
      const investmentsJson = await investmentsResponse.json();
      setItems(Array.isArray(investmentsJson.data) ? investmentsJson.data : []);

      const summaryResponse = await fetch(`${API_URL}/ta3meed/summary`);
      const summaryJson = await summaryResponse.json();
      setSummary(summaryJson.data || null);
      setMessage('');
    } catch {
      setMessage('تعذر تحميل بيانات تعميد');
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const receiveInvestment = async (item) => {
    setReceivingId(item.id);
    setMessage('جاري تسجيل الاستلام...');
    try {
      const response = await fetch(`${API_URL}/ta3meed/investments/${item.id}/receive`, {
        method: 'POST',
        headers: { Accept: 'application/json' },
      });
      if (!response.ok) throw new Error('receive failed');
      setMessage('تم اعتبار استثمار تعميد مستلمًا');
      await loadData();
    } catch {
      setMessage('تعذر تسجيل الاستلام');
    } finally {
      setReceivingId(null);
    }
  };

  const cycleFilter = () => {
    const currentIndex = filters.findIndex((item) => item.key === filter);
    setFilter(filters[(currentIndex + 1) % filters.length].key);
  };

  const handleInvestorFilter = (code) => {
    setInvestorFilter(code);
    setTab('investments');
  };

  const showInfo = (text) => setMessage(text);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.screen}>
        <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
          <Ta3meedHeader
            onBack={onBack}
            onAdd={() => showInfo('إضافة استثمار تعميد')}
            onFilter={cycleFilter}
            onSearch={() => setSearchVisible((value) => !value)}
            onToggleInvestors={() => setTab(tab === 'investors' ? 'investments' : 'investors')}
          />

          {searchVisible ? (
            <View style={styles.searchBox}>
              <TextInput
                value={search}
                onChangeText={setSearch}
                placeholder="ابحث في تعميد"
                placeholderTextColor="#94a3b8"
                style={styles.searchInput}
              />
              <Text style={styles.searchGlyph}>⌕</Text>
            </View>
          ) : null}

          <View style={styles.summaryRow}>
            <SummaryCard icon="♙" iconStyle={styles.greenCircle} label="الاستثمارات النشطة" value={`${summary?.active_count ?? activeCount}`} suffix="استثمار" tint={styles.summaryGreen} />
            <SummaryCard icon="↗" iconStyle={styles.goldCircle} label="الأرباح المتوقعة" value={money(totalProfit)} prefix="ر.س" tint={styles.summaryGold} />
            <SummaryCard icon="▢" iconStyle={styles.tealCircle} label="إجمالي الاستثمار" value={money(totalInvested)} prefix="ر.س" tint={styles.summaryTeal} />
          </View>

          {tab !== 'investors' && tab !== 'accounts' ? (
            <>
              <View style={styles.filterShell}>
                {filters.map((item) => (
                  <FilterSegment key={item.key} filter={item} active={filter === item.key} onPress={() => setFilter(item.key)} />
                ))}
              </View>
              <Ta3meedInvestorFilter investors={investors} selected={investorFilter} onSelect={handleInvestorFilter} />
            </>
          ) : null}

          {!!message && <Text style={styles.message}>{message}</Text>}

          {tab === 'investors' ? <InvestorStats summary={summary} /> : null}
          {tab === 'accounts' ? <Ta3meedInvestorAccounts investors={investors} /> : null}

          {tab === 'investments' ? (
            <View style={styles.listArea}>
              {filteredItems.length === 0 ? (
                <EmptyCard />
              ) : filteredItems.map((item, index) => (
                <Ta3meedCard
                  key={String(item.id)}
                  item={item}
                  index={index}
                  selectedInvestorCode={investorFilter === 'all' ? null : investorFilter}
                  expanded={expandedId === item.id}
                  onToggle={() => setExpandedId((current) => current === item.id ? null : item.id)}
                  onReceive={() => receiveInvestment(item)}
                  receiving={receivingId === item.id}
                  onEdit={() => showInfo('التعديل من شاشة تعميد')}
                  onDelete={() => showInfo('الحذف غير مفعل في API')}
                />
              ))}
            </View>
          ) : null}
        </ScrollView>
        <BottomTabs onHome={onBack} onInfo={showInfo} onMore={() => setTab('accounts')} active={tab === 'accounts' ? 'more' : 'investments'} />
      </View>
    </SafeAreaView>
  );
}
