import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import React, { useEffect, useState, useMemo } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, TextInput, TouchableOpacity, View, Text, Share } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Notifications from 'expo-notifications';

export default function LeaderboardScreen() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [myUsername, setMyUsername] = useState<string | null>(null);
  const [friends, setFriends] = useState<any[]>([]);
  const [friendUsername, setFriendUsername] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    try {
      const savedToken = await AsyncStorage.getItem('userToken');
      const savedUsername = await AsyncStorage.getItem('myUsername');
      if (!savedToken) {
        router.replace('/login');
        return;
      }
      setToken(savedToken);
      setMyUsername(savedUsername);
      if (savedUsername) {
        await loadFriends(savedToken, savedUsername);
      }
    } catch (e) {
      console.error('Failed to load data', e);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchContributionCalendar = async (accessToken: string, userName: string) => {
    const query = `
      query($userName:String!) { 
        user(login: $userName) {
          contributionsCollection {
            contributionCalendar {
              totalContributions
              weeks {
                contributionDays {
                  contributionCount
                  date
                }
              }
            }
          }
        }
      }
    `;

    try {
      const gqlResponse = await fetch('https://api.github.com/graphql', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query,
          variables: { userName },
        }),
      });

      const gqlData = await gqlResponse.json();
      return gqlData.data?.user?.contributionsCollection?.contributionCalendar;
    } catch (e) {
      return null;
    }
  };

  const loadFriends = async (accessToken: string, username: string) => {
    try {
      const storedFriends = await AsyncStorage.getItem(`friends_${username}`);
      const friendList = storedFriends ? JSON.parse(storedFriends) : [];
      
      // Fetch my stats first to compare for reminders
      const myCalendar = await fetchContributionCalendar(accessToken, username);
      const now = new Date();
      const todayStr = new Date(now.getTime() - (now.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
      
      const myAllDays = myCalendar?.weeks.flatMap((w: any) => w.contributionDays) || [];
      const myTodayObj = myAllDays.find((d: any) => d.date === todayStr);
      const myTodayCount = myTodayObj?.contributionCount || 0;

      const friendData = await Promise.all(
        friendList.map(async (name: string) => {
          const calendar = await fetchContributionCalendar(accessToken, name);
          if (calendar) {
            const allDays = calendar.weeks.flatMap((w: any) => w.contributionDays).reverse();
            let streak = 0;
            
            // Streak Logic
            for (const day of allDays) {
              if (day.contributionCount > 0) streak++;
              else if (day.date !== todayStr) break;
            }

            // Social Reminder Logic
            const friendTodayObj = allDays.find((d: any) => d.date === todayStr);
            const friendTodayCount = friendTodayObj?.contributionCount || 0;

            if (friendTodayCount > 0 && myTodayCount === 0) {
              await Notifications.scheduleNotificationAsync({
                content: {
                  title: "👀 Don't let them win!",
                  body: `${name} just pushed code! Get a commit in to save your streak.`,
                  sound: true,
                },
                trigger: null,
              });
            }

            return { username: name, streak, total: calendar.totalContributions };
          }
          return null;
        })
      );
      
      setFriends(friendData.filter(f => f !== null).sort((a, b) => b.streak - a.streak));
    } catch (e) {
      console.error('Failed to load friends', e);
    }
  };

  const addFriend = async () => {
    if (!friendUsername || !token || !myUsername) return;
    
    setIsSyncing(true);
    try {
      const calendar = await fetchContributionCalendar(token, friendUsername.trim());
      if (!calendar) {
        Alert.alert('Error', 'GitHub user not found or has no public contributions.');
        return;
      }

      const storedFriends = await AsyncStorage.getItem(`friends_${myUsername}`);
      const friendList = storedFriends ? JSON.parse(storedFriends) : [];
      
      if (friendList.includes(friendUsername.trim())) {
        Alert.alert('Note', 'User already in your leaderboard.');
        return;
      }

      const newFriendList = [...friendList, friendUsername.trim()];
      await AsyncStorage.setItem(`friends_${myUsername}`, JSON.stringify(newFriendList));
      await loadFriends(token, myUsername);
      setFriendUsername('');
    } catch (e) {
      Alert.alert('Error', 'Failed to add friend.');
    } finally {
      setIsSyncing(false);
    }
  };

  const shareApp = async () => {
    try {
      await Share.share({
        message: `Yo! Get on Git Streaks and track your GitHub momentum with me. Download it here: https://github.com/drewmanley16/GitStreaks`,
      });
    } catch (error) {
      console.error(error);
    }
  };

  const filteredFriends = useMemo(() => {
    return friends.filter(f => 
      f.username.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [friends, searchQuery]);

  if (isLoading) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color="#f1e05a" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.contentContainer}>
        <View style={styles.header}>
          <Text style={styles.title}>Leaderboard</Text>
          <TouchableOpacity onPress={shareApp} style={styles.inviteButton}>
            <Text style={styles.inviteButtonText}>Invite Friends</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.addSection}>
          <TextInput
            style={styles.input}
            placeholder="Add friend by GitHub username"
            placeholderTextColor="#8b949e"
            value={friendUsername}
            onChangeText={setFriendUsername}
            autoCapitalize="none"
          />
          <TouchableOpacity style={styles.addButton} onPress={addFriend} disabled={isSyncing}>
            {isSyncing ? <ActivityIndicator size="small" color="#0d1117" /> : <Text style={styles.addButtonText}>Add</Text>}
          </TouchableOpacity>
        </View>

        <View style={styles.searchSection}>
          <TextInput
            style={styles.searchInput}
            placeholder="Search friends..."
            placeholderTextColor="#8b949e"
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCapitalize="none"
          />
        </View>

        <View style={styles.list}>
          {filteredFriends.map((friend, index) => (
            <View key={friend.username} style={styles.row}>
              <Text style={styles.rank}>{index + 1}</Text>
              <Text style={styles.name}>{friend.username}</Text>
              <Text style={styles.streak}>{friend.streak}d</Text>
            </View>
          ))}
          
          {filteredFriends.length === 0 && friends.length > 0 && (
            <Text style={styles.emptyText}>No friends matching "{searchQuery}"</Text>
          )}

          {friends.length === 0 && (
            <Text style={styles.emptyText}>No friends added yet.</Text>
          )}
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
    paddingTop: 40,
    paddingBottom: 40,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0d1117',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 30,
  },
  title: {
    color: '#ffffff',
    fontSize: 28,
    fontWeight: 'bold',
  },
  inviteButton: {
    backgroundColor: '#30363d',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#444c56',
  },
  inviteButtonText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
  },
  addSection: {
    flexDirection: 'row',
    backgroundColor: '#161b22',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#30363d',
    padding: 6,
    marginBottom: 16,
  },
  input: {
    flex: 1,
    color: '#ffffff',
    paddingHorizontal: 15,
    fontSize: 14,
  },
  addButton: {
    backgroundColor: '#f1e05a',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  addButtonText: {
    color: '#0d1117',
    fontSize: 14,
    fontWeight: 'bold',
  },
  searchSection: {
    marginBottom: 24,
  },
  searchInput: {
    backgroundColor: '#0d1117',
    borderWidth: 1,
    borderColor: '#30363d',
    borderRadius: 12,
    color: '#ffffff',
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 14,
  },
  list: {
    backgroundColor: '#161b22',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#30363d',
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#30363d',
  },
  rank: {
    color: '#8b949e',
    width: 35,
    fontSize: 14,
    fontWeight: 'bold',
  },
  name: {
    color: '#ffffff',
    flex: 1,
    fontSize: 16,
    fontWeight: 'bold',
  },
  streak: {
    color: '#f1e05a',
    fontSize: 16,
    fontWeight: 'bold',
  },
  emptyText: {
    color: '#8b949e',
    textAlign: 'center',
    padding: 40,
    fontSize: 14,
  },
});
