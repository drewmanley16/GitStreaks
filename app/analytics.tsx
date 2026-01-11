import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View, RefreshControl, Text, TouchableOpacity, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

type TimePeriod = 'day' | 'week' | 'month' | 'year' | 'all';

export default function AnalyticsScreen() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [period, setPeriod] = useState<TimePeriod>('month');
  const [analytics, setAnalytics] = useState<any>(null);

  const fetchAdvancedAnalytics = async (selectedPeriod: TimePeriod) => {
    try {
      const accessToken = await AsyncStorage.getItem('userToken');
      const username = await AsyncStorage.getItem('myUsername');
      
      if (!accessToken || !username) {
        router.replace('/login');
        return;
      }

      const now = new Date();
      let fromDate = new Date();
      
      if (selectedPeriod === 'day') fromDate.setDate(now.getDate() - 1);
      else if (selectedPeriod === 'week') fromDate.setDate(now.getDate() - 7);
      else if (selectedPeriod === 'month') fromDate.setDate(now.getDate() - 30);
      else if (selectedPeriod === 'year') fromDate.setFullYear(now.getFullYear() - 1);
      else if (selectedPeriod === 'all') {
        // For 'all', we set GraphQL to 1 year ago to get a relevant graph/mix
        // while the 'Totals' will use the Search API for true all-time numbers
        fromDate.setFullYear(now.getFullYear() - 1);
      }

      const fromISO = fromDate.toISOString();

      const query = `
        query($userName:String!, $from:DateTime!) { 
          user(login: $userName) {
            contributionsCollection(from: $from) {
              totalCommitContributions
              totalPullRequestContributions
              totalPullRequestReviewContributions
              totalIssueContributions
              totalRepositoryContributions
              contributionCalendar {
                totalContributions
                weeks {
                  contributionDays {
                    contributionCount
                    date
                  }
                }
              }
              pullRequestContributions(first: 20) {
                nodes {
                  pullRequest {
                    additions
                    deletions
                  }
                }
              }
            }
            repositories(first: 10, ownerAffiliations: OWNER, orderBy: {field: PUSHED_AT, direction: DESC}) {
              nodes {
                name
                languages(first: 3, orderBy: {field: SIZE, direction: DESC}) {
                  edges {
                    size
                    node {
                      name
                      color
                    }
                  }
                }
              }
            }
          }
        }
      `;

      const response = await fetch('https://api.github.com/graphql', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ query, variables: { userName: username, from: fromISO } }),
      });

      const result = await response.json();
      const data = result.data?.user;

      if (data) {
        // Fetch detailed activity stats from REST API for more accuracy on impact
        const [commitsRes, prsRes, issuesRes, reposRes] = await Promise.all([
          fetch(`https://api.github.com/search/commits?q=author:${username}&sort=author-date&order=desc&per_page=100`, {
            headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/vnd.github.v3+json' },
          }),
          fetch(`https://api.github.com/search/issues?q=author:${username}+type:pr`, {
            headers: { Authorization: `Bearer ${accessToken}` },
          }),
          fetch(`https://api.github.com/search/issues?q=author:${username}+type:issue`, {
            headers: { Authorization: `Bearer ${accessToken}` },
          }),
          fetch(`https://api.github.com/user/repos?sort=pushed&per_page=50`, {
            headers: { Authorization: `Bearer ${accessToken}` },
          })
        ]);

        const [commitsData, allPRsData, allIssuesData, reposData] = await Promise.all([
          commitsRes.json(),
          prsRes.json(),
          issuesRes.json(),
          reposRes.json()
        ]);
        
        let commitAdditions = 0;
        let commitDeletions = 0;
        let periodCommitsCount = 0;
        
        // Filter commits strictly within our period
        const periodCommits = (commitsData.items || []).filter((item: any) => 
          selectedPeriod === 'all' ? true : new Date(item.commit.author.date) >= fromDate
        );
        periodCommitsCount = periodCommits.length;

        // Fetch detail for commits in this period to get real code impact (limit to 20 for rate safety)
        const detailStats = await Promise.all(
          periodCommits.slice(0, 20).map(async (c: any) => {
            try {
              const res = await fetch(c.url, {
                headers: { Authorization: `Bearer ${accessToken}` }
              });
              return await res.json();
            } catch { return null; }
          })
        );
        
        detailStats.forEach(s => {
          if (s?.stats) {
            commitAdditions += s.stats.additions;
            commitDeletions += s.stats.deletions;
          }
        });

        // Language Breakdown logic - filter by repos pushed to in this period
        const langMap: any = {};
        const repoActivityMap: any = {};
        const periodRepos = (reposData || []).filter((repo: any) => 
          selectedPeriod === 'all' ? true : new Date(repo.pushed_at) >= fromDate
        );

        // Calculate repo activity from commits in this period
        periodCommits.forEach((c: any) => {
          const repoName = c.repository.name;
          repoActivityMap[repoName] = (repoActivityMap[repoName] || 0) + 1;
        });

        const topRepos = Object.entries(repoActivityMap)
          .sort(([, a]: any, [, b]: any) => b - a)
          .slice(0, 5)
          .map(([name, count]) => ({ name, count }));

        // Fetch detailed languages for each repo in the period
        const repoLanguages = await Promise.all(
          periodRepos.slice(0, 10).map(async (repo: any) => {
            try {
              const res = await fetch(repo.languages_url, {
                headers: { Authorization: `Bearer ${accessToken}` }
              });
              return await res.json();
            } catch { return {}; }
          })
        );

        repoLanguages.forEach(langs => {
          Object.entries(langs).forEach(([name, size]: [string, any]) => {
            langMap[name] = (langMap[name] || 0) + size;
          });
        });

        const sortedLangs = Object.entries(langMap)
          .sort(([, a]: any, [, b]: any) => b - a)
          .slice(0, 5);

        // Totals based on period
        const totalCommits = selectedPeriod === 'all' ? commitsData.total_count : periodCommits.length;
        const totalPRs = selectedPeriod === 'all' ? allPRsData.total_count : data.contributionsCollection.totalPullRequestContributions;
        const totalIssues = selectedPeriod === 'all' ? allIssuesData.total_count : data.contributionsCollection.totalIssueContributions;

        setAnalytics({
          commits: totalCommits,
          prs: totalPRs,
          reviews: data.contributionsCollection.totalPullRequestReviewContributions,
          issues: totalIssues,
          repos: periodRepos.length,
          topRepos,
          graphData: data.contributionsCollection.contributionCalendar.weeks.flatMap((w: any) => w.contributionDays).map((d: any) => d.contributionCount),
          startDate: fromDate,
          impact: {
            additions: commitAdditions,
            deletions: commitDeletions,
            avgPerCommit: periodCommitsCount > 0 ? Math.round(commitAdditions / Math.min(periodCommitsCount, 20)) : 0
          },
          languages: sortedLangs
        });
      }
    } catch (error) {
      console.error('DEBUG: Analytics Fetch Error', error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchAdvancedAnalytics(period);
  }, [period]);

  const onRefresh = useCallback(() => {
    setIsRefreshing(true);
    fetchAdvancedAnalytics(period);
  }, [period]);

  const handlePeriodChange = (newPeriod: TimePeriod) => {
    setIsLoading(true);
    setPeriod(newPeriod);
  };

  const renderGraph = () => {
    if (!analytics?.graphData || analytics.graphData.length === 0) return null;

    const data = analytics.graphData;
    const max = Math.max(...data, 1);
    const screenWidth = Dimensions.get('window').width - 48; // Padding
    const barWidth = (screenWidth - (data.length * 2)) / data.length;

    const formatDate = (date: Date) => {
      return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    };

    const getMarkers = () => {
      const start = new Date(analytics.startDate);
      const end = new Date();
      const mid = new Date(start.getTime() + (end.getTime() - start.getTime()) / 2);
      
      if (period === 'day') return [formatDate(start), '12 PM', 'Now'];
      if (period === 'all') return ['Beginning', 'Midway', 'Today'];
      return [formatDate(start), formatDate(mid), 'Today'];
    };

    const markers = getMarkers();

    return (
      <View style={styles.graphContainer}>
        <View style={styles.graphBars}>
          {data.map((count: number, i: number) => (
            <View 
              key={i} 
              style={[
                styles.bar, 
                { 
                  height: (count / max) * 100 + 2, // At least 2px
                  width: Math.max(barWidth, 2),
                  backgroundColor: count > 0 ? '#f1e05a' : '#30363d',
                  opacity: count > 0 ? Math.min(0.4 + (count / max) * 0.6, 1) : 0.3
                }
              ]} 
            />
          ))}
        </View>
        <View style={styles.graphLabels}>
          <Text style={styles.graphLabel}>{markers[0]}</Text>
          <Text style={styles.graphLabel}>{markers[1]}</Text>
          <Text style={styles.graphLabel}>{markers[2]}</Text>
        </View>
      </View>
    );
  };

  if (isLoading && !isRefreshing) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color="#f1e05a" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Deep Analytics</Text>
      </View>

      {/* Period Selector */}
      <View style={styles.periodSelector}>
        {(['day', 'week', 'month', 'year', 'all'] as TimePeriod[]).map((p) => (
          <TouchableOpacity 
            key={p} 
            style={[styles.periodTab, period === p && styles.periodTabActive]}
            onPress={() => handlePeriodChange(p)}
          >
            <Text style={[styles.periodTabText, period === p && styles.periodTabTextActive]}>
              {p.toUpperCase()}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView 
        contentContainerStyle={styles.contentContainer}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor="#f1e05a" />
        }
      >
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>ACTIVITY OVERVIEW</Text>
          {renderGraph()}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>CONTRIBUTION MIX</Text>
          <View style={styles.grid}>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{analytics?.prs}</Text>
              <Text style={styles.statLabel}>Pull Requests</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{analytics?.reviews}</Text>
              <Text style={styles.statLabel}>Code Reviews</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{analytics?.issues}</Text>
              <Text style={styles.statLabel}>Issues</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{analytics?.repos}</Text>
              <Text style={styles.statLabel}>Repos Built</Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>
            CODE IMPACT {period === 'all' ? '(Recent)' : '(Recent Pushes)'}
          </Text>
          <View style={styles.impactCard}>
            <View style={styles.impactRow}>
              <View>
                <Text style={[styles.impactValue, { color: '#3fb950' }]}>+{analytics?.impact.additions}</Text>
                <Text style={styles.impactLabel}>Additions</Text>
              </View>
              <View>
                <Text style={[styles.impactValue, { color: '#ff7b72' }]}>-{analytics?.impact.deletions}</Text>
                <Text style={styles.impactLabel}>Deletions</Text>
              </View>
            </View>
            <View style={styles.divider} />
            <Text style={styles.avgText}>
              Avg. <Text style={{ color: '#f1e05a' }}>{analytics?.impact.avgPerCommit}</Text> lines per commit
            </Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>TOP REPOSITORIES</Text>
          <View style={styles.listCard}>
            {analytics?.topRepos.length > 0 ? (
              analytics.topRepos.map((repo: any, index: number) => (
                <View key={repo.name} style={[styles.listItem, index === 0 && { borderTopWidth: 0 }]}>
                  <Text style={styles.repoNameText}>{repo.name}</Text>
                  <View style={styles.repoCountBadge}>
                    <Text style={styles.repoCountText}>{repo.count} events</Text>
                  </View>
                </View>
              ))
            ) : (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyText}>No repository activity in this period.</Text>
              </View>
            )}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>TOP LANGUAGES</Text>
          <View style={styles.langCard}>
            {analytics?.languages.map(([name, size]: any, index: number) => (
              <View key={name} style={styles.langRow}>
                <View style={styles.langInfo}>
                  <Text style={styles.langName}>{name}</Text>
                  <Text style={styles.langSize}>{Math.round(size / 1024)} KB</Text>
                </View>
                <View style={styles.progressBar}>
                  <View 
                    style={[
                      styles.progressFill, 
                      { 
                        width: `${(size / analytics.languages[0][1]) * 100}%`,
                        backgroundColor: index === 0 ? '#f1e05a' : '#30363d' 
                      }
                    ]} 
                  />
                </View>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0d1117',
  },
  contentContainer: {
    padding: 24,
    paddingBottom: 40,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 10,
  },
  backButton: {
    marginRight: 16,
  },
  backText: {
    color: '#8b949e',
    fontSize: 16,
    fontWeight: '600',
  },
  title: {
    color: '#ffffff',
    fontSize: 24,
    fontWeight: 'bold',
  },
  periodSelector: {
    flexDirection: 'row',
    paddingHorizontal: 24,
    paddingVertical: 12,
    gap: 8,
  },
  periodTab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 8,
    backgroundColor: '#161b22',
    borderWidth: 1,
    borderColor: '#30363d',
  },
  periodTabActive: {
    backgroundColor: '#30363d',
    borderColor: '#f1e05a',
  },
  periodTabText: {
    color: '#8b949e',
    fontSize: 10,
    fontWeight: 'bold',
    letterSpacing: 1,
  },
  periodTabTextActive: {
    color: '#f1e05a',
  },
  section: {
    marginBottom: 32,
  },
  sectionLabel: {
    color: '#8b949e',
    fontSize: 12,
    fontWeight: 'bold',
    marginBottom: 16,
    letterSpacing: 1.5,
  },
  graphContainer: {
    backgroundColor: '#161b22',
    padding: 20,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#30363d',
  },
  graphBars: {
    height: 120,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  bar: {
    borderRadius: 2,
  },
  graphLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingHorizontal: 4,
  },
  graphLabel: {
    color: '#8b949e',
    fontSize: 9,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  statCard: {
    backgroundColor: '#161b22',
    width: '48%',
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#30363d',
  },
  statValue: {
    color: '#ffffff',
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  statLabel: {
    color: '#8b949e',
    fontSize: 12,
    fontWeight: '600',
  },
  impactCard: {
    backgroundColor: '#161b22',
    padding: 24,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#30363d',
  },
  impactRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 20,
  },
  impactValue: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  impactLabel: {
    color: '#8b949e',
    fontSize: 12,
    fontWeight: 'bold',
    textAlign: 'center',
    marginTop: 4,
  },
  divider: {
    height: 1,
    backgroundColor: '#30363d',
    marginBottom: 20,
  },
  avgText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  langCard: {
    backgroundColor: '#161b22',
    padding: 24,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#30363d',
  },
  listCard: {
    backgroundColor: '#161b22',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#30363d',
    overflow: 'hidden',
  },
  listItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#30363d',
  },
  repoNameText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: 'bold',
    flex: 1,
  },
  repoCountBadge: {
    backgroundColor: '#30363d',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  repoCountText: {
    color: '#f1e05a',
    fontSize: 10,
    fontWeight: 'bold',
  },
  emptyCard: {
    padding: 32,
    alignItems: 'center',
  },
  langRow: {
    marginBottom: 16,
  },
  langInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  langName: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: 'bold',
  },
  langSize: {
    color: '#8b949e',
    fontSize: 12,
  },
  progressBar: {
    height: 6,
    backgroundColor: '#0d1117',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
});
