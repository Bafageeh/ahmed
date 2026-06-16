import React, { useEffect, useMemo, useRef, useState } from 'react';
import { SafeAreaView, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { BottomTabs } from './ta3meed/Ta3meedBottomTabs';
import { FilterSegment, filters } from './ta3meed/Ta3meedFilters';
import { Ta3meedHeader } from './ta3meed/Ta3meedHeader';
import { Ta3meedInvestorAccounts } from './ta3meed/Ta3meedInvestorAccounts';
import { investorOptionsFrom, Ta3meedInvestorFilter } from './ta3meed/Ta3meedInvestorFilter';
import { Ta3meedFinishedImport } from './ta3meed/Ta3meedFinishedImport';
import { EmptyCard, Ta3meedCard } from './ta3meed/Ta3meedInvestmentCard';
import { InvestorStats } from './ta3meed/Ta3meedInvestors';
import { SummaryCard } from './ta3meed/Ta3meedSummaryCards';
import { styles } from './ta3meed/ta3meedStyles';
import { investorCodesOf, money, n, searchable, statusOf, today } from './ta3meed/ta3meedUtils';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'https://ahmed.pm.sa/api';

function investorAllocationOf(item, investorCode) {
  if (!investorCode || investorCode === 'all') return null;
  const allocations = Array.isArray(item.allocations) ? item.allocations : [];
  return allocations.find((allocation) => (
    allocation.investor_code === investorCode ||
    allocation.investor_name === investorCode
  )) || null;
}

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
  const scrollRef = useRef(null);

  const investors = useMemo(() => investorOptionsFrom(items), [items]);

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

  const filteredSummary = useMemo(() => {
    return filteredItems.reduce((totals, item) => {
      const allocation = investorAllocationOf(item, investorFilter);
      const investedAmount = allocation ? n(allocation.invested_amount) : n(item.principal_amount);
      const profitAmount = allocation ? n(allocation.expected_profit_amount) : n(item.expected_profit_amount);

      return {
        totalInvested: totals.totalInvested + investedAmount,
        totalProfit: totals.totalProfit + profitAmount,
        count: totals.count + 1,
      };
    }, { totalInvested: 0, totalProfit: 0, count: 0 });
  }, [filteredItems, investorFilter]);

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

  const openInvestorAccounts = () => {
    setTab('more');
    setMessage('');
  };

  const handleSearchPress = () => {
    setTab('investments');
    setSearchVisible((visible) => {
      const nextVisible = !visible;
      if (nextVisible) {
        requestAnimationFrame(() => {
          scrollRef.current?.scrollTo({ y: 0, animated: true });
        });
      }
      return nextVisible;
    });
  };

  const showInfo = (text) => setMessage(text);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.screen}>
        <ScrollView ref={scrollRef} contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
          <Ta3meedHeader
            onBack={onBack}
            onAdd={() => setTab('finishedImport')}
            onFilter={cycleFilter}
            onSearch={handleSearchPress}
            onToggleInvestors={openInvestorAccounts}
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
            <SummaryCard icon="♙" iconStyle={styles.greenCircle} label="الاستثمارات النشطة" value={`${filteredSummary.count}`} suffix="استثمار" tint={styles.summaryGreen} />
            <SummaryCard icon="↗" iconStyle={styles.goldCircle} label="الأرباح المتوقعة" value={money(filteredSummary.totalProfit)} prefix="ر.س" tint={styles.summaryGold} />
            <SummaryCard icon="▢" iconStyle={styles.tealCircle} label="إجمالي الاستثمار" value={money(filteredSummary.totalInvested)} prefix="ر.س" tint={styles.summaryTeal} />
          </View>

          {tab !== 'more' ? (
            <TouchableOpacity
              style={[styles.investorAccountButton, { marginTop: 14, backgroundColor: '#ecfdf5', borderColor: '#99f6e4' }]}
              onPress={openInvestorAccounts}
              activeOpacity={0.84}
            >
              <Text style={[styles.investorAccountButtonText, { color: '#0f766e' }]}>حسابات المستثمرين - إضافة رصيد وتعديل</Text>
              <Text style={styles.investorAccountButtonIcon}>›</Text>
            </TouchableOpacity>
          ) : null}

          {tab !== 'more' && tab !== 'finishedImport' ? (
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

          {tab === 'more' ? (
            <>
              <TouchableOpacity
                style={[styles.investorAccountBackButton, { alignSelf: 'flex-start' }]}
                onPress={() => setTab('investments')}
                activeOpacity={0.84}
              >
                <Text style={styles.investorAccountBackText}>رجوع لفرص تعميد</Text>
              </TouchableOpacity>
              <Text style={styles.panelTitle}>حسابات المستثمرين</Text>
              <Ta3meedInvestorAccounts investors={investors} />
              <InvestorStats summary={summary} />
            </>
          ) : null}

          {tab === 'finishedImport' ? (
            <Ta3meedFinishedImport onImported={loadData} onBack={() => setTab('investments')} />
          ) : null}

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

        <BottomTabs
          onHome={onBack}
          onInfo={showInfo}
          onMore={openInvestorAccounts}
          active={tab === 'more' ? 'more' : 'investments'}
        />
      </View>
    </SafeAreaView>
  );
}