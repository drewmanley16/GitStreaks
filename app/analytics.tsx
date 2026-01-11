import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import React, { useEffect, useState, useCallback } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View, RefreshControl, Text, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function AnalyticsScreen() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [analytics, setAnalytics] = useState<any>(null);

  const fetchAdvancedAnalytics = async () => {
    try {
      const accessToken = await AsyncStorage.getItem('userToken');
      const username = await AsyncStorage.getItem('myUsername');
      
      if (!accessToken || !username) {
        router.replace('/login');
        return;
      }

      const query = `
        query($userName:String!) { 
          user(login: $userName) {
            contributionsCollection {
              totalCommitContributions
              totalPullRequestContributions
              totalPullRequestReviewContributions
              totalIssueContributions
              totalRepositoryContributions
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
        body: JSON.stringify({ query, variables: { userName: username } }),
      });

      const result = await response.json();
      const data = result.data?.user;

      if (data) {
        const prs = data.contributionsCollection.pullRequestContributions.nodes;
        const totalAdditions = prs.reduce((acc: number, node: any) => acc + node.pullRequest.additions, 0);
        const totalDeletions = prs.reduce((acc: number, node: any) => acc + node.pullRequest.deletions, 0);
        
        // Language Breakdown logic
        const langMap: any = {};
        data.repositories.nodes.forEach((repo: any) => {
          repo.languages.edges.forEach((edge: any) => {
            const name = edge.node.name;
            langMap[name] = (langMap[name] || 0) + edge.size;
          });
        });

        const sortedLangs = Object.entries(langMap)
          .sort(([, a]: any, [, b]: any) => b - a)
          .slice(0, 5);

        setAnalytics({
          commits: data.contributionsCollection.totalCommitContributions,
          prs: data.contributionsCollection.totalPullRequestContributions,
          reviews: data.contributionsCollection.totalPullRequestReviewContributions,
          issues: data.contributionsCollection.totalIssueContributions,
          repos: data.contributionsCollection.totalRepositoryContributions,
          impact: {
            additions: totalAdditions,
            deletions: totalDeletions,
            avgPerPR: prs.length > 0 ? Math.round((totalAdditions + totalDeletions) / prs.length) : 0
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
    fetchAdvancedAnalytics();
  }, []);

  const onRefresh = useCallback(() => {
    setIsRefreshing(true);
    fetchAdvancedAnalytics();
  }, []);

  if (isLoading) {
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

      <ScrollView 
        contentContainerStyle={styles.contentContainer}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={onRefresh} tintColor="#f1e05a" />
        }
      >
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
          <Text style={styles.sectionLabel}>CODE IMPACT (Recent PRs)</Text>
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
              Avg. <Text style={{ color: '#f1e05a' }}>{analytics?.impact.avgPerPR}</Text> lines changed per PR
            </Text>
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
    paddingBottom: 20,
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

